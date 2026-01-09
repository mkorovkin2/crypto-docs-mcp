# Multi-Project Documentation Support Implementation Plan

## Overview

Transform the current MINA-specific documentation MCP server into a flexible multi-project system that can scrape, store, and query documentation from multiple blockchain projects (initially Solana, Cosmos, and MINA). A coding agent using this MCP should be able to query docs for a specific project efficiently via an explicit `project` parameter.

## Current State Analysis

### What Exists Now
- Single-project scraper hardcoded for MINA docs (`https://docs.minaprotocol.com`)
- o1js GitHub source scraping with 40+ hardcoded file paths
- SQLite FTS5 database at `./data/mina_docs.db`
- Qdrant vector collection `mina_docs`
- 8 MCP tools with extensive MINA/o1js-specific hardcoded knowledge:
  - `explain_concept`: Hardcoded glossary for zkSNARK, SmartContract, Field, etc.
  - `get_api_signature`: Hardcoded API database for 20+ o1js classes
  - `resolve_import`: Hardcoded import mappings for 60+ o1js symbols
  - `validate_zkapp_code`: Hardcoded validation rules for o1js patterns
  - `get_pattern`: Hardcoded 13 code patterns for zkApp development
  - `debug_helper`: Hardcoded error patterns for o1js errors

### Key Discoveries
- `DocumentChunk.metadata` has no `project` field (`packages/shared/src/types.ts:8-20`)
- Database schemas have no project column (`packages/shared/src/db/fts.ts:22-31`)
- Qdrant has no payload index for project filtering (`packages/shared/src/db/vector.ts:31-34`)
- All tool descriptions reference "Mina" explicitly (`packages/server/src/tools/index.ts:20,43,61,79`)

## Desired End State

After implementation:
1. **Project configuration via JSON files** - Each project defined in `config/projects/*.json`
2. **Single database with project isolation** - `project` field added to schema, filterable at query time
3. **Generic MCP tools** - Hardcoded MINA content removed, all knowledge from scraped docs
4. **Explicit project parameter** - Agent specifies `project: "solana"` in tool calls
5. **Scraper CLI accepts project name** - `npm run scrape -- --project solana`

### Verification
- Run scraper for multiple projects without conflicts
- Query each project's docs independently via MCP tools
- Cross-project queries work when no project filter specified
- All tests pass and server starts without errors

## What We're NOT Doing

1. **Auto-detection of project from context** - Agent must explicitly specify project
2. **Project-specific hardcoded knowledge** - No glossary/patterns/APIs per project in code
3. **Separate databases per project** - Single DB with filtering instead
4. **Migration of existing MINA data** - Will re-scrape after schema changes
5. **UI/dashboard for project management** - Config files only

## Implementation Approach

The implementation follows a bottom-up approach:
1. First, add project support to shared types and database layer
2. Then, update the scraper to use project configurations
3. Finally, update MCP server tools to accept project parameter and remove hardcoded content

---

## Phase 1: Project Configuration System

### Overview
Create a JSON-based configuration system for defining projects to scrape.

### Changes Required:

#### 1. Create Project Configuration Schema
**File**: `packages/shared/src/config/project-config.ts` (NEW)

```typescript
import { z } from 'zod';

export const GitHubSourceConfigSchema = z.object({
  repo: z.string(), // e.g., "o1-labs/o1js"
  branch: z.string().default('main'),
  // Glob patterns for files to scrape
  include: z.array(z.string()), // e.g., ["src/lib/**/*.ts"]
  // Glob patterns to exclude
  exclude: z.array(z.string()).default([]),
});

export const ProjectConfigSchema = z.object({
  // Unique identifier (used in queries)
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), // e.g., "mina", "solana", "cosmos"

  // Display name
  name: z.string(), // e.g., "Mina Protocol"

  // Documentation site configuration
  docs: z.object({
    baseUrl: z.string().url(),
    // URL patterns to include (optional, defaults to all under baseUrl)
    includePatterns: z.array(z.string()).default([]),
    // URL patterns to exclude
    excludePatterns: z.array(z.string()).default([]),
    // Max pages to crawl
    maxPages: z.number().default(200),
    // Custom selectors for content extraction (optional)
    selectors: z.object({
      content: z.string().optional(), // CSS selector for main content
      title: z.string().optional(),
      exclude: z.array(z.string()).optional(), // Elements to remove
    }).optional(),
  }),

  // GitHub source code scraping (optional)
  github: GitHubSourceConfigSchema.optional(),

  // Crawler settings
  crawler: z.object({
    concurrency: z.number().default(3),
    delayMs: z.number().default(1000),
    userAgent: z.string().optional(),
  }).default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type GitHubSourceConfig = z.infer<typeof GitHubSourceConfigSchema>;
```

