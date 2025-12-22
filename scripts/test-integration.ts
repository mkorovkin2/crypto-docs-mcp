#!/usr/bin/env npx ts-node

/**
 * Integration test script for Mina Docs MCP Server
 *
 * Usage: npm run test:integration
 *
 * Requirements:
 * - Server running at http://localhost:3000
 * - Documentation indexed (run scraper first)
 */

const BASE_URL = process.env.MCP_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function jsonRpc(method: string, params?: any): Promise<any> {
  const response = await fetch(`${BASE_URL}/mcp`, {
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
    throw new Error(`JSON-RPC Error: ${data.error.message}`);
  }

  return data.result;
}

async function testHealthCheck(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(`Unexpected status: ${data.status}`);
    }

    return {
      name: 'Health Check',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Health Check',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testInitialize(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    if (!result.serverInfo?.name) {
      throw new Error('Missing serverInfo');
    }

    return {
      name: 'Initialize',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Initialize',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testToolsList(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('tools/list');

    if (!Array.isArray(result.tools) || result.tools.length !== 4) {
      throw new Error(`Expected 4 tools, got ${result.tools?.length}`);
    }

    const toolNames = result.tools.map((t: any) => t.name);
    const expectedTools = ['search_documentation', 'get_code_examples', 'explain_concept', 'debug_helper'];

    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing tool: ${expected}`);
      }
    }

    return {
      name: 'Tools List',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Tools List',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testSearchDocumentation(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('tools/call', {
      name: 'search_documentation',
      arguments: {
        query: 'how to create a zkApp',
        limit: 3
      }
    });

    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Invalid response format');
    }

    const text = result.content[0]?.text || '';
    if (text.length < 100) {
      throw new Error('Response too short - may indicate empty database');
    }

    return {
      name: 'Search Documentation Tool',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Search Documentation Tool',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testGetCodeExamples(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('tools/call', {
      name: 'get_code_examples',
      arguments: {
        topic: 'SmartContract',
        limit: 2
      }
    });

    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Invalid response format');
    }

    return {
      name: 'Get Code Examples Tool',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Get Code Examples Tool',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testExplainConcept(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('tools/call', {
      name: 'explain_concept',
      arguments: {
        concept: 'zkSNARK',
        depth: 'brief'
      }
    });

    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Invalid response format');
    }

    const text = result.content[0]?.text || '';
    if (!text.toLowerCase().includes('zero-knowledge') && !text.toLowerCase().includes('proof')) {
      throw new Error('Response does not contain expected content');
    }

    return {
      name: 'Explain Concept Tool',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Explain Concept Tool',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testDebugHelper(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('tools/call', {
      name: 'debug_helper',
      arguments: {
        error: 'proof verification failed',
        context: 'deploying a zkApp'
      }
    });

    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Invalid response format');
    }

    const text = result.content[0]?.text || '';
    if (text.length < 200) {
      throw new Error('Response too short');
    }

    return {
      name: 'Debug Helper Tool',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Debug Helper Tool',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function testResourcesList(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await jsonRpc('resources/list');

    if (!Array.isArray(result.resources)) {
      throw new Error('Invalid response format');
    }

    return {
      name: 'Resources List',
      passed: true,
      duration: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'Resources List',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Mina Docs MCP Server - Integration Tests');
  console.log('='.repeat(60));
  console.log(`\nTarget: ${BASE_URL}\n`);

  const results: TestResult[] = [];

  // Run tests sequentially
  console.log('Running tests...\n');

  results.push(await testHealthCheck());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testInitialize());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testToolsList());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testSearchDocumentation());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testGetCodeExamples());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testExplainConcept());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testDebugHelper());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  results.push(await testResourcesList());
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].name}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Results:');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const duration = `(${result.duration}ms)`;
    console.log(`  ${status} ${result.name} ${duration}`);
    if (!result.passed && result.error) {
      console.log(`         Error: ${result.error}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
