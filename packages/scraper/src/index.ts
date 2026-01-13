#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'util';
import { Crawler } from './crawler.js';
import { parseDocumentation } from './parser.js';
import { chunkContent } from './chunker.js';
import { scrapeGitHubSource } from './github-source.js';
import { scrapeProjectGitHubSources } from './intelligent-github-scraper.js';
import { computeContentHash } from './hash-utils.js';
import {
  VectorDB,
  FullTextDB,
  generateEmbeddings,
  loadProjectConfig,
  listProjects,
  loadProjectGitHubSources,
  sourceRegistryExists,
  type ProjectConfig,
  type DocumentChunk
} from '@mina-docs/shared';

// Parse CLI arguments
const { values: args } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    list: { type: 'boolean', short: 'l' },
    help: { type: 'boolean', short: 'h' },
    'use-registry': { type: 'boolean', short: 'r' },
    'dry-run': { type: 'boolean', short: 'd' },
    'github-only': { type: 'boolean', short: 'g' }
  },
  allowPositionals: true // Allow positional args to be ignored
});

if (args.help) {
  console.log(`
Usage: npm run scraper -- [options]

Options:
  -p, --project <id>   Project to scrape (required)
  -l, --list           List available projects
  -h, --help           Show this help
  -r, --use-registry   Use source registry for intelligent GitHub scraping
  -d, --dry-run        Dry run (skip LLM calls, just show what would be indexed)
  -g, --github-only    Only scrape GitHub sources (skip documentation)

Examples:
  npm run scraper -- --project mina
  npm run scraper -- -p mina --use-registry
  npm run scraper -- -p mina --use-registry --dry-run
  npm run scraper -- -p mina --github-only --use-registry
  npm run scraper -- --list
  `);
  process.exit(0);
}

if (args.list) {
  console.log('Available projects:');
  const projects = listProjects();
  if (projects.length === 0) {
    console.log('  (none found - check config/projects/ directory)');
  } else {
    projects.forEach(p => {
      try {
        const cfg = loadProjectConfig(p);
        console.log(`  - ${p}: ${cfg.name} (${cfg.docs.baseUrl})`);
      } catch {
        console.log(`  - ${p}: (config error)`);
      }
    });
  }
  process.exit(0);
}

if (!args.project) {
  console.error('Error: --project is required');
  console.error('Run with --list to see available projects, or --help for usage');
  process.exit(1);
}

