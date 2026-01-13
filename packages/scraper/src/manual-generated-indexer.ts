#!/usr/bin/env node

// Load environment variables from repo root .env file (must be first import)
import '@mina-docs/shared/load-env';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { parseArgs } from 'util';
import {
  FullTextDB,
  VectorDB,
  generateEmbeddings,
  loadProjectConfig,
  type DocumentChunk
} from '@mina-docs/shared';
import { chunkContent } from './chunker.js';
import { computeContentHash } from './hash-utils.js';

interface CliConfig {
  project: string;
  docsDir: string;
  customId: string;
  qdrantUrl: string;
  qdrantCollection: string;
  sqlitePath: string;
  openaiApiKey: string;
}

const EMBEDDING_BATCH_SIZE = 20;

async function main() {
  const { values: args } = parseArgs({
    options: {
      project: { type: 'string', short: 'p' },
      custom: { type: 'string', short: 'c' },
      dir: { type: 'string', short: 'd' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.project) {
    console.error('Error: --project <id> is required (e.g. polymarket)');
    printUsage();
    process.exit(1);
  }

  const docsDir = resolveDocsDir(args.dir, args.custom);
  const customId = args.custom || path.basename(docsDir);

  // Validate project exists
  const projectConfig = loadProjectConfig(args.project);

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const config: CliConfig = {
    project: projectConfig.id,
    docsDir,
    customId,
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantCollection: process.env.QDRANT_COLLECTION || 'crypto_docs',
    sqlitePath: process.env.SQLITE_PATH || './data/crypto_docs.db',
    openaiApiKey: process.env.OPENAI_API_KEY
  };

  console.log('='.repeat(60));
  console.log(`Manual Generated Docs Indexer`);
  console.log('='.repeat(60));
  console.log(`Project: ${config.project} (${projectConfig.name})`);
  console.log(`Docs dir: ${config.docsDir}`);
  console.log(`Custom id: ${config.customId}`);
  console.log(`SQLite: ${config.sqlitePath}`);
  console.log(`Qdrant: ${config.qdrantUrl}`);

  const vectorDb = new VectorDB({
    url: config.qdrantUrl,
    collection: config.qdrantCollection
  });
  const ftsDb = new FullTextDB({ path: config.sqlitePath });

  try {
    await vectorDb.initialize();
    await ftsDb.initialize();
  } catch (error) {
    console.error('Failed to initialize databases:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const markdownFiles = await collectMarkdownFiles(config.docsDir);
  if (markdownFiles.length === 0) {
    console.log('No markdown files found to index.');
    await ftsDb.close();
    await vectorDb.close();
    return;
  }

  const visitedUrls = new Set<string>();
  let totalChunks = 0;
  let skippedFiles = 0;
  let failedFiles = 0;
  const pendingChunks: DocumentChunk[] = [];
  const startTime = Date.now();
  const urlPrefix = `generated-docs://${config.customId}/`;

  async function processBatch() {
    if (pendingChunks.length === 0) return;

    const batch = pendingChunks.splice(0, pendingChunks.length);
    const embeddings = await generateEmbeddings(
      batch.map(c => c.content),
      config.openaiApiKey
    );

    await vectorDb.upsert(batch, embeddings);
    await ftsDb.upsert(batch);

    totalChunks += batch.length;
    console.log(`  Indexed batch of ${batch.length} chunks (total: ${totalChunks})`);
  }

  for (const filePath of markdownFiles) {
    const relativePath = path.relative(config.docsDir, filePath).replace(/\\/g, '/');
    const url = urlPrefix + relativePath;
    visitedUrls.add(url);

    try {
      const markdown = await fs.readFile(filePath, 'utf-8');
      const contentHash = computeContentHash(markdown);
      const existingHash = await ftsDb.getPageHash(url);

      if (existingHash === contentHash) {
        skippedFiles++;
        console.log(`⊘ ${relativePath} (unchanged)`);
        continue;
      }

      if (existingHash) {
        await vectorDb.deleteByUrl(url);
        await ftsDb.deleteByUrl(url);
        console.log(`↻ ${relativePath} (content changed)`);
      } else {
        console.log(`➕ ${relativePath}`);
      }

      const scrapedAt = new Date().toISOString();
      const baseTitle = deriveTitleFromPath(relativePath, config.customId);
      const rawChunks = parseMarkdownToChunks(
        markdown,
        url,
        config.project,
        config.customId,
        scrapedAt,
        baseTitle
      );

      if (rawChunks.length === 0) {
        console.log(`  ⚠ No content extracted, skipping`);
        await ftsDb.setPageHash(url, config.project, contentHash, 0);
        continue;
      }

      const chunks = chunkContent(rawChunks);
      pendingChunks.push(...chunks);
      if (pendingChunks.length >= EMBEDDING_BATCH_SIZE) {
        await processBatch();
      }

      await ftsDb.setPageHash(url, config.project, contentHash, chunks.length);
    } catch (error) {
      failedFiles++;
      console.error(`✗ Failed to process ${relativePath}:`, error instanceof Error ? error.message : error);
    }
  }

  await processBatch();

  // Mark orphaned pages for this custom docs set
  const indexedUrls = await ftsDb.getIndexedUrlsForProject(config.project);
  const customUrls = indexedUrls.filter(url => url.startsWith(urlPrefix));
  const orphanedUrls = customUrls.filter(url => !visitedUrls.has(url));

  if (orphanedUrls.length > 0) {
    await vectorDb.markOrphaned(orphanedUrls, true);
    await ftsDb.markOrphaned(orphanedUrls, true);
    console.log(`Marked ${orphanedUrls.length} orphaned pages`);
  }

  if (visitedUrls.size > 0) {
    const visited = Array.from(visitedUrls);
    await vectorDb.markOrphaned(visited, false);
    await ftsDb.markOrphaned(visited, false);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('Generated docs indexing complete');
  console.log('='.repeat(60));
  console.log(`Files scanned: ${markdownFiles.length}`);
  console.log(`Files skipped (unchanged): ${skippedFiles}`);
  console.log(`Files failed: ${failedFiles}`);
  console.log(`Total chunks indexed: ${totalChunks}`);
  console.log(`Time: ${totalTime}s`);
  console.log('='.repeat(60));

  await ftsDb.close();
  await vectorDb.close();
}

function printUsage() {
  console.log(`
Usage: node manual-generated-indexer.js --project <id> --custom <folder> [--dir <path>]

Options:
  -p, --project  Official project id to index under (e.g. polymarket)
  -c, --custom   Folder name under docs/generated to index
  -d, --dir      Override docs directory (defaults to docs/generated/<custom>)
  -h, --help     Show this help

Examples:
  node packages/scraper/dist/manual-generated-indexer.js --project polymarket --custom Polymarket-Kalshi-Arbitrage-bot
  node --loader ts-node/esm packages/scraper/src/manual-generated-indexer.ts -p polymarket -d ./docs/generated/Polymarket-Kalshi-Arbitrage-bot
`);
}

function resolveDocsDir(dirArg?: string, customArg?: string): string {
  const resolvedDir = dirArg
    ? path.resolve(dirArg)
    : customArg
      ? path.resolve(process.cwd(), 'docs', 'generated', customArg)
      : null;

  if (!resolvedDir) {
    console.error('Error: provide --custom <folder> or --dir <path> for generated docs');
    printUsage();
    process.exit(1);
  }

  if (!existsSync(resolvedDir)) {
    console.error(`Error: docs directory not found at ${resolvedDir}`);
    process.exit(1);
  }

  return resolvedDir;
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseMarkdownToChunks(
  markdown: string,
  url: string,
  project: string,
  sourceId: string,
  scrapedAt: string,
  fallbackTitle: string
): DocumentChunk[] {
  const lines = markdown.split(/\r?\n/);
  const pageTitle = lines.find(line => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || fallbackTitle;
  const chunks: DocumentChunk[] = [];
  const headings: string[] = [];
  let currentHeading = pageTitle;
  let proseBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLang = 'text';

  const pushProse = () => {
    const content = cleanContent(proseBuffer.join('\n'));
    if (content.length > 50) {
      chunks.push({
        id: randomUUID(),
        url,
        title: pageTitle,
        section: currentHeading,
        content,
        contentType: url.includes('/api') ? 'api-reference' : 'prose',
        project,
        metadata: {
          headings: [...headings],
          lastScraped: scrapedAt,
          sourceType: 'docs',
          sourceId
        }
      });
    }
    proseBuffer = [];
  };

  const pushCode = () => {
    const content = codeBuffer.join('\n').trim();
    if (content.length > 30) {
      chunks.push({
        id: randomUUID(),
        url,
        title: pageTitle,
        section: currentHeading,
        content,
        contentType: 'code',
        project,
        metadata: {
          headings: [...headings],
          codeLanguage: normalizeLanguage(codeLang),
          lastScraped: scrapedAt,
          sourceType: 'docs',
          sourceId
        }
      });
    }
    codeBuffer = [];
  };

  for (const line of lines) {
    const codeFenceMatch = line.match(/^```(\w+)?\s*$/);
    if (codeFenceMatch) {
      if (inCodeBlock) {
        pushCode();
        inCodeBlock = false;
        codeLang = 'text';
      } else {
        pushProse();
        inCodeBlock = true;
        codeLang = codeFenceMatch[1] || 'text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      pushProse();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      if (level === 1) {
        currentHeading = headingText || currentHeading;
        headings.length = 0;
      } else {
        while (headings.length >= level - 1) {
          headings.pop();
        }
        headings.push(headingText);
        currentHeading = headingText;
      }
      continue;
    }

    proseBuffer.push(line);
  }

  if (inCodeBlock) {
    pushCode();
  } else {
    pushProse();
  }

  return chunks;
}

function cleanContent(content: string): string {
  return content
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    console: 'bash',
    rs: 'rust'
  };
  return map[normalized] || normalized || 'text';
}

function deriveTitleFromPath(relativePath: string, fallback: string): string {
  const base = relativePath.split('/').pop() || fallback;
  return base.replace(/\.(md|mdx)$/i, '') || fallback;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