#### 2. Create Project Configuration Loader
**File**: `packages/shared/src/config/load-config.ts` (NEW)

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ProjectConfigSchema, type ProjectConfig } from './project-config.js';

const CONFIG_DIR = join(process.cwd(), 'config', 'projects');

export function loadProjectConfig(projectId: string): ProjectConfig {
  const configPath = join(CONFIG_DIR, `${projectId}.json`);

  if (!existsSync(configPath)) {
    throw new Error(`Project config not found: ${configPath}`);
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return ProjectConfigSchema.parse(raw);
}

export function listProjects(): string[] {
  if (!existsSync(CONFIG_DIR)) {
    return [];
  }

  return readdirSync(CONFIG_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export function loadAllProjectConfigs(): ProjectConfig[] {
  return listProjects().map(loadProjectConfig);
}
```

#### 3. Create Initial Project Config Files
**File**: `config/projects/mina.json` (NEW)

```json
{
  "id": "mina",
  "name": "Mina Protocol",
  "docs": {
    "baseUrl": "https://docs.minaprotocol.com",
    "excludePatterns": ["/api/", "/external", "/redirect"],
    "maxPages": 200
  },
  "github": {
    "repo": "o1-labs/o1js",
    "branch": "main",
    "include": [
      "src/lib/provable/field.ts",
      "src/lib/provable/bool.ts",
      "src/lib/provable/int.ts",
      "src/lib/provable/string.ts",
      "src/lib/provable/group.ts",
      "src/lib/provable/scalar.ts",
      "src/lib/provable/bytes.ts",
      "src/lib/provable/merkle-tree.ts",
      "src/lib/provable/merkle-map.ts",
      "src/lib/provable/merkle-list.ts",
      "src/lib/provable/crypto/poseidon.ts",
      "src/lib/provable/crypto/signature.ts",
      "src/lib/mina/zkapp.ts",
      "src/lib/mina/state.ts",
      "src/lib/mina/account-update.ts",
      "src/lib/mina/transaction.ts",
      "src/lib/mina/mina.ts",
      "src/lib/mina/token.ts",
      "src/lib/proof-system/zkprogram.ts",
      "src/lib/proof-system/proof.ts"
    ],
    "exclude": ["**/*.test.ts", "**/*.spec.ts"]
  },
  "crawler": {
    "concurrency": 3,
    "delayMs": 1000
  }
}
```

**File**: `config/projects/solana.json` (NEW)

```json
{
  "id": "solana",
  "name": "Solana",
  "docs": {
    "baseUrl": "https://solana.com/docs",
    "excludePatterns": ["/api/", "/cookbook"],
    "maxPages": 300
  },
  "github": {
    "repo": "solana-labs/solana-program-library",
    "branch": "master",
    "include": [
      "token/program/src/**/*.rs",
      "associated-token-account/program/src/**/*.rs"
    ],
    "exclude": ["**/tests/**"]
  },
  "crawler": {
    "concurrency": 2,
    "delayMs": 1500
  }
}
```

**File**: `config/projects/cosmos.json` (NEW)

```json
{
  "id": "cosmos",
  "name": "Cosmos SDK",
  "docs": {
    "baseUrl": "https://docs.cosmos.network",
    "excludePatterns": ["/api/"],
    "maxPages": 400
  },
  "github": {
    "repo": "cosmos/cosmos-sdk",
    "branch": "main",
    "include": [
      "x/bank/**/*.go",
      "x/staking/**/*.go",
      "x/gov/**/*.go"
    ],
    "exclude": ["**/*_test.go"]
  },
  "crawler": {
    "concurrency": 2,
    "delayMs": 1000
  }
}
```

#### 4. Export Config from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add exports for config module

```typescript
// Add at end of file:
export * from './config/project-config.js';
export * from './config/load-config.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/shared
- [ ] Config files are valid JSON: `node -e "require('./config/projects/mina.json')"`
- [ ] Schema validation works: unit test that validates sample config

#### Manual Verification:
- [ ] Review config structure makes sense for different project types
- [ ] Verify include/exclude patterns are appropriate for each project

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Database Schema Updates

### Overview
Add `project` field to DocumentChunk and update database schemas to support project-based filtering.

### Changes Required:

#### 1. Update DocumentChunk Type
**File**: `packages/shared/src/types.ts`
**Changes**: Add `project` field

```typescript
export interface DocumentChunk {
  id: string;
  url: string;
  title: string;
  section: string;
  content: string;
  contentType: 'prose' | 'code' | 'api-reference';
  project: string; // NEW: Project identifier (e.g., "mina", "solana")
  metadata: {
    headings: string[];
    codeLanguage?: string;
    lastScraped: string;
    sourceType?: 'docs' | 'github';
    className?: string;
    methodName?: string;
    functionName?: string;
    typeName?: string;
    isStatic?: boolean;
    filePath?: string;
  };
}
```

#### 2. Update SQLite Schema
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Add project column and index

```typescript
async initialize(): Promise<void> {
  // Create main table with project column
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      project TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for project filtering
  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project)
  `);

  // Create FTS5 virtual table (unchanged)
  this.db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      title,
      section,
      content,
      content_id UNINDEXED,
      tokenize='porter unicode61'
    )
  `);
}
```

**Update upsert method:**
```typescript
async upsert(chunks: DocumentChunk[]): Promise<void> {
  const insertChunk = this.db.prepare(`
    INSERT OR REPLACE INTO chunks (id, url, title, section, content, content_type, project, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ... rest unchanged, just add chunk.project to insertChunk.run()
}
```

**Update search method:**
```typescript
async search(
  query: string,
  options: { limit?: number; contentType?: string; project?: string } = {}
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  const { limit = 10, contentType, project } = options;

  // ... existing query building ...

  if (project) {
    sql += ` AND c.project = ?`;
    params.push(project);
  }

  // ... rest unchanged, add project to result mapping
}
```

#### 3. Update Qdrant Schema
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Add project payload index and filter support

```typescript
async initialize(): Promise<void> {
  const collections = await this.client.getCollections();
  const exists = collections.collections.some(c => c.name === this.collection);

  if (!exists) {
    await this.client.createCollection(this.collection, {
      vectors: {
        size: 1536,
        distance: 'Cosine'
      }
    });

    // Create payload indexes for filtering
    await this.client.createPayloadIndex(this.collection, {
      field_name: 'contentType',
      field_schema: 'keyword'
    });

    // NEW: Add project index
    await this.client.createPayloadIndex(this.collection, {
      field_name: 'project',
      field_schema: 'keyword'
    });
  }
}
```

**Update upsert to include project in payload:**
```typescript
const points = chunks.map((chunk, i) => ({
  id: chunk.id,
  vector: embeddings[i],
  payload: {
    url: chunk.url,
    title: chunk.title,
    section: chunk.section,
    content: chunk.content,
    contentType: chunk.contentType,
    project: chunk.project, // NEW
    metadata: chunk.metadata
  }
}));
```

**Update search to support project filter:**
```typescript
async search(
  embedding: number[],
  options: { limit?: number; filter?: Record<string, string> } = {}
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  // ... existing code, filter already supports arbitrary keys
  // Just need to add project to result mapping
}
```

#### 4. Update HybridSearch
**File**: `packages/shared/src/search.ts`
**Changes**: Add project to SearchOptions and pass through

```typescript
export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string; // NEW
  mode?: 'hybrid' | 'vector' | 'fts';
}

