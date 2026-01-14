# Collect Sources for Project - Implementation Plan

## Overview

Add a new `npm run collect-sources-for-project` script that uses a LangChain.js agent with Tavily to discover and collect example applications built on a given protocol/framework. The agent takes an unstructured prompt describing what to search for and collects N (default 20) source links, outputting them as ready-to-use source registry entries.

## Current State Analysis

- **Existing Tavily integration**: `packages/shared/src/web-search.ts` has `WebSearchClient` class
- **Existing XAI/Grok support**: `packages/shared/src/llm.ts` supports Grok via OpenAI-compatible API at `https://api.x.ai/v1`
- **No LangChain**: Codebase uses custom agentic patterns, not LangChain
- **Source registry schema**: `packages/shared/src/config/source-registry.ts` defines `GitHubSourceEntry`, `BlogSourceEntry`

### Key Discoveries:
- XAI API key: `XAI_API_KEY` environment variable (`packages/server/src/config.ts:12`)
- Fast non-reasoning model: `grok-4-1-fast-non-reasoning-latest` (`packages/shared/src/llm.ts`)
- Source entry format: `config/sources/mina-o1js-official.json` shows structure

## Desired End State

After implementation:
1. Running `npm run collect-sources-for-project -- --prompt "o1js zkApp examples" --count 20` should:
   - Launch a LangChain agent using Grok (`grok-4-1-fast-non-reasoning-latest`) via XAI API
   - Use Tavily to search for repositories, tutorials, docs, and how-tos
   - Collect 20 unique source links with metadata
   - Output JSON files matching `GitHubSourceEntry` or `BlogSourceEntry` schema
   - Write results to `config/sources/discovered/` directory

2. The agent should:
   - Use `grok-4-1-fast-non-reasoning-latest` by default (fast, cheap, no reasoning)
   - Only use reasoning models if explicitly configured
   - Deduplicate results by URL
   - Validate that GitHub URLs point to actual repositories

### Verification:
- Script runs without errors with valid API keys
- Output JSON files pass Zod schema validation
- Collected sources are unique and relevant to the input prompt

## What We're NOT Doing

- Not integrating with existing scraper pipeline (separate standalone tool)
- Not automatically indexing discovered sources (manual review step)
- Not using reasoning models by default
- Not adding LangGraph (overkill for this use case - using simpler `createReactAgent`)

## Implementation Approach

Use LangChain.js with:
- `@langchain/openai` configured with XAI base URL for Grok models
- `@langchain/tavily` for web search
- `createReactAgent` + `AgentExecutor` for simple agentic loop
- Custom state tracking for collected sources and deduplication

## Phase 1: Add Dependencies

### Overview
Add LangChain packages to the scraper package.

### Changes Required:

#### 1. packages/scraper/package.json
**File**: `packages/scraper/package.json`
**Changes**: Add LangChain dependencies

```json
{
  "name": "@mina-docs/scraper",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "collect-sources": "node dist/collect-sources.js"
  },
  "dependencies": {
    "@mina-docs/shared": "*",
    "cheerio": "^1.0.0-rc.12",
    "minimatch": "^10.1.1",
    "p-limit": "^5.0.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@langchain/tavily": "^0.1.0",
    "langchain": "^0.3.0",
    "zod": "^3.22.0"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm install` completes without errors
- [ ] `npm run build` in packages/scraper succeeds

#### Manual Verification:
- [ ] Verify package-lock.json shows LangChain packages installed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Create Source Collector Agent

### Overview
Implement the core LangChain agent that searches for and collects sources.

### Changes Required:

#### 1. Create collect-sources.ts
**File**: `packages/scraper/src/collect-sources.ts`
**Changes**: New file - main entry point and agent implementation

