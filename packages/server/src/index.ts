#!/usr/bin/env node

import 'dotenv/config';
import { VectorDB, FullTextDB, HybridSearch } from '@mina-docs/shared';
import { config, validateConfig } from './config.js';
import { createHttpTransport } from './transport.js';

async function main() {
  console.error('='.repeat(60));
  console.error('Mina Documentation MCP Server');
  console.error('='.repeat(60));

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error(`\nConfiguration Error: ${error instanceof Error ? error.message : error}`);
    console.error('Please ensure .env file is configured correctly.');
    process.exit(1);
  }

  console.error(`\nConfiguration:`);
  console.error(`  Port: ${config.port}`);
  console.error(`  Host: ${config.host}`);
  console.error(`  Qdrant: ${config.qdrant.url}`);
  console.error(`  SQLite: ${config.sqlite.path}`);

  // Initialize databases
  console.error('\nInitializing databases...');

  const vectorDb = new VectorDB({
    url: config.qdrant.url,
    collection: config.qdrant.collection
  });

  const ftsDb = new FullTextDB({
    path: config.sqlite.path
  });

  try {
    await vectorDb.initialize();
    console.error('  ✓ Vector database (Qdrant) connected');
  } catch (error) {
    console.error('  ✗ Failed to connect to Qdrant:', error instanceof Error ? error.message : error);
    console.error('\n  Make sure Qdrant is running: docker-compose up -d');
    process.exit(1);
  }

  try {
    await ftsDb.initialize();
    console.error('  ✓ Full-text search database (SQLite) connected');
  } catch (error) {
    console.error('  ✗ Failed to initialize SQLite:', error);
    process.exit(1);
  }

  // Initialize hybrid search
  const search = new HybridSearch({
    vectorDb,
    ftsDb,
    openaiApiKey: config.openai.apiKey
  });

  console.error('  ✓ Hybrid search initialized');

  // Start HTTP server
  try {
    await createHttpTransport(
      { search, ftsDb },
      config.port,
      config.host
    );
  } catch (error) {
    console.error('Failed to start HTTP server:', error);
    process.exit(1);
  }

  console.error('\n' + '='.repeat(60));
  console.error('Server ready! Available MCP tools:');
  console.error('  - search_documentation: Search Mina docs');
  console.error('  - get_code_examples: Find code examples');
  console.error('  - explain_concept: Explain ZK concepts');
  console.error('  - debug_helper: Debug common errors');
  console.error('='.repeat(60));

  // Graceful shutdown
  const shutdown = async () => {
    console.error('\n\nShutting down...');
    await ftsDb.close();
    await vectorDb.close();
    console.error('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
