#!/usr/bin/env npx ts-node --esm
/**
 * Test script for Tavily web search
 */

import 'dotenv/config';
import { WebSearchClient } from '../packages/shared/dist/web-search.js';

async function main() {
  console.log('Testing Tavily Web Search...\n');

  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.error('✗ TAVILY_API_KEY not set in environment');
    console.error('  Add TAVILY_API_KEY=tvly-... to your .env file');
    process.exit(1);
  }

  console.log(`API Key: ${apiKey.slice(0, 10)}...`);

  const client = new WebSearchClient({
    apiKey,
    maxResults: 5,
    searchDepth: 'basic',
  });

  console.log('✓ WebSearchClient initialized\n');

  // Test search
  const query = 'Mina Protocol zkApp tutorial';
  console.log(`Searching: "${query}"\n`);

  try {
    const response = await client.search(query, {
      includeAnswer: true,
      maxResults: 5,
    });

    console.log(`Response time: ${response.responseTime}ms`);
    console.log(`Results found: ${response.results.length}`);

    if (response.answer) {
      console.log(`\nTavily Answer:\n${response.answer.slice(0, 200)}...`);
    }

    console.log('\n─'.repeat(50));

    if (response.results.length === 0) {
      console.log('\n⚠️  No results returned!');
      console.log('   This could mean:');
      console.log('   - API key is invalid');
      console.log('   - Rate limit hit');
      console.log('   - Query returned no matches');
    } else {
      console.log('\nResults:');
      for (const r of response.results) {
        console.log(`\n  Title: ${r.title}`);
        console.log(`  URL: ${r.url}`);
        console.log(`  Score: ${r.score}`);
        console.log(`  Content: ${r.content.slice(0, 100)}...`);
      }
    }

    console.log('\n✓ Test complete');

  } catch (error: any) {
    console.error('\n✗ Search failed:', error.message);

    if (error.message.includes('401')) {
      console.error('  Invalid API key');
    } else if (error.message.includes('429')) {
      console.error('  Rate limit exceeded');
    }

    process.exit(1);
  }
}

main();