// Load project configuration
let projectConfig: ProjectConfig;
try {
  projectConfig = loadProjectConfig(args.project);
} catch (error) {
  console.error(`Error loading project config: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

// Configuration with project config + env overrides
const config = {
  project: projectConfig.id,
  projectName: projectConfig.name,
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantCollection: process.env.QDRANT_COLLECTION || 'crypto_docs',
  sqlitePath: process.env.SQLITE_PATH || './data/crypto_docs.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  // From project config
  baseUrl: projectConfig.docs.baseUrl,
  excludePatterns: projectConfig.docs.excludePatterns,
  maxPages: projectConfig.docs.maxPages,
  concurrency: projectConfig.crawler.concurrency,
  delayMs: projectConfig.crawler.delayMs,
  userAgent: projectConfig.crawler.userAgent,
  useBrowser: projectConfig.docs.useBrowser,
  // GitHub config
  github: projectConfig.github,
  githubToken: process.env.GITHUB_TOKEN,
  // New options
  useRegistry: args['use-registry'] || false,
  dryRun: args['dry-run'] || false,
  githubOnly: args['github-only'] || false
};

function assignChunkSequence(chunks: DocumentChunk[]): void {
  const buckets = new Map<string, DocumentChunk[]>();
  for (const chunk of chunks) {
    chunk.pageId = chunk.pageId || chunk.url;
    const bucket = buckets.get(chunk.pageId) || [];
    bucket.push(chunk);
    buckets.set(chunk.pageId, bucket);
  }
  for (const bucket of buckets.values()) {
    const total = bucket.length;
    bucket.forEach((c, idx) => {
      c.chunkIndex = idx;
      c.chunkTotal = total;
      c.pageId = c.pageId || c.url;
    });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(`Documentation Scraper - ${config.projectName}`);
  console.log('='.repeat(60));

  // Validate required config
  if (!config.openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  Project: ${config.project}`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Max Pages: ${config.maxPages}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Delay: ${config.delayMs}ms`);
  console.log(`  Qdrant: ${config.qdrantUrl}`);
  console.log(`  SQLite: ${config.sqlitePath}`);
  console.log(`  Use Registry: ${config.useRegistry}`);
  console.log(`  Dry Run: ${config.dryRun}`);
  console.log(`  GitHub Only: ${config.githubOnly}`);
  if (config.github) {
    console.log(`  GitHub (legacy): ${config.github.repo}@${config.github.branch}`);
  }
  if (config.useRegistry && sourceRegistryExists()) {
    const registrySources = loadProjectGitHubSources(config.project);
    console.log(`  Registry Sources: ${registrySources.length} configured`);
    registrySources.forEach(s => console.log(`    - ${s.id} (${s.trustLevel})`));
  }

  // Initialize databases
  console.log('\nInitializing databases...');

  const vectorDb = new VectorDB({
    url: config.qdrantUrl,
    collection: config.qdrantCollection
  });

  const ftsDb = new FullTextDB({
    path: config.sqlitePath
  });

  try {
    await vectorDb.initialize();
    console.log('  ✓ Vector database (Qdrant) initialized');
  } catch (error) {
    console.error('  ✗ Failed to connect to Qdrant:', error instanceof Error ? error.message : error);
    console.error('\n  Make sure Qdrant is running: docker-compose up -d');
    process.exit(1);
  }

  try {
    await ftsDb.initialize();
    console.log('  ✓ Full-text search database (SQLite) initialized');
  } catch (error) {
    console.error('  ✗ Failed to initialize SQLite:', error);
    process.exit(1);
  }

  let totalChunks = 0;
  let processedPages = 0;
  let failedPages = 0;
  let skippedPages = 0;
  const startTime = Date.now();

  // Track visited URLs for orphan detection
  const visitedUrls = new Set<string>();

  // Batch settings for embedding generation
  const EMBEDDING_BATCH_SIZE = 20;
  let pendingChunks: Awaited<ReturnType<typeof chunkContent>> = [];

  async function processBatch() {
    if (pendingChunks.length === 0) return;

    const batch = pendingChunks;
    pendingChunks = [];

    try {
      // Generate embeddings for batch
      const embeddings = await generateEmbeddings(
        batch.map(c => c.content),
        config.openaiApiKey!
      );

      // Store in vector database
      await vectorDb.upsert(batch, embeddings);

      // Store in full-text search
      await ftsDb.upsert(batch);

      totalChunks += batch.length;
      console.log(`    Indexed batch of ${batch.length} chunks (total: ${totalChunks})`);
    } catch (error) {
      console.error(`    Failed to index batch:`, error instanceof Error ? error.message : error);
    }
  }

  // Crawl documentation (skip if --github-only)
  if (!config.githubOnly) {
    // Initialize crawler
    const crawler = new Crawler({
      baseUrl: config.baseUrl,
      concurrency: config.concurrency,
      delayMs: config.delayMs,
      maxPages: config.maxPages,
      excludePatterns: config.excludePatterns,
      userAgent: config.userAgent,
      useBrowser: config.useBrowser
    });

    console.log('\nStarting documentation crawl...\n');

    // Crawl and process pages with atomic re-indexing
    for await (const page of crawler.crawl()) {
      processedPages++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${elapsed}s] Processing (${processedPages}/${config.maxPages}): ${page.url}`);

      // Track this URL as visited
      visitedUrls.add(page.url);

      try {
        // Check content hash - skip if unchanged
        const contentHash = computeContentHash(page.html);
        const existingHash = await ftsDb.getPageHash(page.url);

        if (existingHash === contentHash) {
          console.log(`  ⊘ Content unchanged, skipping`);
          skippedPages++;
          continue;
        }

        // Content changed or new - delete old chunks first
        if (existingHash) {
          await vectorDb.deleteByUrl(page.url);
          await ftsDb.deleteByUrl(page.url);
          console.log(`  ↻ Content changed, deleted old chunks`);
        }

        // Parse HTML into chunks with project identifier
        const rawChunks = parseDocumentation(page.url, page.html, config.project);

        if (rawChunks.length === 0) {
          console.log(`  ⚠ No content extracted, skipping`);
          // Update hash even for empty pages to avoid re-processing
          await ftsDb.setPageHash(page.url, config.project, contentHash, 0);
          continue;
        }

        // Apply semantic chunking
        const chunks = chunkContent(rawChunks);
        console.log(`  ✓ Extracted ${chunks.length} chunks`);

        // Add to pending batch
        pendingChunks.push(...chunks);

        // Process batch if large enough
        if (pendingChunks.length >= EMBEDDING_BATCH_SIZE) {
          await processBatch();
        }

        // Update page hash after successful processing
        await ftsDb.setPageHash(page.url, config.project, contentHash, chunks.length);

      } catch (error) {
        failedPages++;
        console.error(`  ✗ Error:`, error instanceof Error ? error.message : error);
      }
    }

    // Process remaining chunks
    await processBatch();

    // Mark orphaned chunks (pages not visited in this crawl)
    console.log('\nDetecting orphaned pages...');
    const indexedUrls = await ftsDb.getIndexedUrlsForProject(config.project);
    const orphanedUrls = indexedUrls.filter(url => !visitedUrls.has(url));

    if (orphanedUrls.length > 0) {
      console.log(`  Found ${orphanedUrls.length} orphaned URLs, marking chunks...`);
      await vectorDb.markOrphaned(orphanedUrls, true);
      await ftsDb.markOrphaned(orphanedUrls, true);
      console.log(`  ✓ Marked ${orphanedUrls.length} URLs as orphaned`);
    } else {
      console.log(`  ✓ No orphaned pages detected`);
    }

    // Un-orphan visited URLs that were previously orphaned
    const revisitedUrls = Array.from(visitedUrls);
    await vectorDb.markOrphaned(revisitedUrls, false);
    await ftsDb.markOrphaned(revisitedUrls, false);

  } else {
    console.log('\nSkipping documentation crawl (--github-only mode)');
  }

  // Scrape GitHub sources
  const useIntelligentScraper = config.useRegistry && sourceRegistryExists();

  if (useIntelligentScraper) {
    // Use intelligent scraper with source registry
    console.log('\n' + '='.repeat(60));
    console.log('Intelligent GitHub Scraping (Source Registry)');
    console.log('='.repeat(60));

    const registrySources = loadProjectGitHubSources(config.project);

    if (registrySources.length === 0) {
      console.log('No sources configured in registry for this project');
    } else {
      try {
        const results = await scrapeProjectGitHubSources(
          config.project,
          registrySources,
          {
            openaiApiKey: config.openaiApiKey!,
            githubToken: config.githubToken,
            dryRun: config.dryRun
          }
        );

        // Index all chunks from all sources with atomic re-indexing
        for (const result of results) {
          if (result.chunks.length > 0) {
            console.log(`\nIndexing ${result.chunks.length} chunks from ${result.sourceId}...`);
            assignChunkSequence(result.chunks);

            // Get unique URLs from new chunks and delete old chunks for those URLs
            const newUrls = [...new Set(result.chunks.map(c => c.url))];
            console.log(`  Deleting old chunks for ${newUrls.length} URLs...`);
            for (const url of newUrls) {
              await vectorDb.deleteByUrl(url);
              await ftsDb.deleteByUrl(url);
              visitedUrls.add(url);
            }

            // Process in batches
            for (let i = 0; i < result.chunks.length; i += EMBEDDING_BATCH_SIZE) {
              const batch = result.chunks.slice(i, i + EMBEDDING_BATCH_SIZE);

              const embeddings = await generateEmbeddings(
                batch.map(c => c.content),
                config.openaiApiKey!
              );

              await vectorDb.upsert(batch, embeddings);
              await ftsDb.upsert(batch);

              totalChunks += batch.length;
              console.log(`  Indexed batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(result.chunks.length / EMBEDDING_BATCH_SIZE)}`);
            }

            // Update page hashes for GitHub files
            for (const url of newUrls) {
              const chunkCount = result.chunks.filter(c => c.url === url).length;
              await ftsDb.setPageHash(url, config.project, `github:${result.sourceId}:${url}`, chunkCount);
            }
          }

          console.log(`\nSource ${result.sourceId} stats:`);
          console.log(`  Files: ${result.stats.totalFiles}`);
          console.log(`  Indexed: ${result.stats.indexed}`);
          console.log(`  Skipped: ${result.stats.skipped}`);
        }

        console.log(`\n✓ Intelligent GitHub scraping complete`);
      } catch (error) {
        console.error('⚠ Intelligent GitHub scraping failed:', error instanceof Error ? error.message : error);
      }
    }
  } else if (config.github) {
    // Legacy scraper (backward compatibility)
    console.log('\n' + '='.repeat(60));
    console.log(`Scraping Source Code from GitHub (Legacy): ${config.github.repo}`);
    console.log('='.repeat(60));

    try {
      const sourceChunks = await scrapeGitHubSource({
        config: config.github,
        token: config.githubToken,
        project: config.project
      });
      assignChunkSequence(sourceChunks);

      if (sourceChunks.length > 0) {
        console.log(`\nIndexing ${sourceChunks.length} source code chunks...`);

        // Get unique URLs from new chunks and delete old chunks for those URLs
        const newUrls = [...new Set(sourceChunks.map(c => c.url))];
        console.log(`  Deleting old chunks for ${newUrls.length} URLs...`);
        for (const url of newUrls) {
          await vectorDb.deleteByUrl(url);
          await ftsDb.deleteByUrl(url);
          visitedUrls.add(url);
        }

        // Process in batches
        for (let i = 0; i < sourceChunks.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = sourceChunks.slice(i, i + EMBEDDING_BATCH_SIZE);

          const embeddings = await generateEmbeddings(
            batch.map(c => c.content),
            config.openaiApiKey!
          );

          await vectorDb.upsert(batch, embeddings);
          await ftsDb.upsert(batch);

          totalChunks += batch.length;
          console.log(`  Indexed source batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(sourceChunks.length / EMBEDDING_BATCH_SIZE)}`);
        }

        // Update page hashes for GitHub files
        for (const url of newUrls) {
          const chunkCount = sourceChunks.filter(c => c.url === url).length;
          await ftsDb.setPageHash(url, config.project, `github:legacy:${url}`, chunkCount);
        }

        console.log(`  ✓ Source code indexing complete`);
      }
    } catch (error) {
      console.error('  ⚠ GitHub source scraping failed:', error instanceof Error ? error.message : error);
      console.error('  Continuing without source code...');
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Scraping Complete!');
  console.log('='.repeat(60));
  console.log(`  Project: ${config.project} (${config.projectName})`);
  console.log(`  Docs crawled: ${config.githubOnly ? 'skipped' : `${processedPages} pages (${skippedPages} unchanged, ${failedPages} failed)`}`);
  console.log(`  GitHub mode: ${useIntelligentScraper ? 'intelligent (registry)' : config.github ? 'legacy' : 'disabled'}`);
  console.log(`  Dry run: ${config.dryRun ? 'yes' : 'no'}`);
  console.log(`  Total chunks indexed: ${totalChunks}`);
  console.log(`  Total time: ${totalTime}s`);
  console.log('='.repeat(60));

  await ftsDb.close();
  await vectorDb.close();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nInterrupted. Exiting...');
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