```typescript
/**
 * Source Collector Agent
 *
 * Uses LangChain with Tavily to discover example applications,
 * tutorials, and repositories for a given protocol/framework.
 */

import { ChatOpenAI } from '@langchain/openai';
import { TavilySearch } from '@langchain/tavily';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PromptTemplate } from '@langchain/core/prompts';

// XAI API configuration (OpenAI-compatible)
const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning-latest'; // Fast, no reasoning

interface CollectedSource {
  url: string;
  title: string;
  description: string;
  type: 'github' | 'blog' | 'docs' | 'tutorial';
  discoveredAt: string;
}

interface CollectorConfig {
  prompt: string;
  count: number;
  outputDir: string;
  model?: string;
  verbose?: boolean;
}

/**
 * Create the LLM client using XAI/Grok
 */
function createLLM(model: string = DEFAULT_MODEL, verbose: boolean = false) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required');
  }

  return new ChatOpenAI({
    modelName: model,
    temperature: 0,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: XAI_BASE_URL,
    },
    verbose,
  });
}

/**
 * Create Tavily search tool
 */
function createSearchTool() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY environment variable is required');
  }

  return new TavilySearch({
    maxResults: 10,
    topic: 'general',
    searchDepth: 'advanced',
    includeAnswer: false,
  });
}

/**
 * State for tracking collected sources
 */
class SourceCollector {
  private sources: Map<string, CollectedSource> = new Map();
  private targetCount: number;

  constructor(targetCount: number) {
    this.targetCount = targetCount;
  }

  add(source: CollectedSource): boolean {
    if (this.sources.has(source.url)) {
      return false; // Duplicate
    }
    this.sources.set(source.url, source);
    return true;
  }

  getAll(): CollectedSource[] {
    return Array.from(this.sources.values());
  }

  count(): number {
    return this.sources.size;
  }

  needsMore(): boolean {
    return this.sources.size < this.targetCount;
  }

  remaining(): number {
    return Math.max(0, this.targetCount - this.sources.size);
  }
}

/**
 * Create custom tool for adding sources to collection
 */
function createAddSourceTool(collector: SourceCollector) {
  return tool(
    async ({ url, title, description, type }) => {
      const source: CollectedSource = {
        url,
        title,
        description,
        type: type as CollectedSource['type'],
        discoveredAt: new Date().toISOString(),
      };

      const added = collector.add(source);
      if (added) {
        return `Added source: ${title} (${url}). Total: ${collector.count()}. Need ${collector.remaining()} more.`;
      } else {
        return `Duplicate URL skipped: ${url}. Total: ${collector.count()}. Need ${collector.remaining()} more.`;
      }
    },
    {
      name: 'add_source',
      description: 'Add a discovered source (repository, tutorial, or documentation) to the collection. Call this for each relevant source found.',
      schema: z.object({
        url: z.string().url().describe('The URL of the source'),
        title: z.string().describe('Title or name of the source'),
        description: z.string().describe('Brief description of what this source contains'),
        type: z.enum(['github', 'blog', 'docs', 'tutorial']).describe('Type of source'),
      }),
    }
  );
}

/**
 * Create tool to check collection status
 */
function createStatusTool(collector: SourceCollector) {
  return tool(
    async () => {
      return JSON.stringify({
        collected: collector.count(),
        remaining: collector.remaining(),
        needsMore: collector.needsMore(),
      });
    },
    {
      name: 'check_status',
      description: 'Check how many sources have been collected and how many more are needed.',
      schema: z.object({}),
    }
  );
}

/**
 * Run the source collection agent
 */
async function collectSources(config: CollectorConfig): Promise<CollectedSource[]> {
  const { prompt, count, model, verbose } = config;

  console.log(`\n🔍 Starting source collection...`);
  console.log(`   Prompt: "${prompt}"`);
  console.log(`   Target: ${count} sources`);
  console.log(`   Model: ${model || DEFAULT_MODEL}\n`);

  // Initialize components
  const llm = createLLM(model, verbose);
  const tavilyTool = createSearchTool();
  const collector = new SourceCollector(count);
  const addSourceTool = createAddSourceTool(collector);
  const statusTool = createStatusTool(collector);

  const tools = [tavilyTool, addSourceTool, statusTool];

  // Get ReAct prompt from LangChain hub
  const reactPrompt = await pull<PromptTemplate>('hwchase17/react');

  // Create ReAct agent
  const agent = await createReactAgent({
    llm,
    tools,
    prompt: reactPrompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    maxIterations: 15, // Limit iterations to prevent runaway
    verbose,
    handleParsingErrors: true,
  });

  // Construct the agent's task
  const agentTask = `
You are a source collector agent. Your task is to find ${count} unique examples of applications, tutorials, repositories, and documentation related to:

"${prompt}"

Instructions:
1. Use the tavily_search tool to search for relevant sources
2. For EACH relevant result, use the add_source tool to add it to the collection
3. Use check_status to see how many more sources you need
4. Search with different queries to find diverse sources:
   - "${prompt} examples"
   - "${prompt} tutorial"
   - "${prompt} github repository"
   - "${prompt} documentation guide"
   - "${prompt} how to build"
5. Prioritize:
   - GitHub repositories with actual code examples
   - Official documentation and tutorials
   - Blog posts with code walkthroughs
   - Community examples and demos