// Update vectorSearch and ftsSearch to pass project filter
private async vectorSearch(
  query: string,
  options: { limit: number; contentType?: string; project?: string }
): Promise<SearchResult[]> {
  // ...
  const filter: Record<string, string> = {};
  if (options.contentType) filter.contentType = options.contentType;
  if (options.project) filter.project = options.project; // NEW

  const results = await this.options.vectorDb.search(embedding, {
    limit: options.limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined
  });
  // ...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build` in packages/shared
- [ ] Existing tests still pass (may need updates for new required field)

#### Manual Verification:
- [ ] Delete existing database files and re-initialize to get new schema
- [ ] Verify project index exists in Qdrant via API

**Implementation Note**: After completing this phase, you'll need to delete existing database files before re-scraping. Pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update Scraper for Multi-Project

### Overview
Modify the scraper to accept a project parameter and use project configurations.

### Changes Required:

#### 1. Update Scraper Entry Point
**File**: `packages/scraper/src/index.ts`
**Changes**: Accept --project CLI argument, load config

```typescript
#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'util';
import { Crawler } from './crawler.js';
import { parseDocumentation } from './parser.js';
import { chunkContent } from './chunker.js';
import { scrapeGitHubSource } from './github-source.js';
import {
  VectorDB,
  FullTextDB,
  generateEmbeddings,
  loadProjectConfig,
  listProjects,
  type ProjectConfig
} from '@mina-docs/shared';

// Parse CLI arguments
const { values: args } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    list: { type: 'boolean', short: 'l' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (args.help) {
  console.log(`
Usage: scrape [options]

Options:
  -p, --project <id>  Project to scrape (required)
  -l, --list          List available projects
  -h, --help          Show this help

Examples:
  npm run scrape -- --project mina
  npm run scrape -- -p solana
  npm run scrape -- --list
  `);
  process.exit(0);
}

if (args.list) {
  console.log('Available projects:');
  listProjects().forEach(p => console.log(`  - ${p}`));
  process.exit(0);
}

if (!args.project) {
  console.error('Error: --project is required');
  console.error('Run with --list to see available projects');
  process.exit(1);
}

// Load project configuration
let projectConfig: ProjectConfig;
try {
  projectConfig = loadProjectConfig(args.project);
} catch (error) {
  console.error(`Error loading project config: ${error}`);
  process.exit(1);
}

// Configuration with project config + env overrides
const config = {
  project: projectConfig.id,
  projectName: projectConfig.name,
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantCollection: process.env.QDRANT_COLLECTION || 'crypto_docs', // Changed default
  sqlitePath: process.env.SQLITE_PATH || './data/crypto_docs.db', // Changed default
  openaiApiKey: process.env.OPENAI_API_KEY,
  // From project config
  baseUrl: projectConfig.docs.baseUrl,
  excludePatterns: projectConfig.docs.excludePatterns,
  maxPages: projectConfig.docs.maxPages,
  concurrency: projectConfig.crawler.concurrency,
  delayMs: projectConfig.crawler.delayMs,
  // GitHub config
  github: projectConfig.github,
  githubToken: process.env.GITHUB_TOKEN
};

async function main() {
  console.log('='.repeat(60));
  console.log(`Documentation Scraper - ${config.projectName}`);
  console.log('='.repeat(60));

  // ... rest of main() with project field added to chunks
}
```

#### 2. Update Crawler for Configurable Exclusions
**File**: `packages/scraper/src/crawler.ts`
**Changes**: Make URL exclusion patterns configurable

```typescript
export interface CrawlerOptions {
  baseUrl: string;
  concurrency?: number;
  delayMs?: number;
  maxPages?: number;
  excludePatterns?: string[]; // NEW: configurable exclusions
  userAgent?: string; // NEW: configurable user agent
}

// Update isValidUrl to use configurable patterns
private isValidUrl(url: string): boolean {
  // ... existing checks ...

  // Check configurable exclusion patterns
  for (const pattern of this.options.excludePatterns || []) {
    if (pathname.includes(pattern)) {
      return false;
    }
  }

  return true;
}
```

#### 3. Update GitHub Source Scraper
**File**: `packages/scraper/src/github-source.ts`
**Changes**: Accept file patterns from config instead of hardcoded list

```typescript
import type { GitHubSourceConfig } from '@mina-docs/shared';
import { minimatch } from 'minimatch';

export interface GitHubScraperOptions {
  config: GitHubSourceConfig;
  token?: string;
  project: string; // NEW: for setting project field on chunks
}

export class GitHubSourceScraper {
  private config: GitHubSourceConfig;
  private project: string;
  // ...

  async *scrape(): AsyncGenerator<{ path: string; chunks: DocumentChunk[] }> {
    // List all files in repo, filter by include/exclude patterns
    const files = await this.listAllFiles();

    for (const file of files) {
      if (this.matchesPatterns(file)) {
        const content = await this.fetchFile(file);
        if (content) {
          const chunks = this.parseSourceFile(file, content);
          // Set project on all chunks
          chunks.forEach(c => c.project = this.project);
          yield { path: file, chunks };
        }
      }
    }
  }

  private matchesPatterns(path: string): boolean {
    // Check if path matches any include pattern
    const included = this.config.include.some(pattern =>
      minimatch(path, pattern)
    );

    if (!included) return false;

    // Check if path matches any exclude pattern
    const excluded = this.config.exclude.some(pattern =>
      minimatch(path, pattern)
    );

    return !excluded;
  }
}
```

#### 4. Update Parser to Accept Project
**File**: `packages/scraper/src/parser.ts`
**Changes**: Add project parameter to parseDocumentation

```typescript
export function parseDocumentation(
  url: string,
  html: string,
  project: string // NEW
): DocumentChunk[] {
  // ... existing parsing logic ...

  // When creating chunks, add project field:
  return chunks.map(chunk => ({
    ...chunk,
    project
  }));
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build` in packages/scraper
- [ ] `npm run scrape -- --help` shows usage
- [ ] `npm run scrape -- --list` shows available projects
- [ ] `npm run scrape -- --project mina` starts scraping (can Ctrl+C after a few pages)

#### Manual Verification:
- [ ] Verify scraper uses project config correctly (check logged URLs match baseUrl)
- [ ] Verify chunks have correct project field in database

**Implementation Note**: After completing this phase and all automated verification passes, pause here to test scraping a few pages from each project before proceeding to Phase 4.

---

## Phase 4: Update MCP Server Tools

### Overview
Add `project` parameter to all tools, remove hardcoded MINA content, make tools generic.

### Changes Required:

#### 1. Update Tool Definitions with Project Parameter
**File**: `packages/server/src/tools/index.ts`
**Changes**: Add project parameter to all tools, update descriptions

```typescript
export function getToolDefinitions() {
  return [
    {
      name: 'search_documentation',
      description: 'Search project documentation using semantic and keyword search. Returns relevant documentation sections, tutorials, and API references.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be a question, keyword, or concept'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos"). Required.'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter results by content type (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5, max: 10)'
          }
        },
        required: ['query', 'project']
      }
    },
    // ... update all other tools similarly
  ];
}
```

#### 2. Simplify search_documentation
**File**: `packages/server/src/tools/search.ts`
**Changes**: Add project to schema, pass to search

```typescript
export const SearchDocumentationSchema = z.object({
  query: z.string(),
  project: z.string(),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional(),
  limit: z.number().min(1).max(10).default(5)
});

export async function searchDocumentation(
  args: z.infer<typeof SearchDocumentationSchema>,
  context: ToolContext
) {
  const results = await context.search.search(args.query, {
    limit: args.limit,
    contentType: args.contentType,
    project: args.project // NEW
  });

  // ... format results (generic, no MINA references)
}
```

#### 3. Simplify get_code_examples
**File**: `packages/server/src/tools/examples.ts`
**Changes**: Add project parameter, remove o1js-specific language

```typescript
export const GetCodeExamplesSchema = z.object({
  topic: z.string(),
  project: z.string(),
  limit: z.number().min(1).max(10).default(3)
});

// Update function to use project filter in searches
```

#### 4. Simplify explain_concept (Remove Hardcoded Glossary)
**File**: `packages/server/src/tools/explain.ts`
**Changes**: Remove hardcoded glossary, use search only

```typescript
export const ExplainConceptSchema = z.object({
  concept: z.string(),
  project: z.string(),
  depth: z.enum(['brief', 'detailed']).default('brief')
});

export async function explainConcept(
  args: z.infer<typeof ExplainConceptSchema>,
  context: ToolContext
) {
  // Search for concept explanation in docs
  const query = `what is ${args.concept} definition explanation`;
  const limit = args.depth === 'brief' ? 3 : 5;

  const results = await context.search.search(query, {
    limit,
    project: args.project
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for "${args.concept}" in ${args.project} docs.`
      }]
    };
  }

  // Format results as explanation
  let text = `## ${args.concept}\n\n`;

  for (const result of results) {
    text += `### ${result.chunk.section}\n`;
    text += result.chunk.content + '\n\n';
    text += `*Source: [${result.chunk.title}](${result.chunk.url})*\n\n`;
  }

  return { content: [{ type: 'text', text }] };
}
```

#### 5. Simplify debug_helper (Remove Hardcoded Patterns)
**File**: `packages/server/src/tools/debug.ts`
**Changes**: Remove hardcoded error patterns, use search

```typescript
export const DebugHelperSchema = z.object({
  error: z.string(),
  project: z.string(),
  context: z.string().optional()
});

