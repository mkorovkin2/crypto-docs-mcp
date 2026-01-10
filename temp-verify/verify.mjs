// Real verification script for the new modules
import {
  classifyQuery,
  expandQuery,
  extractKeywords,
  analyzeQuery
} from '../packages/shared/dist/query-analyzer.js';

import {
  shouldUseASTChunking,
  chunkCodeWithAST
} from '../packages/scraper/dist/ast-chunker.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\n  Expected: ${expected}\n  Got: ${actual}`);
  }
}

function assertIncludes(str, substr, msg = '') {
  if (!str.includes(substr)) {
    throw new Error(`${msg}\n  Expected to include: "${substr}"\n  Got: "${str}"`);
  }
}

console.log('\n========================================');
console.log('QUERY ANALYZER TESTS');
console.log('========================================\n');

test('classifyQuery: error detection', () => {
  assertEqual(classifyQuery('TypeError: Field is not defined'), 'error');
});

test('classifyQuery: howto detection', () => {
  assertEqual(classifyQuery('How do I deploy a zkApp?'), 'howto');
});

test('classifyQuery: concept detection', () => {
  assertEqual(classifyQuery('What is a Merkle tree?'), 'concept');
});

test('classifyQuery: code_lookup detection', () => {
  assertEqual(classifyQuery('Show me the `transfer` function'), 'code_lookup');
});

test('classifyQuery: api_reference detection', () => {
  assertEqual(classifyQuery('API reference for State'), 'api_reference');
});

test('classifyQuery: general fallback', () => {
  assertEqual(classifyQuery('Mina protocol'), 'general');
});

test('expandQuery: adds keywords for howto', () => {
  const result = expandQuery('deploy zkApp', 'howto');
  assertIncludes(result, 'deploy zkApp');
  // Should add tutorial or guide
  if (!result.includes('tutorial') && !result.includes('guide')) {
    throw new Error(`Expected expansion keywords, got: ${result}`);
  }
});

test('extractKeywords: backticked terms', () => {
  const result = extractKeywords('Use `Field` and `CircuitString` types');
  if (!result.includes('Field') || !result.includes('CircuitString')) {
    throw new Error(`Expected Field and CircuitString, got: ${JSON.stringify(result)}`);
  }
});

test('extractKeywords: CamelCase terms', () => {
  const result = extractKeywords('The MyZkApp class extends SmartContract');
  if (!result.includes('MyZkApp') || !result.includes('SmartContract')) {
    throw new Error(`Expected MyZkApp and SmartContract, got: ${JSON.stringify(result)}`);
  }
});

test('analyzeQuery: returns full analysis', () => {
  const result = analyzeQuery('How to create a zkApp?');
  assertEqual(result.type, 'howto');
  assertEqual(typeof result.expandedQuery, 'string');
  assertEqual(typeof result.suggestedLimit, 'number');
  assertEqual(Array.isArray(result.keywords), true);
});

console.log('\n========================================');
console.log('AST CHUNKER TESTS');
console.log('========================================\n');

test('shouldUseASTChunking: plain text returns false', () => {
  assertEqual(shouldUseASTChunking('This is just plain text with no code.'), false);
});

test('shouldUseASTChunking: TypeScript returns true', () => {
  const code = `import { Field } from 'o1js';
export class MyApp {
  constructor() {}
  run() { return 1; }
}`;
  assertEqual(shouldUseASTChunking(code), true);
});

test('chunkCodeWithAST: handles TypeScript class', () => {
  const chunk = {
    id: 'test-1',
    url: 'https://example.com',
    title: 'Test',
    section: 'Code',
    content: `import { Field } from 'o1js';

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}`,
    contentType: 'code',
    project: 'test',
    metadata: {
      headings: [],
      codeLanguage: 'typescript',
      lastScraped: new Date().toISOString()
    }
  };

  const result = chunkCodeWithAST(chunk);
  assertEqual(Array.isArray(result), true);
  if (result.length === 0) {
    throw new Error('Expected at least one chunk');
  }
});

test('chunkCodeWithAST: returns original for non-structured content', () => {
  const chunk = {
    id: 'test-2',
    url: 'https://example.com',
    title: 'Test',
    section: 'Code',
    content: 'just some random text that is not really code',
    contentType: 'code',
    project: 'test',
    metadata: {
      headings: [],
      lastScraped: new Date().toISOString()
    }
  };

  const result = chunkCodeWithAST(chunk);
  assertEqual(result.length, 1);
});

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
}
