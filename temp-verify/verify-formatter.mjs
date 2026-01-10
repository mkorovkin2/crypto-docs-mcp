// Verify context formatter
import {
  formatChunkWithMetadata,
  formatSourceUrls,
  getProjectContext,
  formatSearchResultsAsContext
} from '../packages/server/dist/tools/context-formatter.js';

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

function assertIncludes(str, substr, msg = '') {
  if (!str.includes(substr)) {
    throw new Error(`${msg}\n  Expected to include: "${substr}"\n  Got: "${str.substring(0, 200)}..."`);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
}

console.log('\n========================================');
console.log('CONTEXT FORMATTER TESTS');
console.log('========================================\n');

test('getProjectContext: mina returns zkApp info', () => {
  const result = getProjectContext('mina');
  assertIncludes(result, 'zkApp');
  assertIncludes(result, 'o1js');
});

test('getProjectContext: solana returns Anchor info', () => {
  const result = getProjectContext('solana');
  assertIncludes(result, 'Anchor');
  assertIncludes(result, 'devnet');
});

test('getProjectContext: cosmos returns IBC info', () => {
  const result = getProjectContext('cosmos');
  assertIncludes(result, 'IBC');
});

test('getProjectContext: unknown returns empty string', () => {
  assertEqual(getProjectContext('unknown'), '');
});

test('formatSourceUrls: formats correctly', () => {
  const results = [
    { chunk: { url: 'https://a.com' } },
    { chunk: { url: 'https://b.com' } }
  ];
  const output = formatSourceUrls(results);
  assertIncludes(output, '[Source 1]: https://a.com');
  assertIncludes(output, '[Source 2]: https://b.com');
});

test('formatChunkWithMetadata: code chunk with metadata', () => {
  const result = {
    chunk: {
      title: 'Calculator',
      section: 'Methods',
      url: 'https://example.com/calc',
      content: 'function add() {}',
      contentType: 'code',
      metadata: {
        codeLanguage: 'typescript',
        className: 'Calculator',
        methodName: 'add',
        headings: ['API', 'Calculator']
      }
    },
    score: 0.9,
    matchType: 'hybrid'
  };

  const output = formatChunkWithMetadata(result, 0, { includeMetadata: true, labelType: true });
  assertIncludes(output, '[Source 1]');
  assertIncludes(output, '[CODE]');
  assertIncludes(output, 'Language: typescript');
  assertIncludes(output, 'Class: Calculator');
  assertIncludes(output, 'Method: add');
});

test('formatChunkWithMetadata: prose chunk', () => {
  const result = {
    chunk: {
      title: 'Introduction',
      section: 'Getting Started',
      url: 'https://example.com/intro',
      content: 'Welcome to the docs',
      contentType: 'prose',
      metadata: {
        headings: ['Intro', 'Setup']
      }
    },
    score: 0.8,
    matchType: 'fts'
  };

  const output = formatChunkWithMetadata(result, 1, { includeMetadata: true, labelType: true });
  assertIncludes(output, '[Source 2]');
  assertIncludes(output, '[DOCS]');
  assertIncludes(output, 'Headings: Intro > Setup');
});

test('formatSearchResultsAsContext: multiple results', () => {
  const results = [
    {
      chunk: {
        title: 'Test1',
        section: 'A',
        url: 'https://a.com',
        content: 'Content A',
        contentType: 'prose',
        metadata: { headings: [] }
      }
    },
    {
      chunk: {
        title: 'Test2',
        section: 'B',
        url: 'https://b.com',
        content: 'Content B',
        contentType: 'code',
        metadata: { headings: [], codeLanguage: 'rust' }
      }
    }
  ];

  const output = formatSearchResultsAsContext(results, { labelType: true });
  assertIncludes(output, '[Source 1]');
  assertIncludes(output, '[Source 2]');
  assertIncludes(output, 'Content A');
  assertIncludes(output, 'Content B');
});

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
}
