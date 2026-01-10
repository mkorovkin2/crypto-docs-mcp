/**
 * Crypto Docs MCP Server v2.0 Demo
 *
 * Simulates how a coding agent would use the LLM-synthesized MCP server.
 * Demonstrates all 5 tools with actual responses.
 *
 * Usage: npx ts-node scripts/demo.ts [project]
 *        npm run demo -- mina
 */

import 'dotenv/config';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';
const PROJECT = process.argv[2] || 'mina';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, ...args: any[]) {
  console.log(color, ...args, colors.reset);
}

function header(text: string) {
  console.log();
  log(colors.blue + colors.bright, '═'.repeat(70));
  log(colors.blue + colors.bright, `  ${text}`);
  log(colors.blue + colors.bright, '═'.repeat(70));
  console.log();
}

function subheader(text: string) {
  console.log();
  log(colors.cyan, `── ${text} ──`);
  console.log();
}

function agentThinks(text: string) {
  log(colors.dim, `  🤖 Agent: "${text}"`);
}

function agentAction(tool: string, args: any) {
  log(colors.yellow, `  → Calling ${tool}(${JSON.stringify(args).slice(0, 80)}${JSON.stringify(args).length > 80 ? '...' : ''})`);
}

function showResult(text: string, maxLines = 30) {
  const lines = text.split('\n').slice(0, maxLines);
  console.log();
  log(colors.green, '  ┌' + '─'.repeat(76) + '┐');
  for (const line of lines) {
    const truncated = line.length > 74 ? line.slice(0, 71) + '...' : line;
    log(colors.green, `  │ ${truncated.padEnd(74)} │`);
  }
  if (text.split('\n').length > maxLines) {
    log(colors.green, `  │ ${'... (truncated)'.padEnd(74)} │`);
  }
  log(colors.green, '  └' + '─'.repeat(76) + '┘');
  console.log();
}

function showFullResult(text: string) {
  console.log();
  console.log(colors.green + '─'.repeat(78) + colors.reset);
  console.log(text);
  console.log(colors.green + '─'.repeat(78) + colors.reset);
  console.log();
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

async function callTool(name: string, args: any): Promise<string> {
  agentAction(name, args);
  const startTime = Date.now();
  const result = await callMCP('tools/call', { name, arguments: args });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(colors.dim, `  ⏱  Completed in ${elapsed}s`);
  return result.content?.[0]?.text || '';
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  header('Crypto Docs MCP Server v2.0 - LLM Synthesis Demo');

  log(colors.dim, `  Target: ${MCP_URL}`);
  log(colors.dim, `  Project: ${PROJECT}`);
  log(colors.dim, `  This demo shows LLM-synthesized answers (not raw chunks!)`);
  console.log();

  // Check server health
  subheader('Step 0: Checking Server');
  try {
    const healthResp = await fetch(`${MCP_URL}/health`);
    if (!healthResp.ok) throw new Error('Server not responding');
    const health = await healthResp.json();
    log(colors.green, `  ✓ Server is running (v${health.version})`);
    log(colors.green, `  ✓ Features: ${health.features?.join(', ') || 'basic'}`);
  } catch (e) {
    log(colors.red, '  ✗ Server not responding. Start it with: npm run server');
    process.exit(1);
  }

  // Initialize MCP
  await callMCP('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'demo-agent', version: '2.0.0' }
  });
  log(colors.green, '  ✓ MCP connection initialized');

  // List tools
  const toolsResult = await callMCP('tools/list');
  log(colors.green, `  ✓ ${toolsResult.tools.length} tools available:`);
  for (const tool of toolsResult.tools) {
    log(colors.dim, `      - ${tool.name}`);
  }

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: List available projects
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 1: List Available Projects');
  agentThinks("First, let me see what documentation projects are available...");

  const projectsResult = await callTool('crypto_list_projects', {});
  showResult(projectsResult, 15);

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO: Build a smart contract
  // ═══════════════════════════════════════════════════════════════════════════

  header(`Scenario: Build a Smart Contract (${PROJECT})`);
  log(colors.magenta, `  User: "Help me build a smart contract on ${PROJECT}"`);

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: crypto_ask_docs - Get synthesized answer about smart contracts
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 2: crypto_ask_docs - Ask How Smart Contracts Work');
  agentThinks(`Let me ask the docs how smart contracts work in ${PROJECT}...`);
  log(colors.dim, `  (This will synthesize an answer from multiple docs!)`);

  const askResult = await callTool('crypto_ask_docs', {
    question: `How do smart contracts work in ${PROJECT}? What are the key concepts I need to understand?`,
    project: PROJECT
  });
  showFullResult(askResult);

  await sleep(2000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: crypto_get_working_example - Get complete code example
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 3: crypto_get_working_example - Get Complete Code');
  agentThinks("Now I need a complete, runnable code example...");
  log(colors.dim, `  (This will create a full example with ALL imports!)`);

  const exampleResult = await callTool('crypto_get_working_example', {
    task: 'create a simple counter smart contract',
    project: PROJECT
  });
  showFullResult(exampleResult);

  await sleep(2000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: crypto_explain_error - Debug an error
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 4: crypto_explain_error - Debug an Error');
  agentThinks("I'm getting an error when trying to deploy...");
  log(colors.dim, `  (This will diagnose the error and suggest fixes!)`);

  const errorResult = await callTool('crypto_explain_error', {
    error: 'transaction verification failed',
    project: PROJECT,
    context: 'deploying a smart contract to devnet'
  });
  showFullResult(errorResult);

  await sleep(2000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5: crypto_search_docs - Raw search for specific info
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 5: crypto_search_docs - Raw Search');
  agentThinks("Let me search for specific info about deployment...");
  log(colors.dim, `  (This returns raw chunks for browsing)`);

  const searchResult = await callTool('crypto_search_docs', {
    query: 'deploy contract network',
    project: PROJECT,
    limit: 3
  });
  showResult(searchResult, 25);

  // Summary
  header('Demo Complete!');

  console.log('  This demo showed the NEW LLM-synthesized MCP server:');
  console.log();
  log(colors.green, '  OLD WAY: Return raw chunks → Agent pieces together answer');
  log(colors.cyan, '  NEW WAY: Server synthesizes complete, actionable answers!');
  console.log();
  console.log('  New tools demonstrated:');
  log(colors.green, '  1. crypto_list_projects       → See available documentation');
  log(colors.green, '  2. crypto_ask_docs            → Ask questions, get SYNTHESIZED answers');
  log(colors.green, '  3. crypto_get_working_example → Get COMPLETE code with all imports');
  log(colors.green, '  4. crypto_explain_error       → Debug errors with specific fixes');
  log(colors.green, '  5. crypto_search_docs         → Raw search when needed');
  console.log();
  log(colors.cyan, `  The agent gets actionable answers, not raw chunks!`);
  console.log();
  log(colors.dim, '  Try with different projects:');
  log(colors.dim, '    npx ts-node scripts/demo.ts mina');
  log(colors.dim, '    npx ts-node scripts/demo.ts solana');
  log(colors.dim, '    npx ts-node scripts/demo.ts cosmos');
  console.log();
}

main().catch(err => {
  log(colors.red, 'Error:', err.message);
  console.error(err);
  process.exit(1);
});