export async function debugHelper(
  args: z.infer<typeof DebugHelperSchema>,
  context: ToolContext
) {
  // Search for error-related documentation
  const query = `error troubleshoot ${args.error} ${args.context || ''}`;

  const results = await context.search.search(query, {
    limit: 5,
    project: args.project
  });

  // Format as troubleshooting guide
  let text = `## Troubleshooting: ${args.error.slice(0, 50)}...\n\n`;

  if (results.length === 0) {
    text += `No specific documentation found for this error in ${args.project} docs.\n\n`;
    text += `### General Suggestions\n`;
    text += `- Check the official ${args.project} documentation\n`;
    text += `- Search community forums and Discord\n`;
    text += `- Review recent changes to your code\n`;
  } else {
    text += `### Related Documentation\n\n`;
    for (const result of results) {
      text += `**${result.chunk.section}**\n`;
      text += result.chunk.content.slice(0, 500) + '...\n\n';
      text += `[Read more](${result.chunk.url})\n\n`;
    }
  }

  return { content: [{ type: 'text', text }] };
}
```

#### 6. Simplify get_api_signature (Remove Hardcoded APIs)
**File**: `packages/server/src/tools/api-signatures.ts`
**Changes**: Remove hardcoded API database, use search

```typescript
export const GetApiSignatureSchema = z.object({
  className: z.string(),
  project: z.string(),
  methodName: z.string().optional()
});

