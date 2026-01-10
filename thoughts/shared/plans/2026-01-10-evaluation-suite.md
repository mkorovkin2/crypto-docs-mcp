# Crypto Docs MCP Server Evaluation Suite - Implementation Plan

## Overview

Build a comprehensive evaluation suite to measure how effectively the MCP server answers complex questions about Mina Protocol, Solana, and Cosmos SDK documentation. The suite will test retrieval accuracy, answer correctness, code quality, and project-specific knowledge using curated ground-truth datasets.

## Current State Analysis

### Existing Infrastructure
- **Integration Tests** (`scripts/test-integration.ts`): Basic smoke tests that check:
  - Server health and MCP initialization
  - Tool existence (expects 4 tools: `search_documentation`, `get_code_examples`, `explain_concept`, `debug_helper`)
  - Non-empty responses from tools
  - **Gap**: Tests are outdated (tool names don't match current implementation) and only check for response existence, not quality

- **Demo Scripts** (`scripts/demo.ts`): Interactive demos showing tool usage
  - **Gap**: No automated quality assertions

- **Confidence Scoring** (`packages/shared/src/confidence.ts`): Calculates confidence based on:
  - Retrieval score (result count, relevance scores)
  - Coverage score (keyword presence)
  - Answer quality (structure indicators like code blocks, sections)
  - Source consistency
  - **Gap**: No validation against ground truth

- **Code Verifier** (`packages/server/src/utils/code-verifier.ts`): Basic structural checks
  - **Gap**: No syntax validation or execution testing

### Key Discoveries
- Tool names in production: `crypto_ask_docs`, `crypto_get_working_example`, `crypto_explain_error`, `crypto_search_docs`, `crypto_list_projects`
- Supported projects: `mina` (o1js), `solana` (Solana Program Library), `cosmos` (Cosmos SDK)
- LLM synthesis uses GPT-4o with structured prompts requiring citations
- Corrective RAG retries with alternative queries when initial retrieval is poor

## Desired End State

A complete evaluation framework that:
1. Runs automated evaluations against curated test cases per project
2. Measures retrieval precision, answer accuracy, and code correctness
3. Produces quantitative metrics and qualitative reports
4. Identifies specific failure modes and regression patterns
5. Integrates into CI/CD for continuous quality monitoring

### Verification Criteria
- Evaluation suite runs via: `npm run eval` or `npm run eval -- --project mina`
- Produces JSON report with per-test scores and aggregate metrics
- Each test case has expected outputs for validation
- Code examples are syntax-validated per language

## What We're NOT Doing

- **Not executing code**: We validate syntax/structure, not runtime behavior
- **Not using LLM-as-judge initially**: Start with deterministic validation
- **Not testing edge cases like rate limits**: Focus on answer quality
- **Not building a web UI**: CLI reports only

## Implementation Approach

Create a new `packages/evaluator` package that:
1. Loads curated test datasets (YAML/JSON)
2. Calls MCP tools programmatically
3. Validates responses against expected patterns
4. Calculates aggregate metrics
5. Generates structured reports

## Phase 1: Evaluation Framework Scaffolding

### Overview
Set up the evaluator package structure, test harness, and basic infrastructure.

### Changes Required:

#### 1. Create Package Structure
**Directory**: `packages/evaluator/`

```
packages/evaluator/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry point
│   ├── harness.ts            # Test execution harness
│   ├── metrics.ts            # Metric calculations
│   ├── reporter.ts           # Report generation
│   ├── validators/
│   │   ├── index.ts
│   │   ├── retrieval.ts      # Retrieval quality validators
│   │   ├── answer.ts         # Answer content validators
│   │   └── code.ts           # Code syntax validators
│   └── types.ts              # TypeScript types
├── datasets/
│   ├── schema.json           # JSON schema for test cases
│   ├── mina/
│   │   ├── basic.yaml        # Basic questions
│   │   ├── code-examples.yaml
│   │   └── errors.yaml
│   ├── solana/
│   │   └── ...
│   └── cosmos/
│       └── ...
└── reports/                  # Generated reports (gitignored)
```

**File**: `packages/evaluator/package.json`
```json
{
  "name": "@crypto-docs/evaluator",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "eval": "node dist/index.js",
    "eval:mina": "node dist/index.js --project mina",
    "eval:solana": "node dist/index.js --project solana",
    "eval:cosmos": "node dist/index.js --project cosmos"
  },
  "dependencies": {
    "yaml": "^2.3.0",
    "chalk": "^5.3.0",
    "commander": "^11.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**File**: `packages/evaluator/src/types.ts`
```typescript
/**
 * Core types for the evaluation framework
 */

export type Tool = 'ask_docs' | 'get_working_example' | 'explain_error' | 'search_docs';

export type Difficulty = 'basic' | 'intermediate' | 'advanced';

export type ValidationRule =
  | { type: 'contains'; value: string; caseSensitive?: boolean }
  | { type: 'contains_any'; values: string[] }
  | { type: 'contains_all'; values: string[] }
  | { type: 'matches_regex'; pattern: string }
  | { type: 'has_code_block'; language?: string }
  | { type: 'has_import'; module: string }
  | { type: 'min_length'; chars: number }
  | { type: 'has_citation' }
  | { type: 'confidence_above'; threshold: number }
  | { type: 'sources_count'; min: number };

export interface TestCase {
  id: string;
  name: string;
  description: string;
  tool: Tool;
  project: string;
  difficulty: Difficulty;
  input: Record<string, any>;
  expected: {
    validations: ValidationRule[];
    /** Keywords that SHOULD appear in the answer */
    expectedKeywords?: string[];
    /** Keywords that should NOT appear (e.g., wrong project info) */
    forbiddenKeywords?: string[];
    /** For code examples: expected import patterns */
    expectedImports?: string[];
  };
  tags?: string[];
}

export interface TestDataset {
  name: string;
  project: string;
  version: string;
  tests: TestCase[];
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: any;
}

export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  validations: ValidationResult[];
  response: string;
  metadata: {
    confidence: number;
    sourcesUsed: number;
    processingTimeMs: number;
  };
  errorMessage?: string;
}