6. Continue searching until you have collected ${count} sources
7. When done, summarize what you found

IMPORTANT: Add EVERY relevant source you find. Don't skip sources.
`;

  try {
    const result = await agentExecutor.invoke({
      input: agentTask,
    });

    console.log(`\n✅ Collection complete!`);
    console.log(`   Collected: ${collector.count()} sources`);
    console.log(`\nAgent summary: ${result.output}\n`);

    return collector.getAll();
  } catch (error) {
    console.error(`\n❌ Agent error:`, error);
    console.log(`   Partial results: ${collector.count()} sources collected`);
    return collector.getAll();
  }
}

/**
 * Convert collected sources to GitHubSourceEntry or BlogSourceEntry format
 */
function toSourceEntry(source: CollectedSource, projectId: string): object {
  const baseId = `${projectId}-discovered-${Date.now()}`;
  const id = baseId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

  if (source.type === 'github' && source.url.includes('github.com')) {
    // Extract repo from GitHub URL
    const match = source.url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    const repo = match ? match[1].replace(/\.git$/, '') : source.url;

    return {
      id,
      type: 'github',
      repoType: 'example-repo',
      trustLevel: 'community',
      repo,
      branch: 'main',
      scrapeStrategy: {
        exampleDirs: ['examples', 'src', 'demo'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
      qualityThresholds: {
        minDocumentationScore: 20,
        minLLMRelevanceScore: 40,
        requireReadme: true,
      },
      description: source.description,
      addedAt: source.discoveredAt,
      discoveredFrom: source.url,
    };
  } else {
    return {
      id,
      type: 'blog',
      trustLevel: 'community',
      url: source.url,
      description: source.description,
      addedAt: source.discoveredAt,
    };
  }
}

/**
 * Write collected sources to output files
 */
function writeOutput(sources: CollectedSource[], projectId: string, outputDir: string) {
  // Ensure output directory exists
  const fullOutputDir = join(outputDir, 'discovered');
  if (!existsSync(fullOutputDir)) {
    mkdirSync(fullOutputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  // Write individual source files
  const entries: object[] = [];
  for (const source of sources) {
    const entry = toSourceEntry(source, projectId);
    entries.push(entry);
  }

  // Write combined output file
  const outputFile = join(fullOutputDir, `${projectId}-${timestamp}.json`);
  writeFileSync(outputFile, JSON.stringify(entries, null, 2));
  console.log(`📁 Written ${entries.length} sources to: ${outputFile}`);

  // Write summary report
  const reportFile = join(fullOutputDir, `${projectId}-${timestamp}-report.md`);
  const report = generateReport(sources, projectId);
  writeFileSync(reportFile, report);
  console.log(`📄 Written report to: ${reportFile}`);

  return outputFile;
}

/**
 * Generate a markdown report of discovered sources
 */
function generateReport(sources: CollectedSource[], projectId: string): string {
  const byType = sources.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let report = `# Discovered Sources Report\n\n`;
  report += `**Project**: ${projectId}\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Total Sources**: ${sources.length}\n\n`;

  report += `## Summary by Type\n\n`;
  for (const [type, count] of Object.entries(byType)) {
    report += `- ${type}: ${count}\n`;
  }

  report += `\n## Sources\n\n`;
  for (const source of sources) {
    report += `### ${source.title}\n`;
    report += `- **URL**: ${source.url}\n`;
    report += `- **Type**: ${source.type}\n`;
    report += `- **Description**: ${source.description}\n\n`;
  }

  return report;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CollectorConfig {
  const args = process.argv.slice(2);
  const config: CollectorConfig = {
    prompt: '',
    count: 20,
    outputDir: './config/sources',
    model: DEFAULT_MODEL,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prompt':
      case '-p':
        config.prompt = args[++i];
        break;
      case '--count':
      case '-n':
        config.count = parseInt(args[++i], 10);
        break;
      case '--output':
      case '-o':
        config.outputDir = args[++i];
        break;
      case '--model':
      case '-m':
        config.model = args[++i];
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Source Collector - Find example applications and tutorials

Usage:
  npm run collect-sources -- --prompt "your search prompt" [options]

Options:
  -p, --prompt <text>   Search prompt (required)
  -n, --count <number>  Number of sources to collect (default: 20)
  -o, --output <dir>    Output directory (default: ./config/sources)
  -m, --model <name>    LLM model to use (default: grok-4-1-fast-non-reasoning-latest)
  -v, --verbose         Enable verbose logging
  -h, --help            Show this help message

Environment Variables:
  XAI_API_KEY           Required - XAI API key for Grok models
  TAVILY_API_KEY        Required - Tavily API key for web search

Examples:
  npm run collect-sources -- -p "o1js zkApp examples" -n 20
  npm run collect-sources -- -p "Solana Anchor tutorials" -n 30 -v
`);
        process.exit(0);
    }
  }

  if (!config.prompt) {
    console.error('Error: --prompt is required');
    process.exit(1);
  }

  return config;
}

/**
 * Main entry point
 */
async function main() {
  // Load environment variables
  await import('@mina-docs/shared/load-env');

  const config = parseArgs();

  // Derive project ID from prompt
  const projectId = config.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);

  try {
    const sources = await collectSources(config);

    if (sources.length > 0) {
      writeOutput(sources, projectId, config.outputDir);
    } else {
      console.log('\n⚠️ No sources were collected.');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build` in packages/scraper succeeds with no TypeScript errors
- [ ] File `packages/scraper/dist/collect-sources.js` exists after build

#### Manual Verification:
- [ ] Code review confirms agent uses `grok-4-1-fast-non-reasoning-latest` by default (no reasoning)
- [ ] Code review confirms deduplication logic is present

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Add npm Script and Integration

### Overview
Add the npm script to root package.json and test the integration.

### Changes Required:

#### 1. Root package.json
**File**: `package.json`
**Changes**: Add collect-sources script

```json
"scripts": {
  "build": "npm run build --workspaces",
  "clean": "rm -rf packages/*/dist",
  "scraper": "node packages/scraper/dist/index.js",
  "collect-sources": "node packages/scraper/dist/collect-sources.js",
  ...
}
```

#### 2. Update .env.example (if not already present)
**File**: `.env.example`
**Changes**: Ensure XAI_API_KEY and TAVILY_API_KEY are documented

```bash
# XAI API Key (for Grok models)
XAI_API_KEY=xai-...

# Tavily API Key (for web search)
TAVILY_API_KEY=tvly-...
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build` succeeds
- [ ] `npm run collect-sources -- --help` shows help text without errors

#### Manual Verification:
- [ ] Run `npm run collect-sources -- -p "o1js zkApp examples" -n 5 -v` with valid API keys
- [ ] Verify output files are created in `config/sources/discovered/`
- [ ] Verify JSON output matches source registry schema structure

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Final Testing and Documentation

### Overview
End-to-end testing and inline documentation.

### Changes Required:

#### 1. Test with multiple prompts
Run these test cases:
```bash
# Test 1: Mina/o1js
npm run collect-sources -- -p "o1js zkApp examples and tutorials" -n 10

# Test 2: Solana
npm run collect-sources -- -p "Solana Anchor smart contract examples" -n 10

# Test 3: General blockchain
npm run collect-sources -- -p "zero knowledge proof application examples" -n 10
```

### Success Criteria:

#### Automated Verification:
- [ ] All test commands complete without fatal errors
- [ ] Output JSON files are valid JSON (parseable)

#### Manual Verification:
- [ ] Review collected sources for relevance
- [ ] Verify URLs are actual repositories/tutorials (not broken links)
- [ ] Confirm no duplicate URLs in output
- [ ] Sources include mix of GitHub repos, tutorials, and docs

---

## Testing Strategy

### Unit Tests:
- Not required for initial implementation (CLI tool)

### Integration Tests:
- Manual testing with different prompts
- Verify API key validation works correctly

### Manual Testing Steps:
1. Set `XAI_API_KEY` and `TAVILY_API_KEY` in `.env`
2. Run `npm run build`
3. Run `npm run collect-sources -- -p "test prompt" -n 5 -v`
4. Verify output files in `config/sources/discovered/`
5. Open JSON file and verify structure matches schema
6. Open markdown report and verify readability

## Performance Considerations

- Agent limited to 15 iterations max to prevent runaway costs
- Uses `grok-4-1-fast-non-reasoning-latest` by default (fast, no reasoning overhead)
- Tavily `advanced` search depth for better results (costs more API credits)
- Deduplication prevents wasted API calls on duplicate URLs

## Migration Notes

N/A - New standalone feature, no migration required.

## References

- Existing Tavily client: `packages/shared/src/web-search.ts`
- XAI/Grok configuration: `packages/shared/src/llm.ts:88-130`
- Source registry schema: `packages/shared/src/config/source-registry.ts`
- Example source entry: `config/sources/mina-o1js-official.json`