export async function getApiSignature(
  args: z.infer<typeof GetApiSignatureSchema>,
  context: ToolContext
) {
  // Search for API documentation
  const query = args.methodName
    ? `${args.className} ${args.methodName} API method signature`
    : `${args.className} API class reference`;

  const results = await context.search.search(query, {
    limit: 5,
    contentType: 'api-reference',
    project: args.project
  });

  // Also search code examples
  const codeResults = await context.search.search(query, {
    limit: 3,
    contentType: 'code',
    project: args.project
  });

  // Format results
  let text = `## ${args.className}`;
  if (args.methodName) text += `.${args.methodName}`;
  text += '\n\n';

  if (results.length === 0 && codeResults.length === 0) {
    text += `No API documentation found for ${args.className} in ${args.project} docs.\n`;
  } else {
    if (results.length > 0) {
      text += '### API Reference\n\n';
      for (const result of results) {
        text += result.chunk.content + '\n\n';
        text += `*Source: [${result.chunk.title}](${result.chunk.url})*\n\n`;
      }
    }

    if (codeResults.length > 0) {
      text += '### Code Examples\n\n';
      for (const result of codeResults) {
        const lang = result.chunk.metadata.codeLanguage || 'typescript';
        text += `\`\`\`${lang}\n${result.chunk.content}\n\`\`\`\n\n`;
      }
    }
  }

  return { content: [{ type: 'text', text }] };
}
```

#### 7. Simplify resolve_import (Remove Hardcoded Imports)
**File**: `packages/server/src/tools/imports.ts`
**Changes**: Remove hardcoded import mappings, use search

```typescript
export const ResolveImportSchema = z.object({
  symbol: z.string(),
  project: z.string(),
  includeRelated: z.boolean().default(true)
});

