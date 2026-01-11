/**
 * RAG Inspector - Interactive CLI for evaluating corrective RAG behavior
 *
 * Usage:
 *   npm run rag-inspector
 *   npm run rag-inspector -- --project mina
 *
 * Commands:
 *   ask <question>    - Ask a question and see full RAG analysis
 *   compare           - Compare two queries side by side
 *   stress <topic>    - Run stress test with variations
 *   history           - Show query history with metrics
 *   export            - Export session to JSON
 *   help              - Show help
 *   quit              - Exit
 */

import * as readline from 'readline';
import * as fs from 'fs';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000';

// ANSI color codes
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
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

interface QueryResult {
  question: string;
  project: string;
  timestamp: Date;
  answer: string;
  metadata: ResponseMetadata | null;
  rawResponse: string;
  processingTimeMs: number;
  error?: string;
}

interface ResponseMetadata {
  confidence: number;
  retrievalQuality: 'high' | 'medium' | 'low' | 'none';
  sourcesUsed: number;
  queryType: string;
  suggestions?: Array<{ action: string; reason: string; params?: Record<string, string> }>;
  relatedQueries?: string[];
  warnings?: string[];
  processingTimeMs: number;
  searchGuidance?: {
    limitation: string;
    whatWeUnderstood: {
      project: string;
      intent: string;
      technicalTerms: string[];
    };
    suggestedSearches: Array<{
      query: string;
      rationale: string;
      suggestedEngine: string;
      priority: number;
    }>;
    tips: string[];
  };
}

// Session history
const queryHistory: QueryResult[] = [];
let currentProject = 'mina';

// Parse command line args
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' || args[i] === '-p') {
    currentProject = args[i + 1] || 'mina';
    i++;
  }
}

function log(color: string, ...args: any[]) {
  console.log(color, ...args, colors.reset);
}

function printHeader() {
  console.clear();
  log(colors.cyan + colors.bright, `
╔═══════════════════════════════════════════════════════════════╗
║                    RAG INSPECTOR v1.0                        ║
║         Interactive Corrective RAG Evaluation CLI            ║
╚═══════════════════════════════════════════════════════════════╝
`);
  log(colors.dim, `Server: ${MCP_URL} | Project: ${currentProject}`);
  log(colors.dim, `Type 'help' for commands, 'quit' to exit\n`);
}

function printHelp() {
  log(colors.cyan + colors.bright, '\n📚 Available Commands:\n');

  const commands = [
    ['ask <question>', 'Ask a question and see detailed RAG analysis'],
    ['a <question>', 'Shorthand for ask'],
    ['compare', 'Compare two queries side by side'],
    ['stress <topic>', 'Run stress test with query variations'],
    ['retry', 'Re-run the last query'],
    ['history', 'Show query history with metrics summary'],
    ['detail <n>', 'Show full details for history item n'],
    ['raw [n]', 'Show full unprocessed MCP response (default: last)'],
    ['project <id>', 'Switch project (mina/solana/cosmos)'],
    ['export [file]', 'Export session history to JSON'],
    ['clear', 'Clear screen'],
    ['help', 'Show this help'],
    ['quit', 'Exit the inspector'],
  ];

  for (const [cmd, desc] of commands) {
    log(colors.green, `  ${cmd.padEnd(20)} `, colors.white + desc);
  }

  log(colors.dim, '\n💡 Tips:');
  log(colors.dim, '  - Corrective RAG triggers when initial results have low confidence');
  log(colors.dim, '  - Watch for "wasRetried" in warnings to see when correction occurred');
  log(colors.dim, '  - Compare similar queries to see how phrasing affects results\n');
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MCP_URL}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

async function callMCPTool(name: string, args: Record<string, any>): Promise<any> {
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: Date.now(),
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'MCP call failed');
  }
  return data.result;
}

