/**
 * Mina Docs MCP Server Demo
 *
 * Simulates how a coding agent would use this MCP server to build a zkApp.
 * Demonstrates all 8 tools in a realistic workflow.
 *
 * Usage: npm run demo
 */

import 'dotenv/config';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

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
  header('Mina Docs MCP Server - Agent Simulation Demo');

  log(colors.dim, `  Target: ${MCP_URL}`);
  log(colors.dim, `  This demo simulates a coding agent building a zkApp voting contract.`);
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
  // SCENARIO: Agent is asked to build a voting zkApp with Merkle tree whitelist
  // ═══════════════════════════════════════════════════════════════════════════

  header('Scenario: Build a Voting zkApp with Whitelist');
  log(colors.dim, '  User: "Build me a voting zkApp where only whitelisted addresses can vote"');

  await sleep(1500);

  // Step 1: Search for how to build a zkApp
  subheader('Step 1: Research zkApp Structure');
  agentThinks("I need to understand how zkApps work in Mina...");

  const searchResult = await callTool('search_documentation', {
    query: 'how to create a zkApp smart contract',
    limit: 3
  });
  showResult(searchResult, 15);

  await sleep(1500);

  // Step 2: Get the pattern for a basic contract
  subheader('Step 2: Get Contract Pattern');
  agentThinks("Let me get a working pattern to start from...");

  const patternResult = await callTool('get_pattern', {
    task: 'basic contract',
    includeVariations: false
  });
  showResult(patternResult, 25);

  await sleep(1500);

  // Step 3: Figure out imports
  subheader('Step 3: Resolve Imports');
  agentThinks("What do I need to import for a SmartContract with Merkle proofs?");

  const importResult = await callTool('resolve_import', {
    symbol: 'SmartContract',
    includeRelated: true
  });
  showResult(importResult, 15);

  await sleep(1000);

  // Also get Merkle imports
  agentThinks("And for the whitelist I'll need MerkleTree...");

  const merkleImportResult = await callTool('resolve_import', {
    symbol: 'MerkleTree',
    includeRelated: true
  });
  showResult(merkleImportResult, 12);

  await sleep(1500);

  // Step 4: Get API signature for specific methods
  subheader('Step 4: Check API Signatures');
  agentThinks("How exactly does MerkleWitness.calculateRoot work?");

  const apiResult = await callTool('get_api_signature', {
    className: 'MerkleWitness',
    methodName: 'calculateRoot'
  });
  showResult(apiResult, 12);

  await sleep(1000);

  // Check Field methods too
  agentThinks("And I need to compare Fields... let me check assertEquals");

  const fieldApiResult = await callTool('get_api_signature', {
    className: 'Field',
    methodName: 'assertEquals'
  });
  showResult(fieldApiResult, 10);

  await sleep(1500);

  // Step 5: Get the Merkle membership pattern
  subheader('Step 5: Get Merkle Proof Pattern');
  agentThinks("How do I actually implement Merkle membership verification?");

  const merklePatternResult = await callTool('get_pattern', {
    task: 'merkle membership',
    includeVariations: false
  });
  showResult(merklePatternResult, 30);

  await sleep(1500);

  // Step 6: Agent writes some code, then validates it
  subheader('Step 6: Validate Generated Code');
  agentThinks("Let me write the contract and validate it...");

  const sampleCode = `
import { SmartContract, state, State, method, Field, MerkleWitness, Poseidon, PublicKey } from 'o1js';

class VoterWitness extends MerkleWitness(8) {}

class VotingContract extends SmartContract {
  @state(Field) voterRoot = State<Field>();
  @state(Field) yesVotes = State<Field>();
  @state(Field) noVotes = State<Field>();

  init() {
    super.init();
    this.yesVotes.set(Field(0));
    this.noVotes.set(Field(0));
  }

  @method async vote(voteYes: Bool, witness: VoterWitness) {
    const root = this.voterRoot.get();
    const voter = this.sender.getAndRequireSignature();

    // Verify voter is in whitelist
    const leaf = Poseidon.hash(voter.toFields());
    const calculatedRoot = witness.calculateRoot(leaf);
    calculatedRoot.assertEquals(root);

    // Count vote using if/else
    if (voteYes) {
      const current = this.yesVotes.get();
      this.yesVotes.set(current.add(1));
    } else {
      const current = this.noVotes.get();
      this.noVotes.set(current.add(1));
    }
  }
}`;

  log(colors.dim, '  Code to validate:');
  log(colors.dim, '  ```typescript');
  sampleCode.split('\n').slice(0, 15).forEach(line => {
    log(colors.dim, `  ${line}`);
  });
  log(colors.dim, '  ... (35 lines total)');
  log(colors.dim, '  ```');
  console.log();

  const validateResult = await callTool('validate_zkapp_code', {
    code: sampleCode,
    checkLevel: 'all'
  });
  showResult(validateResult, 25);

  await sleep(1500);

  // Step 7: Agent encounters an error, uses debug helper
  subheader('Step 7: Debug an Error');
  agentThinks("After fixing the if/else, I got a proof verification error...");

  const debugResult = await callTool('debug_helper', {
    error: 'proof verification failed',
    context: 'calling vote() method after deployment'
  });
  showResult(debugResult, 20);

  await sleep(1500);

  // Step 8: Get code examples for emitting events
  subheader('Step 8: Add Vote Events');
  agentThinks("I want to emit events when votes are cast...");

  const eventsResult = await callTool('get_code_examples', {
    topic: 'emit events',
    limit: 2
  });
  showResult(eventsResult, 20);

  await sleep(1500);

  // Step 9: Understand a concept
  subheader('Step 9: Understand Circuit Constraints');
  agentThinks("User is asking why if/else doesn't work. Let me explain...");

  const conceptResult = await callTool('explain_concept', {
    concept: 'provable',
    depth: 'detailed'
  });
  showResult(conceptResult, 20);

  // Summary
  header('Demo Complete!');

  console.log('  This demo showed how a coding agent uses the MCP server to:');
  console.log();
  log(colors.green, '  1. search_documentation  → Research how zkApps work');
  log(colors.green, '  2. get_pattern           → Get working code templates');
  log(colors.green, '  3. resolve_import        → Find correct imports');
  log(colors.green, '  4. get_api_signature     → Get exact method signatures');
  log(colors.green, '  5. validate_zkapp_code   → Check code for mistakes');
  log(colors.green, '  6. debug_helper          → Troubleshoot errors');
  log(colors.green, '  7. get_code_examples     → Find implementation examples');
  log(colors.green, '  8. explain_concept       → Understand ZK concepts');
  console.log();
  log(colors.cyan, '  The agent avoids hallucinating APIs and writes correct o1js code!');
  console.log();
}

main().catch(err => {
  log(colors.red, 'Error:', err.message);
  process.exit(1);
});