export async function resolveImport(
  args: z.infer<typeof ResolveImportSchema>,
  context: ToolContext
) {
  // Search for import statements in code
  const query = `import ${args.symbol}`;

  const results = await context.search.search(query, {
    limit: 5,
    contentType: 'code',
    project: args.project
  });

  // Also search documentation for import info
  const docResults = await context.search.search(`how to import ${args.symbol}`, {
    limit: 3,
    project: args.project
  });

  // Format results
  let text = `## Import: ${args.symbol}\n\n`;

  const importMatches = results.filter(r =>
    r.chunk.content.includes('import') && r.chunk.content.includes(args.symbol)
  );

  if (importMatches.length > 0) {
    text += '### Found Import Statements\n\n';
    for (const result of importMatches.slice(0, 3)) {
      // Extract import line
      const lines = result.chunk.content.split('\n');
      const importLine = lines.find(l => l.includes('import') && l.includes(args.symbol));
      if (importLine) {
        text += `\`\`\`typescript\n${importLine.trim()}\n\`\`\`\n\n`;
      }
    }
  } else if (docResults.length > 0) {
    text += '### Documentation\n\n';
    text += docResults[0].chunk.content.slice(0, 500) + '\n\n';
  } else {
    text += `No import information found for "${args.symbol}" in ${args.project} docs.\n`;
  }

  return { content: [{ type: 'text', text }] };
}
```

#### 8. Remove validate_zkapp_code Tool
**File**: `packages/server/src/tools/index.ts`
**Changes**: Remove the validate_zkapp_code tool entirely (too MINA-specific)

This tool is inherently MINA/o1js specific with its validation rules. Rather than trying to make it generic, remove it. Users can search for best practices via the other tools.

Delete `packages/server/src/tools/validate.ts` and remove from index.ts.

#### 9. Simplify get_pattern (Remove Hardcoded Patterns)
**File**: `packages/server/src/tools/patterns.ts`
**Changes**: Remove hardcoded patterns, use search

```typescript
export const GetPatternSchema = z.object({
  task: z.string(),
  project: z.string(),
  includeVariations: z.boolean().default(true)
});

