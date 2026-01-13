#!/usr/bin/env node

import 'dotenv/config';
import { VectorDB, FullTextDB, HybridSearch, Reranker, LLMClient, WebSearchClient, listProjects } from '@mina-docs/shared';
import { config, validateConfig } from './config.js';
import { createHttpTransport } from './transport.js';

async function main() {
  console.error('='.repeat(60));
  console.error('Crypto Documentation MCP Server v2.0');
  console.error('(LLM-Synthesized Responses)');
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
  console.error(`  LLM Model: ${config.llm.model}`);
  console.error(`  LLM Max Tokens: ${config.llm.maxTokens}`);

  // List available projects
  const projects = listProjects();
  if (projects.length > 0) {
    console.error(`\nConfigured projects: ${projects.join(', ')}`);
  } else {
    console.error('\nWarning: No projects configured in config/projects/');
  }

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

  // Initialize reranker
  const reranker = new Reranker({
    apiKey: config.openai.apiKey
  });
  console.error('  ✓ Reranker initialized');

  // Initialize LLM client for synthesis
  const llmClient = new LLMClient({
    apiKey: config.openai.apiKey,
    model: config.llm.model,
    maxTokens: config.llm.maxTokens,
    temperature: config.llm.temperature
  });
  console.error('  ✓ LLM client initialized');

  // Initialize hybrid search with reranker
  const search = new HybridSearch({
    vectorDb,
    ftsDb,
    openaiApiKey: config.openai.apiKey,
    reranker
  });
  console.error('  ✓ Hybrid search initialized (with reranking)');

  // Initialize web search client if Tavily API key is configured
  let webSearch: WebSearchClient | undefined;
  if (config.tavily.apiKey) {
    webSearch = new WebSearchClient({
      apiKey: config.tavily.apiKey,
      searchDepth: config.tavily.searchDepth,
      maxResults: config.tavily.maxResults
    });
    console.error('  ✓ Web search client initialized (Tavily)');
  } else {
    console.error('  - Web search disabled (no TAVILY_API_KEY)');
  }

  // Log agentic evaluation settings
  if (config.agenticEvaluation.enabled) {
    console.error(`  ✓ Agentic evaluation enabled (max ${config.agenticEvaluation.maxIterations} iterations)`);
  } else {
    console.error('  - Agentic evaluation disabled');
  }

  // Start HTTP server
  try {
    await createHttpTransport(
      { search, ftsDb, llmClient, webSearch },
      config.port,
      config.host
    );
  } catch (error) {
    console.error('Failed to start HTTP server:', error);
    process.exit(1);
  }

  console.error('\n' + '='.repeat(60));
  console.error('Server ready! Available MCP tools:');
  console.error('  - list_projects: List available documentation projects');
  console.error('  - ask_docs: Ask questions, get synthesized answers');
  console.error('  - get_working_example: Get complete code examples');
  console.error('  - explain_error: Debug errors with explanations');
  console.error('  - search_docs: Raw documentation search');
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
