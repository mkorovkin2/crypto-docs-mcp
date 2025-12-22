#!/usr/bin/env node

import 'dotenv/config';
import { Crawler } from './crawler.js';
import { parseDocumentation } from './parser.js';
import { chunkContent } from './chunker.js';
import {
  VectorDB,
  FullTextDB,
  generateEmbeddings
} from '@mina-docs/shared';

// Configuration with defaults
const config = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantCollection: process.env.QDRANT_COLLECTION || 'mina_docs',
  sqlitePath: process.env.SQLITE_PATH || './data/mina_docs.db',
  openaiApiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.SCRAPER_BASE_URL || 'https://docs.minaprotocol.com',
  concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3'),
  delayMs: parseInt(process.env.SCRAPER_DELAY_MS || '1000'),
  maxPages: parseInt(process.env.SCRAPER_MAX_PAGES || '200')
};

async function main() {
  console.log('='.repeat(60));
  console.log('Mina Documentation Scraper');
  console.log('='.repeat(60));

  // Validate required config
  if (!config.openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Max Pages: ${config.maxPages}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Delay: ${config.delayMs}ms`);
  console.log(`  Qdrant: ${config.qdrantUrl}`);
  console.log(`  SQLite: ${config.sqlitePath}`);

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
    maxPages: config.maxPages
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
      // Parse HTML into chunks
      const rawChunks = parseDocumentation(page.url, page.html);

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

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Scraping Complete!');
  console.log('='.repeat(60));
  console.log(`  Pages processed: ${processedPages}`);
  console.log(`  Pages failed: ${failedPages}`);
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
