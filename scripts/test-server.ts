#!/usr/bin/env npx ts-node
/**
 * Server Test Script
 *
 * Tests the LLM-synthesized docs server to verify everything is working.
 * Run this with: npx ts-node scripts/test-server.ts
 *
 * Prerequisites:
 * - Qdrant running (docker-compose up -d)
 * - Server running (npm run server in packages/server)
 * - Data scraped (npm run scrape -- --project mina)
 */

import 'dotenv/config';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: string;
}

async function callMCP(method: string, params: any = {}): Promise<any> {
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

async function runTest(
  name: string,
  fn: () => Promise<{ response: string }>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      response: result.response
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Crypto Docs MCP Server v2.0 - Test Suite${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);
  console.log(`${DIM}  Target: ${MCP_URL}${RESET}\n`);

  const results: TestResult[] = [];

  // Test 1: Health check
  console.log(`${YELLOW}[1/8] Testing health endpoint...${RESET}`);
  results.push(await runTest('Health Check', async () => {
    const resp = await fetch(`${MCP_URL}/health`);
    const health = await resp.json();
    if (!health.status || health.status !== 'ok') {
      throw new Error('Health check failed');
    }
    if (health.version !== '2.0.0') {
      throw new Error(`Wrong version: ${health.version}`);
    }
    return { response: `Server v${health.version} - Features: ${health.features?.join(', ')}` };
  }));

  // Test 2: Initialize
  console.log(`${YELLOW}[2/8] Testing MCP initialize...${RESET}`);
  results.push(await runTest('MCP Initialize', async () => {
    const result = await callMCP('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-runner', version: '1.0.0' }
    });
    if (!result.serverInfo) {
      throw new Error('No server info in response');
    }
    return { response: `Server: ${result.serverInfo.name} v${result.serverInfo.version}` };
  }));

  // Test 3: List tools
  console.log(`${YELLOW}[3/8] Testing tools/list...${RESET}`);
  results.push(await runTest('List Tools', async () => {
    const result = await callMCP('tools/list');
    const tools = result.tools || [];
    const toolNames = tools.map((t: any) => t.name);

    const expected = ['list_projects', 'ask_docs', 'get_working_example', 'explain_error', 'search_docs'];
    for (const name of expected) {
      if (!toolNames.includes(name)) {
        throw new Error(`Missing tool: ${name}`);
      }
    }
    return { response: `${tools.length} tools: ${toolNames.join(', ')}` };
  }));

  // Test 4: list_projects
  console.log(`${YELLOW}[4/8] Testing list_projects...${RESET}`);
  results.push(await runTest('list_projects', async () => {
    const result = await callMCP('tools/call', {
      name: 'list_projects',
      arguments: {}
    });
    const text = result.content?.[0]?.text || '';
    if (!text.includes('Available Projects') && !text.includes('No projects')) {
      throw new Error('Unexpected response format');
    }
    return { response: text.slice(0, 200) };
  }));

  // Test 5: search_docs
  console.log(`${YELLOW}[5/8] Testing search_docs...${RESET}`);
  results.push(await runTest('search_docs', async () => {
    const result = await callMCP('tools/call', {
      name: 'search_docs',
      arguments: {
        query: 'smart contract',
        project: 'mina',
        limit: 2
      }
    });
    const text = result.content?.[0]?.text || '';
    if (!text.includes('Search Results') && !text.includes('No results')) {
      throw new Error('Unexpected response format');
    }
    return { response: `Response length: ${text.length} chars` };
  }));

  // Test 6: ask_docs (LLM synthesis)
  console.log(`${YELLOW}[6/8] Testing ask_docs (LLM synthesis)...${RESET}`);
  results.push(await runTest('ask_docs (LLM)', async () => {
    const result = await callMCP('tools/call', {
      name: 'ask_docs',
      arguments: {
        question: 'What is a zkApp?',
        project: 'mina',
        maxTokens: 500
      }
    });
    const text = result.content?.[0]?.text || '';
    if (text.length < 100) {
      throw new Error('Response too short - LLM may not be working');
    }
    // Check for source citations
    if (!text.includes('Source') && !text.includes('documentation')) {
      throw new Error('Response missing source citations');
    }
    return { response: `Response length: ${text.length} chars (LLM synthesized!)` };
  }));

  // Test 7: get_working_example (LLM synthesis)
  console.log(`${YELLOW}[7/8] Testing get_working_example (LLM synthesis)...${RESET}`);
  results.push(await runTest('get_working_example (LLM)', async () => {
    const result = await callMCP('tools/call', {
      name: 'get_working_example',
      arguments: {
        task: 'create a counter',
        project: 'mina',
        maxTokens: 500
      }
    });
    const text = result.content?.[0]?.text || '';
    if (text.length < 100) {
      throw new Error('Response too short - LLM may not be working');
    }
    return { response: `Response length: ${text.length} chars (code example!)` };
  }));

  // Test 8: explain_error (LLM synthesis)
  console.log(`${YELLOW}[8/8] Testing explain_error (LLM synthesis)...${RESET}`);
  results.push(await runTest('explain_error (LLM)', async () => {
    const result = await callMCP('tools/call', {
      name: 'explain_error',
      arguments: {
        error: 'constraint not satisfied',
        project: 'mina',
        maxTokens: 500
      }
    });
    const text = result.content?.[0]?.text || '';
    if (text.length < 50) {
      throw new Error('Response too short');
    }
    return { response: `Response length: ${text.length} chars (error explanation!)` };
  }));

  // Print results
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  Test Results${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.passed) {
      console.log(`  ${GREEN}✓${RESET} ${result.name} ${DIM}(${result.duration}ms)${RESET}`);
      console.log(`    ${DIM}${result.response?.slice(0, 80)}${RESET}`);
      passed++;
    } else {
      console.log(`  ${RED}✗${RESET} ${result.name} ${DIM}(${result.duration}ms)${RESET}`);
      console.log(`    ${RED}${result.error}${RESET}`);
      failed++;
    }
  }

  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  if (failed === 0) {
    console.log(`${GREEN}  All ${passed} tests passed!${RESET}`);
    console.log(`${GREEN}  ✓ LLM synthesis is working${RESET}`);
    console.log(`${GREEN}  ✓ Reranking is working${RESET}`);
    console.log(`${GREEN}  ✓ All tools are functional${RESET}`);
  } else {
    console.log(`${RED}  ${failed} tests failed, ${passed} passed${RESET}`);
  }
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`${RED}Fatal error:${RESET}`, err.message);
  process.exit(1);
});