export interface EvaluationReport {
  timestamp: string;
  project?: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    averageConfidence: number;
    averageProcessingTime: number;
  };
  byDifficulty: Record<Difficulty, {
    total: number;
    passed: number;
    passRate: number;
  }>;
  byTool: Record<Tool, {
    total: number;
    passed: number;
    passRate: number;
  }>;
  results: TestResult[];
  failures: Array<{
    testId: string;
    testName: string;
    failedValidations: ValidationResult[];
  }>;
}
```

**File**: `packages/evaluator/src/harness.ts`
```typescript
/**
 * Test execution harness - calls MCP server and collects responses
 */

import type { TestCase, TestResult, ValidationResult } from './types.js';
import { validateResponse } from './validators/index.js';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

interface MCPResponse {
  content: Array<{ type: string; text: string }>;
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
    throw new Error(`MCP Error: ${data.error.message}`);
  }
  return data.result;
}

function extractMetadata(responseText: string): { confidence: number; sourcesUsed: number; processingTimeMs: number } {
  try {
    const metadataMatch = responseText.match(/<response_metadata>\s*```json\s*([\s\S]*?)\s*```\s*<\/response_metadata>/);
    if (metadataMatch) {
      const metadata = JSON.parse(metadataMatch[1]);
      return {
        confidence: metadata.confidence || 0,
        sourcesUsed: metadata.sourcesUsed || 0,
        processingTimeMs: metadata.processingTimeMs || 0
      };
    }
  } catch (e) {
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

    const result: MCPResponse = await callMCP('tools/call', {
      name: toolName,
      arguments: {
        ...testCase.input,
        project: testCase.project
      }
    });

    const responseText = result.content?.[0]?.text || '';
    const metadata = extractMetadata(responseText);

    // Run validations
    const validations = validateResponse(responseText, testCase.expected);
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
```

### Success Criteria:

#### Automated Verification:
- [ ] Package builds successfully: `npm run build -w packages/evaluator`
- [ ] TypeScript compiles without errors
- [ ] Package exports are correctly configured

#### Manual Verification:
- [ ] Directory structure matches specification
- [ ] Types are comprehensive for all test scenarios

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Validation Engine

### Overview
Implement the core validation rules that check response quality.

### Changes Required:

**File**: `packages/evaluator/src/validators/index.ts`
```typescript
import type { ValidationRule, ValidationResult, TestCase } from '../types.js';
import { validateRetrieval } from './retrieval.js';
import { validateAnswer } from './answer.js';
import { validateCode } from './code.js';

export function validateResponse(
  response: string,
  expected: TestCase['expected']
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Run all validation rules
  for (const rule of expected.validations) {
    results.push(runValidation(response, rule));
  }

  // Check expected keywords
  if (expected.expectedKeywords) {
    for (const keyword of expected.expectedKeywords) {
      const found = response.toLowerCase().includes(keyword.toLowerCase());
      results.push({
        rule: { type: 'contains', value: keyword },
        passed: found,
        message: found
          ? `Found expected keyword: "${keyword}"`
          : `Missing expected keyword: "${keyword}"`
      });
    }
  }

  // Check forbidden keywords (e.g., wrong project info)
  if (expected.forbiddenKeywords) {
    for (const keyword of expected.forbiddenKeywords) {
      const found = response.toLowerCase().includes(keyword.toLowerCase());
      results.push({
        rule: { type: 'contains', value: keyword },
        passed: !found,
        message: found
          ? `Found forbidden keyword: "${keyword}" (should not appear)`
          : `Correctly avoided forbidden keyword: "${keyword}"`
      });
    }
  }

  // Check expected imports for code examples
  if (expected.expectedImports) {
    for (const importPattern of expected.expectedImports) {
      const found = response.includes(importPattern);
      results.push({
        rule: { type: 'has_import', module: importPattern },
        passed: found,
        message: found
          ? `Found expected import: "${importPattern}"`
          : `Missing expected import: "${importPattern}"`
      });
    }
  }

  return results;
}

function runValidation(response: string, rule: ValidationRule): ValidationResult {
  switch (rule.type) {
    case 'contains':
      return validateContains(response, rule.value, rule.caseSensitive);

    case 'contains_any':
      return validateContainsAny(response, rule.values);

    case 'contains_all':
      return validateContainsAll(response, rule.values);

    case 'matches_regex':
      return validateRegex(response, rule.pattern);

    case 'has_code_block':
      return validateCode.hasCodeBlock(response, rule.language);

    case 'has_import':
      return validateCode.hasImport(response, rule.module);

    case 'min_length':
      return validateAnswer.minLength(response, rule.chars);

    case 'has_citation':
      return validateAnswer.hasCitation(response);

    case 'confidence_above':
      return validateRetrieval.confidenceAbove(response, rule.threshold);

    case 'sources_count':
      return validateRetrieval.sourcesCount(response, rule.min);

    default:
      return {
        rule,
        passed: false,
        message: `Unknown validation rule type`
      };
  }
}

function validateContains(response: string, value: string, caseSensitive = false): ValidationResult {
  const text = caseSensitive ? response : response.toLowerCase();
  const search = caseSensitive ? value : value.toLowerCase();
  const found = text.includes(search);

  return {
    rule: { type: 'contains', value, caseSensitive },
    passed: found,
    message: found ? `Contains "${value}"` : `Does not contain "${value}"`
  };
}

function validateContainsAny(response: string, values: string[]): ValidationResult {
  const lowerResponse = response.toLowerCase();
  const found = values.find(v => lowerResponse.includes(v.toLowerCase()));

  return {
    rule: { type: 'contains_any', values },
    passed: !!found,
    message: found
      ? `Contains "${found}"`
      : `Does not contain any of: ${values.join(', ')}`
  };
}

function validateContainsAll(response: string, values: string[]): ValidationResult {
  const lowerResponse = response.toLowerCase();
  const missing = values.filter(v => !lowerResponse.includes(v.toLowerCase()));

  return {
    rule: { type: 'contains_all', values },
    passed: missing.length === 0,
    message: missing.length === 0
      ? `Contains all required values`
      : `Missing: ${missing.join(', ')}`
  };
}

function validateRegex(response: string, pattern: string): ValidationResult {
  try {
    const regex = new RegExp(pattern, 'i');
    const matches = regex.test(response);

    return {
      rule: { type: 'matches_regex', pattern },
      passed: matches,
      message: matches
        ? `Matches pattern: ${pattern}`
        : `Does not match pattern: ${pattern}`
    };
  } catch (e) {
    return {
      rule: { type: 'matches_regex', pattern },
      passed: false,
      message: `Invalid regex pattern: ${pattern}`
    };
  }
}
```

**File**: `packages/evaluator/src/validators/retrieval.ts`
```typescript
import type { ValidationResult } from '../types.js';

export const validateRetrieval = {
  confidenceAbove(response: string, threshold: number): ValidationResult {
    const metadataMatch = response.match(/"confidence":\s*(\d+)/);
    const confidence = metadataMatch ? parseInt(metadataMatch[1], 10) : 0;

    return {
      rule: { type: 'confidence_above', threshold },
      passed: confidence >= threshold,
      message: `Confidence: ${confidence} (threshold: ${threshold})`,
      details: { confidence }
    };
  },

  sourcesCount(response: string, min: number): ValidationResult {
    const metadataMatch = response.match(/"sourcesUsed":\s*(\d+)/);
    const count = metadataMatch ? parseInt(metadataMatch[1], 10) : 0;

    return {
      rule: { type: 'sources_count', min },
      passed: count >= min,
      message: `Sources used: ${count} (minimum: ${min})`,
      details: { sourcesUsed: count }
    };
  }
};
```

**File**: `packages/evaluator/src/validators/answer.ts`
```typescript
import type { ValidationResult } from '../types.js';

export const validateAnswer = {
  minLength(response: string, chars: number): ValidationResult {
    // Strip metadata block for length check
    const answerOnly = response.split('<response_metadata>')[0].trim();
    const length = answerOnly.length;

    return {
      rule: { type: 'min_length', chars },
      passed: length >= chars,
      message: `Response length: ${length} chars (minimum: ${chars})`,
      details: { length }
    };
  },

  hasCitation(response: string): ValidationResult {
    // Check for [Source N] or [N] citation patterns
    const hasCitation = /\[Source\s*\d+\]|\[\d+\]/.test(response);

    return {
      rule: { type: 'has_citation' },
      passed: hasCitation,
      message: hasCitation
        ? 'Contains source citations'
        : 'Missing source citations'
    };
  }
};
```

**File**: `packages/evaluator/src/validators/code.ts`
```typescript
import type { ValidationResult } from '../types.js';

export const validateCode = {
  hasCodeBlock(response: string, language?: string): ValidationResult {
    const codeBlockRegex = language
      ? new RegExp(`\`\`\`${language}[\\s\\S]*?\`\`\``, 'i')
      : /```[\s\S]*?```/;

    const hasBlock = codeBlockRegex.test(response);

    return {
      rule: { type: 'has_code_block', language },
      passed: hasBlock,
      message: hasBlock
        ? `Contains ${language || 'code'} block`
        : `Missing ${language || 'code'} block`
    };
  },

  hasImport(response: string, module: string): ValidationResult {
    // Check for various import patterns across languages
    const patterns = [
      // TypeScript/JavaScript
      new RegExp(`import\\s+.*\\s+from\\s+['"\`]${escapeRegex(module)}['"\`]`, 'i'),
      new RegExp(`import\\s+['"\`]${escapeRegex(module)}['"\`]`, 'i'),
      new RegExp(`require\\s*\\(\\s*['"\`]${escapeRegex(module)}['"\`]\\s*\\)`, 'i'),
      // Rust
      new RegExp(`use\\s+${escapeRegex(module)}`, 'i'),
      // Go
      new RegExp(`import\\s+.*["']${escapeRegex(module)}["']`, 'i'),
    ];

    const found = patterns.some(p => p.test(response));

    return {
      rule: { type: 'has_import', module },
      passed: found,
      message: found
        ? `Found import for "${module}"`
        : `Missing import for "${module}"`
    };
  },

  /**
   * Validate TypeScript/JavaScript syntax (basic checks)
   */
  validateTypeScriptSyntax(code: string): ValidationResult {
    const issues: string[] = [];

    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    // Check for common syntax errors
    if (/,\s*}/.test(code) && !/,\s*}\s*$/.test(code)) {
      issues.push('Trailing comma before closing brace');
    }

    return {
      rule: { type: 'matches_regex', pattern: 'typescript-syntax' },
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'TypeScript syntax appears valid'
        : `Syntax issues: ${issues.join('; ')}`,
      details: { issues }
    };
  }
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Package builds successfully: `npm run build -w packages/evaluator`
- [ ] All validator modules export correctly

#### Manual Verification:
- [ ] Test validators against sample responses
- [ ] Verify regex patterns work for actual MCP responses

**Implementation Note**: After completing this phase, pause for manual validation testing before proceeding to Phase 3.

---

## Phase 3: Test Datasets

### Overview
Create curated test datasets for each supported project with ground-truth expectations.

### Changes Required:

**File**: `packages/evaluator/datasets/schema.json`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "project", "version", "tests"],
  "properties": {
    "name": { "type": "string" },
    "project": { "type": "string", "enum": ["mina", "solana", "cosmos"] },
    "version": { "type": "string" },
    "tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "tool", "difficulty", "input", "expected"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "tool": { "type": "string", "enum": ["ask_docs", "get_working_example", "explain_error", "search_docs"] },
          "project": { "type": "string" },
          "difficulty": { "type": "string", "enum": ["basic", "intermediate", "advanced"] },
          "input": { "type": "object" },
          "expected": {
            "type": "object",
            "properties": {
              "validations": { "type": "array" },
              "expectedKeywords": { "type": "array", "items": { "type": "string" } },
              "forbiddenKeywords": { "type": "array", "items": { "type": "string" } },
              "expectedImports": { "type": "array", "items": { "type": "string" } }
            }
          },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

**File**: `packages/evaluator/datasets/mina/basic.yaml`
```yaml
name: "Mina Protocol - Basic Questions"
project: "mina"
version: "1.0.0"
tests:
  # === ASK_DOCS Tests ===
  - id: "mina-basic-001"
    name: "What is o1js?"
    description: "Basic conceptual question about the core framework"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is o1js and what is it used for?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
        - type: "confidence_above"
          threshold: 40
      expectedKeywords:
        - "zero-knowledge"
        - "zkapp"
        - "mina"
        - "proof"
      forbiddenKeywords:
        - "solana"
        - "cosmos"
        - "anchor"
    tags: ["concept", "intro"]

  - id: "mina-basic-002"
    name: "What is a zkApp?"
    description: "Core concept explanation"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is a zkApp in Mina Protocol?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
        - type: "contains_any"
          values: ["smart contract", "zero-knowledge", "proof"]
      expectedKeywords:
        - "zkapp"
        - "state"
      forbiddenKeywords:
        - "solana"
        - "cosmos"
    tags: ["concept", "zkapp"]

  - id: "mina-basic-003"
    name: "Field type explanation"
    description: "Core primitive type"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is the Field type in o1js and how is it used?"
    expected:
      validations:
        - type: "min_length"
          chars: 150
        - type: "has_citation"
        - type: "contains_any"
          values: ["field element", "finite field", "arithmetic", "prime"]
      expectedKeywords:
        - "field"
    tags: ["types", "primitives"]

  # === GET_WORKING_EXAMPLE Tests ===
  - id: "mina-basic-004"
    name: "Simple counter zkApp"
    description: "Basic code example request"
    tool: "get_working_example"
    difficulty: "basic"
    input:
      task: "create a simple counter smart contract that increments a number"
    expected:
      validations:
        - type: "has_code_block"
          language: "typescript"
        - type: "min_length"
          chars: 500
        - type: "contains"
          value: "SmartContract"
        - type: "contains"
          value: "@state"
        - type: "contains"
          value: "@method"
      expectedKeywords:
        - "state"
        - "increment"
        - "field"
      expectedImports:
        - "o1js"
    tags: ["code", "counter", "beginner"]

  - id: "mina-basic-005"
    name: "Deploy zkApp example"
    description: "Deployment code request"
    tool: "get_working_example"
    difficulty: "intermediate"
    input:
      task: "deploy a zkApp to the Mina devnet"
    expected:
      validations:
        - type: "has_code_block"
          language: "typescript"
        - type: "min_length"
          chars: 400
        - type: "contains_any"
          values: ["deploy", "Mina.setActiveInstance", "transaction"]
      expectedKeywords:
        - "private key"
        - "deploy"
      expectedImports:
        - "o1js"
    tags: ["code", "deploy", "network"]

  # === EXPLAIN_ERROR Tests ===
  - id: "mina-basic-006"
    name: "Proof verification error"
    description: "Common error explanation"
    tool: "explain_error"
    difficulty: "basic"
    input:
      error: "Proof verification failed"
      context: "trying to submit a transaction after calling a zkApp method"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "contains_any"
          values: ["proof", "verify", "constraint", "circuit"]
      expectedKeywords:
        - "proof"
    tags: ["error", "proof"]

  - id: "mina-basic-007"
    name: "State precondition error"
    description: "State-related error"
    tool: "explain_error"
    difficulty: "intermediate"
    input:
      error: "State precondition check failed"
      context: "updating zkApp state"
    expected:
      validations:
        - type: "min_length"
          chars: 150
        - type: "contains_any"
          values: ["precondition", "state", "assert", "require"]
    tags: ["error", "state"]

  # === SEARCH_DOCS Tests ===
  - id: "mina-basic-008"
    name: "Search for Merkle tree"
    description: "Raw documentation search"
    tool: "search_docs"
    difficulty: "basic"
    input:
      query: "Merkle tree implementation"
      limit: 5
    expected:
      validations:
        - type: "sources_count"
          min: 2
        - type: "contains_any"
          values: ["merkle", "tree", "MerkleTree"]
    tags: ["search", "data-structures"]
```

**File**: `packages/evaluator/datasets/mina/advanced.yaml`
```yaml
name: "Mina Protocol - Advanced Questions"
project: "mina"
version: "1.0.0"
tests:
  - id: "mina-adv-001"
    name: "Recursive proof composition"
    description: "Advanced ZK concept"
    tool: "ask_docs"
    difficulty: "advanced"
    input:
      question: "How do I create recursive proofs in o1js using ZkProgram?"
    expected:
      validations:
        - type: "min_length"
          chars: 400
        - type: "has_code_block"
          language: "typescript"
        - type: "has_citation"
        - type: "confidence_above"
          threshold: 30
      expectedKeywords:
        - "zkprogram"
        - "recursive"
        - "proof"
        - "verify"
      expectedImports:
        - "o1js"
    tags: ["advanced", "recursion", "proofs"]

  - id: "mina-adv-002"
    name: "Custom token implementation"
    description: "Token standard implementation"
    tool: "get_working_example"
    difficulty: "advanced"
    input:
      task: "create a custom fungible token with transfer and mint methods"
    expected:
      validations:
        - type: "has_code_block"
          language: "typescript"
        - type: "min_length"
          chars: 600
        - type: "contains_all"
          values: ["SmartContract", "mint", "transfer"]
        - type: "contains"
          value: "TokenContract"
      expectedKeywords:
        - "token"
        - "balance"
      expectedImports:
        - "o1js"
    tags: ["advanced", "tokens", "code"]

  - id: "mina-adv-003"
    name: "Actions and reducer pattern"
    description: "Event sourcing pattern"
    tool: "ask_docs"
    difficulty: "advanced"
    input:
      question: "How do actions and reducers work in Mina zkApps?"
    expected:
      validations:
        - type: "min_length"
          chars: 300
        - type: "has_citation"
        - type: "contains_any"
          values: ["action", "reducer", "dispatch", "reduce"]
      expectedKeywords:
        - "action"
        - "state"
    tags: ["advanced", "patterns", "actions"]
```

**File**: `packages/evaluator/datasets/solana/basic.yaml`
```yaml
name: "Solana - Basic Questions"
project: "solana"
version: "1.0.0"
tests:
  - id: "sol-basic-001"
    name: "What is Solana?"
    description: "Basic intro question"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is Solana and how does it differ from other blockchains?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
      expectedKeywords:
        - "solana"
        - "transaction"
      forbiddenKeywords:
        - "mina"
        - "zkapp"
        - "cosmos"
        - "o1js"
    tags: ["concept", "intro"]

  - id: "sol-basic-002"
    name: "SPL Token overview"
    description: "Token program explanation"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is the SPL Token program and how do I use it?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
        - type: "contains_any"
          values: ["spl", "token", "mint", "transfer"]
      expectedKeywords:
        - "token"
        - "spl"
      forbiddenKeywords:
        - "mina"
        - "o1js"
    tags: ["tokens", "spl"]

  - id: "sol-basic-003"
    name: "Create SPL token example"
    description: "Token creation code"
    tool: "get_working_example"
    difficulty: "intermediate"
    input:
      task: "create a new SPL token and mint tokens to an account"
    expected:
      validations:
        - type: "has_code_block"
        - type: "min_length"
          chars: 400
        - type: "contains_any"
          values: ["mint", "token", "createMint"]
      forbiddenKeywords:
        - "o1js"
        - "SmartContract"
    tags: ["code", "tokens"]

  - id: "sol-basic-004"
    name: "Transaction error"
    description: "Common transaction error"
    tool: "explain_error"
    difficulty: "basic"
    input:
      error: "Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1"
      context: "trying to transfer SPL tokens"
    expected:
      validations:
        - type: "min_length"
          chars: 150
        - type: "contains_any"
          values: ["error", "instruction", "token", "transfer"]
      forbiddenKeywords:
        - "proof verification"
        - "zkapp"
    tags: ["error", "transaction"]
```

**File**: `packages/evaluator/datasets/cosmos/basic.yaml`
```yaml
name: "Cosmos SDK - Basic Questions"
project: "cosmos"
version: "1.0.0"
tests:
  - id: "cosmos-basic-001"
    name: "What is Cosmos SDK?"
    description: "Basic intro question"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is the Cosmos SDK and what is it used for?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
      expectedKeywords:
        - "cosmos"
        - "blockchain"
      forbiddenKeywords:
        - "mina"
        - "solana"
        - "o1js"
        - "anchor"
    tags: ["concept", "intro"]

  - id: "cosmos-basic-002"
    name: "IBC protocol explanation"
    description: "Inter-blockchain communication"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "What is IBC (Inter-Blockchain Communication) in Cosmos?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
        - type: "contains_any"
          values: ["ibc", "inter-blockchain", "communication", "transfer"]
      expectedKeywords:
        - "ibc"
        - "chain"
      forbiddenKeywords:
        - "mina"
        - "solana"
    tags: ["ibc", "protocol"]

  - id: "cosmos-basic-003"
    name: "Bank module usage"
    description: "Core module explanation"
    tool: "ask_docs"
    difficulty: "basic"
    input:
      question: "How does the bank module work in Cosmos SDK?"
    expected:
      validations:
        - type: "min_length"
          chars: 200
        - type: "has_citation"
        - type: "contains_any"
          values: ["bank", "transfer", "balance", "coin"]
      expectedKeywords:
        - "bank"
        - "module"
      forbiddenKeywords:
        - "mina"
        - "solana"
    tags: ["modules", "bank"]

  - id: "cosmos-basic-004"
    name: "Staking module code"
    description: "Staking implementation"
    tool: "get_working_example"
    difficulty: "intermediate"
    input:
      task: "delegate tokens to a validator using the staking module"
    expected:
      validations:
        - type: "has_code_block"
        - type: "min_length"
          chars: 300
        - type: "contains_any"
          values: ["delegate", "stake", "validator"]
      forbiddenKeywords:
        - "o1js"
        - "SmartContract"
        - "anchor"
    tags: ["code", "staking"]
```

### Success Criteria:

#### Automated Verification:
- [ ] YAML files parse without errors
- [ ] All test IDs are unique
- [ ] All referenced tools exist

#### Manual Verification:
- [ ] Test cases cover key documentation topics
- [ ] Expected keywords are accurate for each project
- [ ] Forbidden keywords correctly identify cross-project contamination

**Implementation Note**: After completing test datasets, pause for review of coverage and accuracy before proceeding to Phase 4.

---

## Phase 4: Report Generation & CLI

### Overview
Implement metrics calculation, report generation, and CLI interface.

### Changes Required:

**File**: `packages/evaluator/src/metrics.ts`
```typescript
import type { TestResult, EvaluationReport, Difficulty, Tool } from './types.js';

export function calculateMetrics(results: TestResult[]): EvaluationReport {
  const timestamp = new Date().toISOString();

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  const confidences = results
    .filter(r => r.metadata.confidence > 0)
    .map(r => r.metadata.confidence);

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const avgProcessingTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.metadata.processingTimeMs, 0) / results.length
    : 0;

  // By difficulty
  const byDifficulty = calculateByDifficulty(results);

  // By tool
  const byTool = calculateByTool(results);

  // Failures detail
  const failures = results
    .filter(r => !r.passed)
    .map(r => ({
      testId: r.testCase.id,
      testName: r.testCase.name,
      failedValidations: r.validations.filter(v => !v.passed)
    }));

  return {
    timestamp,
    summary: {
      totalTests: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      averageConfidence: Math.round(avgConfidence),
      averageProcessingTime: Math.round(avgProcessingTime)
    },
    byDifficulty,
    byTool,
    results,
    failures
  };
}

function calculateByDifficulty(results: TestResult[]): EvaluationReport['byDifficulty'] {
  const difficulties: Difficulty[] = ['basic', 'intermediate', 'advanced'];
  const byDifficulty: EvaluationReport['byDifficulty'] = {} as any;

  for (const diff of difficulties) {
    const filtered = results.filter(r => r.testCase.difficulty === diff);
    const passed = filtered.filter(r => r.passed).length;

    byDifficulty[diff] = {
      total: filtered.length,
      passed,
      passRate: filtered.length > 0 ? (passed / filtered.length) * 100 : 0
    };
  }

  return byDifficulty;
}

function calculateByTool(results: TestResult[]): EvaluationReport['byTool'] {
  const tools: Tool[] = ['ask_docs', 'get_working_example', 'explain_error', 'search_docs'];
  const byTool: EvaluationReport['byTool'] = {} as any;

  for (const tool of tools) {
    const filtered = results.filter(r => r.testCase.tool === tool);
    const passed = filtered.filter(r => r.passed).length;

    byTool[tool] = {
      total: filtered.length,
      passed,
      passRate: filtered.length > 0 ? (passed / filtered.length) * 100 : 0
    };
  }

  return byTool;
}
```

**File**: `packages/evaluator/src/reporter.ts`
```typescript
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { EvaluationReport, TestResult } from './types.js';

export async function printReport(report: EvaluationReport): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log(chalk.bold.blue('  Crypto Docs MCP Server - Evaluation Report'));
  console.log('='.repeat(70));

  // Summary
  console.log('\n' + chalk.bold('Summary:'));
  console.log(`  Total Tests:      ${report.summary.totalTests}`);
  console.log(`  Passed:           ${chalk.green(report.summary.passed)}`);
  console.log(`  Failed:           ${chalk.red(report.summary.failed)}`);
  console.log(`  Pass Rate:        ${formatPassRate(report.summary.passRate)}`);
  console.log(`  Avg Confidence:   ${report.summary.averageConfidence}%`);
  console.log(`  Avg Response Time: ${report.summary.averageProcessingTime}ms`);

  // By Difficulty
  console.log('\n' + chalk.bold('By Difficulty:'));
  for (const [diff, stats] of Object.entries(report.byDifficulty)) {
    if (stats.total > 0) {
      console.log(`  ${diff.padEnd(15)} ${stats.passed}/${stats.total} (${formatPassRate(stats.passRate)})`);
    }
  }

  // By Tool
  console.log('\n' + chalk.bold('By Tool:'));
  for (const [tool, stats] of Object.entries(report.byTool)) {
    if (stats.total > 0) {
      console.log(`  ${tool.padEnd(20)} ${stats.passed}/${stats.total} (${formatPassRate(stats.passRate)})`);
    }
  }

  // Failures
  if (report.failures.length > 0) {
    console.log('\n' + chalk.bold.red('Failures:'));
    for (const failure of report.failures) {
      console.log(`\n  ${chalk.red('✗')} ${failure.testId}: ${failure.testName}`);
      for (const validation of failure.failedValidations) {
        console.log(`    - ${validation.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Report generated: ${report.timestamp}`);
  console.log('='.repeat(70) + '\n');
}

function formatPassRate(rate: number): string {
  const formatted = `${rate.toFixed(1)}%`;
  if (rate >= 80) return chalk.green(formatted);
  if (rate >= 60) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

export async function saveReport(report: EvaluationReport, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(chalk.dim(`Report saved to: ${outputPath}`));
}

export function printProgress(current: number, total: number, testName: string, passed: boolean): void {
  const status = passed ? chalk.green('✓') : chalk.red('✗');
  const progress = `[${current}/${total}]`;
  console.log(`  ${status} ${chalk.dim(progress)} ${testName}`);
}
```

**File**: `packages/evaluator/src/index.ts`
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';

import type { TestDataset, TestResult } from './types.js';
import { runTest, initializeMCP } from './harness.js';
import { calculateMetrics } from './metrics.js';
import { printReport, saveReport, printProgress } from './reporter.js';

const program = new Command();

program
  .name('evaluator')
  .description('Evaluate Crypto Docs MCP Server quality')
  .version('1.0.0')
  .option('-p, --project <project>', 'Evaluate specific project (mina, solana, cosmos)')
  .option('-t, --tag <tag>', 'Filter tests by tag')
  .option('-d, --difficulty <level>', 'Filter by difficulty (basic, intermediate, advanced)')
  .option('-o, --output <path>', 'Save JSON report to file')
  .option('--verbose', 'Show detailed output')
  .option('--fail-fast', 'Stop on first failure')
  .action(async (options) => {
    try {
      await runEvaluation(options);
    } catch (error) {
      console.error(chalk.red('Evaluation failed:'), error);
      process.exit(1);
    }
  });

async function loadDatasets(projectFilter?: string): Promise<TestDataset[]> {
  const datasetsDir = path.join(import.meta.dirname, '..', 'datasets');
  const datasets: TestDataset[] = [];

  const projects = projectFilter
    ? [projectFilter]
    : ['mina', 'solana', 'cosmos'];

  for (const project of projects) {
    const projectDir = path.join(datasetsDir, project);

    try {
      const files = await fs.readdir(projectDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const content = await fs.readFile(path.join(projectDir, file), 'utf-8');
        const dataset = parseYaml(content) as TestDataset;

        // Ensure project is set on all tests
        dataset.tests = dataset.tests.map(t => ({
          ...t,
          project: t.project || dataset.project
        }));

        datasets.push(dataset);
      }
    } catch (e) {
      // Directory might not exist yet
    }
  }

  return datasets;
}

async function runEvaluation(options: {
  project?: string;
  tag?: string;
  difficulty?: string;
  output?: string;
  verbose?: boolean;
  failFast?: boolean;
}): Promise<void> {
  console.log(chalk.bold('\nCrypto Docs MCP Server - Evaluation Suite\n'));

  // Load datasets
  console.log(chalk.dim('Loading test datasets...'));
  const datasets = await loadDatasets(options.project);

  if (datasets.length === 0) {
    console.log(chalk.yellow('No test datasets found.'));
    return;
  }

  // Flatten and filter tests
  let tests = datasets.flatMap(d => d.tests);

  if (options.tag) {
    tests = tests.filter(t => t.tags?.includes(options.tag!));
  }

  if (options.difficulty) {
    tests = tests.filter(t => t.difficulty === options.difficulty);
  }

  console.log(chalk.dim(`Found ${tests.length} tests to run.\n`));

  if (tests.length === 0) {
    console.log(chalk.yellow('No tests match the specified filters.'));
    return;
  }

  // Initialize MCP
  console.log(chalk.dim('Connecting to MCP server...'));
  await initializeMCP();
  console.log(chalk.green('✓ Connected\n'));

  // Run tests
  console.log(chalk.bold('Running tests:\n'));
  const results: TestResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = await runTest(test);
    results.push(result);

    printProgress(i + 1, tests.length, `${test.id}: ${test.name}`, result.passed);

    if (options.verbose && !result.passed) {
      for (const v of result.validations.filter(v => !v.passed)) {
        console.log(chalk.dim(`      ${v.message}`));
      }
    }

    if (options.failFast && !result.passed) {
      console.log(chalk.yellow('\n  Stopping early (--fail-fast)'));
      break;
    }
  }

  // Generate report
  const report = calculateMetrics(results);
  report.project = options.project;

  // Print report
  await printReport(report);

  // Save report if requested
  if (options.output) {
    await saveReport(report, options.output);
  } else {
    // Default save location
    const defaultOutput = path.join(
      import.meta.dirname, '..', 'reports',
      `eval-${options.project || 'all'}-${Date.now()}.json`
    );
    await saveReport(report, defaultOutput);
  }

  // Exit with error code if tests failed
  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

program.parse();
```

### Success Criteria:

#### Automated Verification:
- [ ] Package builds: `npm run build -w packages/evaluator`
- [ ] CLI help works: `node packages/evaluator/dist/index.js --help`
- [ ] Can run evaluation: `npm run eval -w packages/evaluator -- --project mina`

#### Manual Verification:
- [ ] Report output is readable and informative
- [ ] JSON report contains all expected fields
- [ ] Progress output updates correctly

**Implementation Note**: After completing Phase 4, run full evaluation against live server to verify end-to-end functionality before proceeding to Phase 5.

---

## Phase 5: Root Package Integration

### Overview
Add evaluation commands to root package.json and update documentation.

### Changes Required:

**File**: `package.json` (root - add to scripts)
```json
{
  "scripts": {
    "eval": "npm run eval -w packages/evaluator",
    "eval:mina": "npm run eval -w packages/evaluator -- --project mina",
    "eval:solana": "npm run eval -w packages/evaluator -- --project solana",
    "eval:cosmos": "npm run eval -w packages/evaluator -- --project cosmos",
    "eval:verbose": "npm run eval -w packages/evaluator -- --verbose"
  }
}
```

**File**: `.gitignore` (add)
```
packages/evaluator/reports/
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run eval` works from root directory
- [ ] Reports directory is gitignored

#### Manual Verification:
- [ ] README is updated with evaluation instructions
- [ ] All evaluation commands work as expected

---

## Testing Strategy

### Unit Tests
- Validator functions with known inputs/outputs
- Metrics calculation with fixed test results
- YAML parsing for dataset loading

### Integration Tests
- Full evaluation run against live server
- Report generation completeness
- CLI argument handling

### Manual Testing Steps
1. Start MCP server with indexed documentation
2. Run `npm run eval:mina`
3. Verify pass rate is reasonable (>50% for basic tests)
4. Check JSON report for completeness
5. Inspect failed tests for valid failure reasons
6. Run with `--verbose` to see detailed validation failures

## Performance Considerations

- Each test case makes 1 MCP call (LLM synthesis)
- Full evaluation (~30 tests) takes ~2-3 minutes
- Consider parallel test execution for larger datasets
- Cache MCP connection across tests

## References

- Existing integration tests: `scripts/test-integration.ts`
- Confidence scoring: `packages/shared/src/confidence.ts`
- Response builder: `packages/server/src/utils/response-builder.ts`
- Tool implementations: `packages/server/src/tools/*.ts`