export async function getPattern(
  args: z.infer<typeof GetPatternSchema>,
  context: ToolContext
) {
  // Search for code patterns/examples
  const query = `${args.task} example pattern how to`;

  const codeResults = await context.search.search(query, {
    limit: 5,
    contentType: 'code',
    project: args.project
  });

  const proseResults = await context.search.search(query, {
    limit: 3,
    contentType: 'prose',
    project: args.project
  });

  // Format results
  let text = `## Pattern: ${args.task}\n\n`;

  if (codeResults.length === 0 && proseResults.length === 0) {
    text += `No patterns found for "${args.task}" in ${args.project} docs.\n`;
    text += `\nTry searching for related terms or browse the documentation directly.\n`;
  } else {
    if (codeResults.length > 0) {
      text += '### Code Examples\n\n';
      for (const result of codeResults) {
        text += `**${result.chunk.section}**\n`;
        const lang = result.chunk.metadata.codeLanguage || 'typescript';
        text += `\`\`\`${lang}\n${result.chunk.content}\n\`\`\`\n`;
        text += `*Source: [${result.chunk.title}](${result.chunk.url})*\n\n`;
      }
    }

    if (proseResults.length > 0) {
      text += '### Documentation\n\n';
      for (const result of proseResults) {
        text += `**${result.chunk.section}**\n`;
        text += result.chunk.content.slice(0, 400) + '...\n';
        text += `[Read more](${result.chunk.url})\n\n`;
      }
    }
  }

  return { content: [{ type: 'text', text }] };
}
```

#### 10. Add list_projects Tool
**File**: `packages/server/src/tools/list-projects.ts` (NEW)

```typescript
import { z } from 'zod';
import { listProjects, loadProjectConfig } from '@mina-docs/shared';

export const ListProjectsSchema = z.object({});