function parseMetadata(text: string): ResponseMetadata | null {
  const metadataMatch = text.match(/<response_metadata>\s*```json\s*([\s\S]*?)\s*```\s*<\/response_metadata>/);
  if (metadataMatch) {
    try {
      return JSON.parse(metadataMatch[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function extractAnswer(text: string): string {
  // Remove metadata block and sources
  let answer = text.replace(/<response_metadata>[\s\S]*?<\/response_metadata>/, '');
  answer = answer.replace(/---\s*\n\s*### Sources[\s\S]*$/, '');
  return answer.trim();
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return colors.green;
  if (confidence >= 50) return colors.yellow;
  return colors.red;
}

function getQualityColor(quality: string): string {
  switch (quality) {
    case 'high': return colors.green;
    case 'medium': return colors.yellow;
    case 'low': return colors.red;
    default: return colors.dim;
  }
}

function printConfidenceMeter(confidence: number) {
  const filled = Math.round(confidence / 5);
  const empty = 20 - filled;
  const color = getConfidenceColor(confidence);

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  log(color, `  Confidence: [${bar}] ${confidence}%`);
}

function printQueryResult(result: QueryResult, verbose = true) {
  log(colors.cyan + colors.bright, '\n┌─────────────────────────────────────────────────────────────┐');
  log(colors.cyan, `│ Query: ${result.question.substring(0, 55).padEnd(55)} │`);
  log(colors.cyan, `│ Project: ${result.project.padEnd(52)} │`);
  log(colors.cyan + colors.bright, '└─────────────────────────────────────────────────────────────┘\n');

  if (result.error) {
    log(colors.red + colors.bright, '❌ Error:', result.error);
    return;
  }

  const meta = result.metadata;

  // Confidence meter
  if (meta) {
    printConfidenceMeter(meta.confidence);

    // Quality indicators
    log(colors.white, '\n📊 RAG Metrics:');
    log(getQualityColor(meta.retrievalQuality),
      `  Retrieval Quality: ${meta.retrievalQuality.toUpperCase()}`);
    log(colors.white, `  Sources Used: ${meta.sourcesUsed}`);
    log(colors.white, `  Query Type: ${meta.queryType}`);
    log(colors.dim, `  Processing Time: ${meta.processingTimeMs}ms`);

    // Warnings (includes corrective RAG info)
    if (meta.warnings && meta.warnings.length > 0) {
      log(colors.yellow + colors.bright, '\n⚠️  Warnings:');
      for (const warning of meta.warnings) {
        log(colors.yellow, `  • ${warning}`);

        // Highlight corrective RAG activity
        if (warning.includes('alternative queries')) {
          log(colors.magenta, '    ↳ CORRECTIVE RAG WAS TRIGGERED');
        }
      }
    }

    // Search guidance (when docs were insufficient)
    if (meta.searchGuidance) {
      log(colors.blue + colors.bright, '\n🔍 Search Guidance (docs insufficient):');
      log(colors.blue, `  Limitation: ${meta.searchGuidance.limitation}`);

      if (meta.searchGuidance.whatWeUnderstood) {
        log(colors.dim, '\n  What we understood:');
        log(colors.dim, `    Intent: ${meta.searchGuidance.whatWeUnderstood.intent}`);
        log(colors.dim, `    Terms: ${meta.searchGuidance.whatWeUnderstood.technicalTerms.join(', ')}`);
      }

      if (meta.searchGuidance.suggestedSearches?.length > 0) {
        log(colors.blue, '\n  Suggested web searches:');
        for (const search of meta.searchGuidance.suggestedSearches) {
          log(colors.cyan, `    [${search.suggestedEngine}] "${search.query}"`);
          log(colors.dim, `      ${search.rationale}`);
        }
      }
    }

    // Suggestions
    if (verbose && meta.suggestions && meta.suggestions.length > 0) {
      log(colors.green + colors.bright, '\n💡 Suggestions:');
      for (const suggestion of meta.suggestions) {
        log(colors.green, `  • ${suggestion.action}: ${suggestion.reason}`);
      }
    }

    // Related queries
    if (verbose && meta.relatedQueries && meta.relatedQueries.length > 0) {
      log(colors.cyan, '\n🔗 Related Queries:');
      for (const query of meta.relatedQueries.slice(0, 3)) {
        log(colors.cyan, `  • ${query}`);
      }
    }
  }

  // Answer preview
  if (verbose) {
    log(colors.white + colors.bright, '\n📝 Answer Preview:');
    const preview = result.answer.substring(0, 500);
    log(colors.white, preview + (result.answer.length > 500 ? '...' : ''));
  }

  log(colors.dim, '\n' + '─'.repeat(65));
}

async function askQuestion(question: string): Promise<QueryResult> {
  const startTime = Date.now();

  const result: QueryResult = {
    question,
    project: currentProject,
    timestamp: new Date(),
    answer: '',
    metadata: null,
    rawResponse: '',
    processingTimeMs: 0,
  };

  try {
    log(colors.dim, '\n⏳ Querying MCP server...');

    const response = await callMCPTool('crypto_ask_docs', {
      question,
      project: currentProject,
    });

    result.processingTimeMs = Date.now() - startTime;

    if (response?.content?.[0]?.text) {
      result.rawResponse = response.content[0].text;
      result.answer = extractAnswer(result.rawResponse);
      result.metadata = parseMetadata(result.rawResponse);
    }
  } catch (error: any) {
    result.error = error.message;
    result.processingTimeMs = Date.now() - startTime;
  }

  queryHistory.push(result);
  return result;
}

async function runCompare(rl: readline.Interface) {
  log(colors.cyan, '\n📊 Query Comparison Mode');
  log(colors.dim, 'Enter two queries to compare their RAG behavior.\n');

  const q1 = await new Promise<string>((resolve) => {
    rl.question(colors.green + 'Query 1: ' + colors.reset, resolve);
  });

  const q2 = await new Promise<string>((resolve) => {
    rl.question(colors.green + 'Query 2: ' + colors.reset, resolve);
  });

  log(colors.dim, '\nRunning both queries...\n');

  const [r1, r2] = await Promise.all([
    askQuestion(q1),
    askQuestion(q2),
  ]);

  // Side by side comparison
  log(colors.cyan + colors.bright, '\n═══════════════════════════ COMPARISON ═══════════════════════════\n');

  const m1 = r1.metadata;
  const m2 = r2.metadata;

  const compareRow = (label: string, v1: any, v2: any) => {
    const s1 = String(v1 ?? 'N/A').substring(0, 25).padEnd(25);
    const s2 = String(v2 ?? 'N/A').substring(0, 25).padEnd(25);
    const c1 = v1 === v2 ? colors.dim : colors.yellow;
    log(colors.white, `  ${label.padEnd(20)}`, c1 + s1, colors.white + '│', c1 + s2);
  };

  log(colors.cyan, `  ${''.padEnd(20)} ${q1.substring(0, 25).padEnd(25)} │ ${q2.substring(0, 25)}`);
  log(colors.dim, '  ' + '─'.repeat(75));

  compareRow('Confidence', m1?.confidence, m2?.confidence);
  compareRow('Retrieval Quality', m1?.retrievalQuality, m2?.retrievalQuality);
  compareRow('Sources Used', m1?.sourcesUsed, m2?.sourcesUsed);
  compareRow('Query Type', m1?.queryType, m2?.queryType);
  compareRow('Processing Time', `${m1?.processingTimeMs}ms`, `${m2?.processingTimeMs}ms`);
  compareRow('Has Warnings', m1?.warnings?.length ?? 0, m2?.warnings?.length ?? 0);
  compareRow('Search Guidance', m1?.searchGuidance ? 'Yes' : 'No', m2?.searchGuidance ? 'Yes' : 'No');

  log(colors.dim, '\n' + '═'.repeat(70));

  // Highlight key differences
  if (m1 && m2) {
    const confDiff = Math.abs(m1.confidence - m2.confidence);
    if (confDiff > 20) {
      log(colors.yellow + colors.bright, `\n⚠️  Significant confidence difference: ${confDiff} points`);
    }

    if (m1.retrievalQuality !== m2.retrievalQuality) {
      log(colors.yellow, `📊 Different retrieval quality: ${m1.retrievalQuality} vs ${m2.retrievalQuality}`);
    }

    if ((m1.searchGuidance && !m2.searchGuidance) || (!m1.searchGuidance && m2.searchGuidance)) {
      log(colors.blue, `🔍 Search guidance triggered for only one query`);
    }
  }
}

async function runStressTest(topic: string) {
  log(colors.cyan + colors.bright, `\n🔥 Stress Test: "${topic}"\n`);
  log(colors.dim, 'Testing various query formulations...\n');

  const variations = [
    `What is ${topic}?`,
    `How do I use ${topic}?`,
    `${topic} example code`,
    `${topic} tutorial`,
    `${topic} error common issues`,
    `explain ${topic} for beginners`,
    `${topic} API reference`,
    `${topic}`, // bare keyword
  ];

  const results: QueryResult[] = [];

  for (let i = 0; i < variations.length; i++) {
    const query = variations[i];
    log(colors.dim, `[${i + 1}/${variations.length}] Testing: "${query}"`);

    const result = await askQuestion(query);
    results.push(result);

    const emoji = result.metadata?.confidence >= 70 ? '✅' :
                  result.metadata?.confidence >= 50 ? '⚠️' : '❌';
    const conf = result.metadata?.confidence ?? 0;
    log(getConfidenceColor(conf), `    ${emoji} Confidence: ${conf}% | Quality: ${result.metadata?.retrievalQuality}`);
  }

  // Summary
  log(colors.cyan + colors.bright, '\n📊 Stress Test Summary:\n');

  const avgConf = results.reduce((sum, r) => sum + (r.metadata?.confidence ?? 0), 0) / results.length;
  const highQuality = results.filter(r => r.metadata?.retrievalQuality === 'high').length;
  const lowQuality = results.filter(r => r.metadata?.retrievalQuality === 'low').length;
  const withGuidance = results.filter(r => r.metadata?.searchGuidance).length;

  log(colors.white, `  Average Confidence: ${avgConf.toFixed(1)}%`);
  log(colors.green, `  High Quality Results: ${highQuality}/${results.length}`);
  log(colors.red, `  Low Quality Results: ${lowQuality}/${results.length}`);
  log(colors.blue, `  Required Search Guidance: ${withGuidance}/${results.length}`);

  // Best and worst
  const sorted = [...results].sort((a, b) =>
    (b.metadata?.confidence ?? 0) - (a.metadata?.confidence ?? 0)
  );

  log(colors.green, `\n  Best query: "${sorted[0].question}" (${sorted[0].metadata?.confidence}%)`);
  log(colors.red, `  Worst query: "${sorted[sorted.length - 1].question}" (${sorted[sorted.length - 1].metadata?.confidence}%)`);
}

function printHistory() {
  if (queryHistory.length === 0) {
    log(colors.dim, '\nNo queries in history yet.');
    return;
  }

  log(colors.cyan + colors.bright, '\n📜 Query History:\n');

  log(colors.dim, `  ${'#'.padEnd(4)} ${'Query'.padEnd(40)} ${'Conf'.padEnd(6)} ${'Quality'.padEnd(8)} Time`);
  log(colors.dim, '  ' + '─'.repeat(70));

  queryHistory.forEach((result, i) => {
    const conf = result.metadata?.confidence ?? 0;
    const quality = result.metadata?.retrievalQuality ?? 'N/A';
    const time = `${result.metadata?.processingTimeMs ?? result.processingTimeMs}ms`;

    log(getConfidenceColor(conf),
      `  ${String(i + 1).padEnd(4)} ${result.question.substring(0, 38).padEnd(40)} ${String(conf).padEnd(6)} ${quality.padEnd(8)} ${time}`
    );
  });

  // Aggregate stats
  const avgConf = queryHistory.reduce((sum, r) => sum + (r.metadata?.confidence ?? 0), 0) / queryHistory.length;
  log(colors.dim, '\n  ' + '─'.repeat(70));
  log(colors.white, `  Average Confidence: ${avgConf.toFixed(1)}% across ${queryHistory.length} queries`);
}

function showDetail(index: number) {
  if (index < 1 || index > queryHistory.length) {
    log(colors.red, `Invalid index. Use 1-${queryHistory.length}`);
    return;
  }

  const result = queryHistory[index - 1];
  printQueryResult(result, true);

  // Show full raw response option
  log(colors.dim, '\nUse "raw ' + index + '" to see the full unprocessed response.');
}

function showRawResponse(index: number) {
  if (index < 1 || index > queryHistory.length) {
    log(colors.red, `Invalid index. Use 1-${queryHistory.length}`);
    return;
  }

  const result = queryHistory[index - 1];

  log(colors.cyan + colors.bright, '\n┌─────────────────────────────────────────────────────────────┐');
  log(colors.cyan, `│ RAW RESPONSE for: ${result.question.substring(0, 43).padEnd(43)} │`);
  log(colors.cyan + colors.bright, '└─────────────────────────────────────────────────────────────┘\n');

  if (result.error) {
    log(colors.red, 'Error:', result.error);
    return;
  }

  // Print the full raw response
  console.log(result.rawResponse);

  log(colors.dim, '\n' + '─'.repeat(65));
  log(colors.dim, `Response length: ${result.rawResponse.length} characters`);
}

function exportSession(filename?: string) {
  const file = filename || `rag-session-${Date.now()}.json`;
  const data = {
    exportedAt: new Date().toISOString(),
    project: currentProject,
    server: MCP_URL,
    queryCount: queryHistory.length,
    queries: queryHistory.map(r => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
    })),
    summary: {
      avgConfidence: queryHistory.reduce((sum, r) => sum + (r.metadata?.confidence ?? 0), 0) / queryHistory.length,
      qualityDistribution: {
        high: queryHistory.filter(r => r.metadata?.retrievalQuality === 'high').length,
        medium: queryHistory.filter(r => r.metadata?.retrievalQuality === 'medium').length,
        low: queryHistory.filter(r => r.metadata?.retrievalQuality === 'low').length,
        none: queryHistory.filter(r => r.metadata?.retrievalQuality === 'none').length,
      },
    },
  };

  // Write to stdout for piping, or save to file
  if (filename) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    log(colors.green, `\n✅ Exported to ${file}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function main() {
  printHeader();

  // Check server health
  log(colors.dim, 'Checking server connection...');
  const healthy = await checkServerHealth();

  if (!healthy) {
    log(colors.red + colors.bright, '❌ Cannot connect to MCP server at', MCP_URL);
    log(colors.yellow, 'Make sure the server is running: npm run server');
    process.exit(1);
  }

  log(colors.green, '✅ Connected to MCP server\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(colors.green + `[${currentProject}] > ` + colors.reset, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      const [cmd, ...args] = trimmed.split(' ');
      const argStr = args.join(' ');

      try {
        switch (cmd.toLowerCase()) {
          case 'quit':
          case 'exit':
          case 'q':
            log(colors.cyan, '\n👋 Goodbye!\n');
            rl.close();
            process.exit(0);
            break;

          case 'help':
          case 'h':
          case '?':
            printHelp();
            break;

          case 'clear':
          case 'cls':
            printHeader();
            break;

          case 'ask':
          case 'a':
            if (!argStr) {
              log(colors.yellow, 'Usage: ask <question>');
            } else {
              const result = await askQuestion(argStr);
              printQueryResult(result);
            }
            break;

          case 'compare':
            await runCompare(rl);
            break;

          case 'stress':
            if (!argStr) {
              log(colors.yellow, 'Usage: stress <topic>');
            } else {
              await runStressTest(argStr);
            }
            break;

          case 'retry':
            if (queryHistory.length === 0) {
              log(colors.yellow, 'No previous query to retry.');
            } else {
              const lastQ = queryHistory[queryHistory.length - 1].question;
              log(colors.dim, `Retrying: "${lastQ}"`);
              const result = await askQuestion(lastQ);
              printQueryResult(result);
            }
            break;

          case 'history':
          case 'hist':
            printHistory();
            break;

          case 'detail':
            const idx = parseInt(argStr);
            if (isNaN(idx)) {
              log(colors.yellow, 'Usage: detail <number>');
            } else {
              showDetail(idx);
            }
            break;

          case 'raw':
            if (!argStr || argStr === 'last') {
              // Show last query's raw response
              if (queryHistory.length === 0) {
                log(colors.yellow, 'No queries in history yet.');
              } else {
                showRawResponse(queryHistory.length);
              }
            } else {
              const rawIdx = parseInt(argStr);
              if (isNaN(rawIdx)) {
                log(colors.yellow, 'Usage: raw [number] (defaults to last query)');
              } else {
                showRawResponse(rawIdx);
              }
            }
            break;

          case 'project':
            if (argStr && ['mina', 'solana', 'cosmos'].includes(argStr.toLowerCase())) {
              currentProject = argStr.toLowerCase();
              log(colors.green, `Switched to project: ${currentProject}`);
            } else {
              log(colors.yellow, 'Available projects: mina, solana, cosmos');
            }
            break;

          case 'export':
            exportSession(argStr || undefined);
            break;

          default:
            // Treat as a question directly
            const result = await askQuestion(trimmed);
            printQueryResult(result);
            break;
        }
      } catch (error: any) {
        log(colors.red, 'Error:', error.message);
      }

      prompt();
    });
  };

  printHelp();
  prompt();
}

main().catch(console.error);
