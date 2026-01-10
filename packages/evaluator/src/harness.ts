/**
 * Test execution harness - calls MCP server and collects responses
 */

import type { TestCase, TestResult } from './types.js';
import { validateResponse, validateResponseWithLLM } from './validators/index.js';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

interface MCPResponse {
  content: Array<{ type: string; text: string }>;
}

async function callMCP(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
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

  const data = await response.json() as { error?: { message: string }; result?: unknown };
  if (data.error) {
    throw new Error(`MCP Error: ${data.error.message}`);
  }
  return data.result;
}

function extractMetadata(responseText: string): { confidence: number; sourcesUsed: number; processingTimeMs: number } {
  try {
    const metadataMatch = responseText.match(/<response_metadata>\s*```json\s*([\s\S]*?)\s*```\s*<\/response_metadata>/);
    if (metadataMatch) {
      const metadata = JSON.parse(metadataMatch[1]) as { confidence?: number; sourcesUsed?: number; processingTimeMs?: number };
      return {
        confidence: metadata.confidence || 0,
        sourcesUsed: metadata.sourcesUsed || 0,
        processingTimeMs: metadata.processingTimeMs || 0
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { confidence: 0, sourcesUsed: 0, processingTimeMs: 0 };
}

export async function runTest(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Map tool names to actual MCP tool names
    const toolNameMap: Record<string, string> = {
      'ask_docs': 'crypto_ask_docs',
      'get_working_example': 'crypto_get_working_example',
      'explain_error': 'crypto_explain_error',
      'search_docs': 'crypto_search_docs'
    };

    const toolName = toolNameMap[testCase.tool] || testCase.tool;

    const result = await callMCP('tools/call', {
      name: toolName,
      arguments: {
        ...testCase.input,
        project: testCase.project
      }
    }) as MCPResponse;

    const responseText = result.content?.[0]?.text || '';
    const metadata = extractMetadata(responseText);

    // Run validations (with LLM judge if ground truth provided)
    const hasLLMValidation = testCase.expected.groundTruth || testCase.expected.codeRequirements;
    const validations = hasLLMValidation
      ? await validateResponseWithLLM(responseText, testCase.expected, testCase)
      : validateResponse(responseText, testCase.expected);
    const passed = validations.every(v => v.passed);

    return {
      testCase,
      passed,
      validations,
      response: responseText,
      metadata: {
        confidence: metadata.confidence,
        sourcesUsed: metadata.sourcesUsed,
        processingTimeMs: Date.now() - startTime
      }
    };

  } catch (error) {
    return {
      testCase,
      passed: false,
      validations: [],
      response: '',
      metadata: {
        confidence: 0,
        sourcesUsed: 0,
        processingTimeMs: Date.now() - startTime
      },
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function initializeMCP(): Promise<void> {
  await callMCP('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'evaluator', version: '1.0.0' }
  });
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MCP_URL}/health`);
    const data = await response.json() as { status?: string };
    return data.status === 'ok';
  } catch {
    return false;
  }
}