export async function listProjectsTool() {
  const projectIds = listProjects();

  let text = '## Available Projects\n\n';

  for (const id of projectIds) {
    try {
      const config = loadProjectConfig(id);
      text += `### ${config.name} (\`${config.id}\`)\n`;
      text += `- Documentation: ${config.docs.baseUrl}\n`;
      if (config.github) {
        text += `- Source: github.com/${config.github.repo}\n`;
      }
      text += '\n';
    } catch {
      text += `### ${id}\n(Config error)\n\n`;
    }
  }

  text += '\nUse the project ID (e.g., `"mina"`) in the `project` parameter of other tools.';

  return { content: [{ type: 'text', text }] };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build` in packages/server
- [ ] Server starts without errors: `npm run start`
- [ ] All tool schemas validate correctly

#### Manual Verification:
- [ ] Test search_documentation with project="mina" returns MINA docs
- [ ] Test search_documentation with project="solana" returns Solana docs (after scraping)
- [ ] Test list_projects returns configured projects
- [ ] Verify no hardcoded MINA content appears in responses

**Implementation Note**: After completing this phase and all automated verification passes, pause here to thoroughly test all tools with different projects before proceeding to Phase 5.

---

## Phase 5: Update Server Initialization and Environment

### Overview
Update server initialization to use new database naming and ensure proper project filtering context.

### Changes Required:

#### 1. Update Environment Defaults
**File**: `.env.example`
**Changes**: Update default database names

```bash
# Vector Database (Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=crypto_docs

# Full-text Search (SQLite)
SQLITE_PATH=./data/crypto_docs.db

# OpenAI API Key (required)
OPENAI_API_KEY=your-api-key-here

# GitHub Token (optional, for higher rate limits)
GITHUB_TOKEN=your-github-token

# Server Configuration
SERVER_HOST=localhost
SERVER_PORT=3000
```

#### 2. Update Server Initialization
**File**: `packages/server/src/index.ts`
**Changes**: Update default collection/db names

```typescript
const config = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantCollection: process.env.QDRANT_COLLECTION || 'crypto_docs', // Updated
  sqlitePath: process.env.SQLITE_PATH || './data/crypto_docs.db', // Updated
  // ...
};
```

#### 3. Update Package Names (Optional but Recommended)
**File**: `packages/shared/package.json`
**Changes**: Rename from @mina-docs/shared to @crypto-docs/shared

```json
{
  "name": "@crypto-docs/shared",
  // ...
}
```

Similarly update:
- `packages/scraper/package.json` → `@crypto-docs/scraper`
- `packages/server/package.json` → `@crypto-docs/server`

Update all imports across the codebase to use new package names.

### Success Criteria:

#### Automated Verification:
- [ ] All packages build: `npm run build` at root
- [ ] Server starts with new defaults: `npm run start`
- [ ] Scraper works with new defaults: `npm run scrape -- --project mina`

#### Manual Verification:
- [ ] Verify database files are created with new names
- [ ] Verify Qdrant collection is named correctly
- [ ] Test full workflow: scrape → query via MCP

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final manual testing of the complete system.

---

## Testing Strategy

### Unit Tests:
- Config schema validation
- Project config loading
- Database schema with project field
- Search with project filter

### Integration Tests:
- Scrape small subset of each project
- Query each project's docs via MCP tools
- Verify project isolation (no cross-contamination)

### Manual Testing Steps:
1. Delete existing databases (`rm -rf data/`)
2. Delete Qdrant collection (via API or restart container)
3. Scrape MINA docs: `npm run scrape -- --project mina`
4. Scrape Solana docs: `npm run scrape -- --project solana`
5. Start server: `npm run start`
6. Test via MCP client:
   - `search_documentation` with project="mina"
   - `search_documentation` with project="solana"
   - Verify results are from correct project
7. Test `list_projects` tool

## Performance Considerations

- **Project index on Qdrant**: Essential for efficient filtering. Added in Phase 2.
- **SQLite index on project column**: Essential for efficient FTS queries. Added in Phase 2.
- **Single database vs per-project**: Single DB chosen for simplicity. May need sharding if data grows very large.

## Migration Notes

- **Breaking change**: Existing database must be deleted and re-scraped
- **API change**: All tools now require `project` parameter
- **Tool removal**: `validate_zkapp_code` is removed (too framework-specific)

## References

- Current types: `packages/shared/src/types.ts`
- Current scraper: `packages/scraper/src/index.ts`
- Current tools: `packages/server/src/tools/index.ts`
- Current database: `packages/shared/src/db/`
