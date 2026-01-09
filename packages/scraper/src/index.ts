#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'util';
import { Crawler } from './crawler.js';
import { parseDocumentation } from './parser.js';
import { chunkContent } from './chunker.js';
import { scrapeGitHubSource } from './github-source.js';
import {
  VectorDB,
  FullTextDB,
  generateEmbeddings,
  loadProjectConfig,
  listProjects,
  type ProjectConfig
} from '@mina-docs/shared';

// Parse CLI arguments
const { values: args } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    list: { type: 'boolean', short: 'l' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (args.help) {
  console.log(`
Usage: scrape [options]

Options:
  -p, --project <id>  Project to scrape (required)
  -l, --list          List available projects
  -h, --help          Show this help

Examples:
  npm run scrape -- --project mina
  npm run scrape -- -p solana
  npm run scrape -- --list
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
  // GitHub config
  github: projectConfig.github,
  githubToken: process.env.GITHUB_TOKEN
};

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
  if (config.github) {
    console.log(`  GitHub: ${config.github.repo}@${config.github.branch}`);
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

  // Initialize crawler
  const crawler = new Crawler({
    baseUrl: config.baseUrl,
    concurrency: config.concurrency,
    delayMs: config.delayMs,
    maxPages: config.maxPages,
    excludePatterns: config.excludePatterns,
    userAgent: config.userAgent
  });

  console.log('\nStarting crawl...\n');

  let totalChunks = 0;
  let processedPages = 0;
  let failedPages = 0;
  const startTime = Date.now();

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

  // Crawl and process pages
  for await (const page of crawler.crawl()) {
    processedPages++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${elapsed}s] Processing (${processedPages}/${config.maxPages}): ${page.url}`);

    try {
      // Parse HTML into chunks with project identifier
      const rawChunks = parseDocumentation(page.url, page.html, config.project);

      if (rawChunks.length === 0) {
        console.log(`  ⚠ No content extracted, skipping`);
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
    } catch (error) {
      failedPages++;
      console.error(`  ✗ Error:`, error instanceof Error ? error.message : error);
    }
  }

  // Process remaining chunks
  await processBatch();

  // Scrape GitHub source (if configured)
  if (config.github) {
    console.log('\n' + '='.repeat(60));
    console.log(`Scraping Source Code from GitHub: ${config.github.repo}`);
    console.log('='.repeat(60));

    try {
      const sourceChunks = await scrapeGitHubSource({
        config: config.github,
        token: config.githubToken,
        project: config.project
      });

      if (sourceChunks.length > 0) {
        console.log(`\nIndexing ${sourceChunks.length} source code chunks...`);

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
  console.log(`  Pages processed: ${processedPages}`);
  console.log(`  Pages failed: ${failedPages}`);
  console.log(`  Total chunks indexed: ${totalChunks}`);
  console.log(`  GitHub source: ${config.github ? 'enabled' : 'disabled'}`);
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
