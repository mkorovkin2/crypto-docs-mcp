/**
 * Crypto Docs MCP Server Demo
 *
 * Simulates how a coding agent would use this MCP server to build smart contracts.
 * Demonstrates all 8 tools in a realistic workflow.
 *
 * Usage: npx ts-node scripts/demo.ts [project]
 *        npm run demo -- mina
 *        npm run demo -- solana
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
  log(colors.yellow, `  → Calling ${tool}(${JSON.stringify(args).slice(0, 60)}${JSON.stringify(args).length > 60 ? '...' : ''})`);
}

function showResult(text: string, maxLines = 20) {
  const lines = text.split('\n').slice(0, maxLines);
  console.log();
  log(colors.green, '  ┌' + '─'.repeat(66) + '┐');
  for (const line of lines) {
    const truncated = line.length > 64 ? line.slice(0, 61) + '...' : line;
    log(colors.green, `  │ ${truncated.padEnd(64)} │`);
  }
  if (text.split('\n').length > maxLines) {
    log(colors.green, `  │ ${'... (truncated)'.padEnd(64)} │`);
  }
  log(colors.green, '  └' + '─'.repeat(66) + '┘');
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
  const result = await callMCP('tools/call', { name, arguments: args });
  return result.content?.[0]?.text || '';
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  header('Crypto Docs MCP Server - Agent Simulation Demo');

  log(colors.dim, `  Target: ${MCP_URL}`);
  log(colors.dim, `  Project: ${PROJECT}`);
  log(colors.dim, `  This demo simulates a coding agent building a smart contract.`);
  console.log();

  // Check server health
  subheader('Step 0: Checking Server');
  try {
    const health = await fetch(`${MCP_URL}/health`);
    if (!health.ok) throw new Error('Server not responding');
    log(colors.green, '  ✓ Server is running');
  } catch (e) {
    log(colors.red, '  ✗ Server not responding. Start it with: npm run server');
    process.exit(1);
  }

  // Initialize MCP
  await callMCP('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'demo-agent', version: '1.0.0' }
  });
  log(colors.green, '  ✓ MCP connection initialized');

  // List tools
  const toolsResult = await callMCP('tools/list');
  log(colors.green, `  ✓ ${toolsResult.tools.length} tools available`);

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: List available projects
  // ═══════════════════════════════════════════════════════════════════════════

  subheader('Step 1: List Available Projects');
  agentThinks("First, let me see what documentation projects are available...");

  const projectsResult = await callTool('list_projects', {});
  showResult(projectsResult, 15);

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO: Agent is asked to build a smart contract
  // ═══════════════════════════════════════════════════════════════════════════

  header(`Scenario: Build a Smart Contract (${PROJECT})`);
  log(colors.dim, `  User: "Build me a smart contract on ${PROJECT}"`);

  await sleep(1500);

  // Step 2: Search for how to build a contract
  subheader('Step 2: Research Contract Structure');
  agentThinks(`I need to understand how smart contracts work in ${PROJECT}...`);

  const searchResult = await callTool('search_documentation', {
    query: 'how to create a smart contract',
    project: PROJECT,
    limit: 3
  });
  showResult(searchResult, 15);

  await sleep(1500);

  // Step 3: Get the pattern for a basic contract
  subheader('Step 3: Get Contract Pattern');
  agentThinks("Let me get a working pattern to start from...");

  const patternResult = await callTool('get_pattern', {
    task: 'basic contract',
    project: PROJECT,
    includeVariations: false
  });
  showResult(patternResult, 25);

  await sleep(1500);

  // Step 4: Figure out imports
  subheader('Step 4: Resolve Imports');
  agentThinks("What do I need to import?");

  const importResult = await callTool('resolve_import', {
    symbol: 'Contract',
    project: PROJECT,
    includeRelated: true
  });
  showResult(importResult, 15);

  await sleep(1500);

  // Step 5: Get API signature for specific methods
  subheader('Step 5: Check API Signatures');
  agentThinks("How do I interact with state or storage?");

  const apiResult = await callTool('get_api_signature', {
    className: 'State',
    project: PROJECT
  });
  showResult(apiResult, 12);

  await sleep(1500);

  // Step 6: Agent encounters an error, uses debug helper
  subheader('Step 6: Debug an Error');
  agentThinks("I'm getting an error when deploying...");

  const debugResult = await callTool('debug_helper', {
    error: 'transaction failed',
    project: PROJECT,
    context: 'deploying contract'
  });
  showResult(debugResult, 20);

  await sleep(1500);

  // Step 7: Get code examples for events
  subheader('Step 7: Add Events');
  agentThinks("I want to emit events from my contract...");

  const eventsResult = await callTool('get_code_examples', {
    topic: 'events',
    project: PROJECT,
    limit: 2
  });
  showResult(eventsResult, 20);

  await sleep(1500);

  // Step 8: Understand a concept
  subheader('Step 8: Understand a Concept');
  agentThinks("Let me understand how accounts/programs work...");

  const conceptResult = await callTool('explain_concept', {
    concept: 'account',
    project: PROJECT,
    depth: 'detailed'
  });
  showResult(conceptResult, 20);

  // Summary
  header('Demo Complete!');

  console.log('  This demo showed how a coding agent uses the MCP server to:');
  console.log();
  log(colors.green, '  1. list_projects         → See available documentation');
  log(colors.green, '  2. search_documentation  → Research how contracts work');
  log(colors.green, '  3. get_pattern           → Get working code templates');
  log(colors.green, '  4. resolve_import        → Find correct imports');
  log(colors.green, '  5. get_api_signature     → Get exact method signatures');
  log(colors.green, '  6. debug_helper          → Troubleshoot errors');
  log(colors.green, '  7. get_code_examples     → Find implementation examples');
  log(colors.green, '  8. explain_concept       → Understand concepts');
  console.log();
  log(colors.cyan, `  The agent queries ${PROJECT} docs and writes correct code!`);
  console.log();
  log(colors.dim, '  Try with different projects:');
  log(colors.dim, '    npx ts-node scripts/demo.ts mina');
  log(colors.dim, '    npx ts-node scripts/demo.ts solana');
  log(colors.dim, '    npx ts-node scripts/demo.ts cosmos');
  console.log();
}

main().catch(err => {
  log(colors.red, 'Error:', err.message);
  process.exit(1);
});
