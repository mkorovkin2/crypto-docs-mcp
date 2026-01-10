# Multi-Source Intelligent GitHub Scraping Implementation Plan

## Overview

Extend crypto-docs-mcp to support multiple GitHub repositories per project with intelligent content filtering that ensures only high-quality, relevant examples are indexed. Introduces a modular source registry, tiered trust levels, and a multi-stage quality pipeline (directory filtering → documentation detection → LLM relevance validation) to prevent database pollution.

## Current State Analysis

### What Exists Now
- **Single GitHub repo per project**: Each project config (`config/projects/*.json`) supports one `github` object with a single repo
- **Pattern-based file selection**: Uses glob patterns (`include`/`exclude`) but no quality assessment
- **Basic AST parsing**: Extracts classes, functions, types from TS/Rust/Go files (`packages/scraper/src/github-source.ts`)
- **No trust differentiation**: All content treated equally regardless of source authority
- **Limited metadata**: No version compatibility, prerequisites, or community validation signals

### Key Files
- `packages/shared/src/types.ts:1-22` - `DocumentChunk` interface
- `packages/shared/src/config/project-config.ts:1-48` - `ProjectConfig` and `GitHubSourceConfig` schemas
- `packages/scraper/src/github-source.ts:1-631` - `GitHubSourceScraper` class
- `packages/server/src/tools/context-formatter.ts:109-137` - Hardcoded project context

### Key Discoveries
- GitHub scraper already supports multiple languages (TS, Rust, Go) with language-specific parsing
- Scraper uses GitHub Tree API for file discovery and Content API for file fetching
- No existing mechanism to assess "is this code a useful example?"
- `metadata.sourceType` already distinguishes `'docs'` vs `'github'` but no finer granularity

## Desired End State

After implementation:
1. **Multiple repos per project** with different trust levels and scrape strategies
2. **Intelligent filtering pipeline** that only indexes genuinely useful examples
3. **Rich metadata** on every chunk (trust level, version hints, prerequisites, repo stats)
4. **Source registry** as modular catalog (`config/sources/`) separate from project configs
5. **Semi-automated discovery** CLI for finding and approving new sources
6. **Search ranking** that factors in source quality and trust level

### Verification
- New sources can be added without modifying project configs
- Scraper rejects low-quality code with logged reasons
- Search results show trust indicators and quality signals
- `npm run scraper -- --project mina` processes multiple repos with appropriate strategies

## What We're NOT Doing

- Discord parsing (explicitly out of scope per user)
- Fully automated source discovery (semi-automated with admin approval only)
- Real-time content updates (batch scraping remains the model)
- Breaking changes to existing project configs (backward compatible)
- Blog/tutorial scraping in initial phases (future phase)
- Stack Overflow integration in initial phases (future phase)

## Implementation Approach

Build incrementally with each phase delivering testable value:
1. First, extend data models to support new metadata and source registry
2. Then, enhance the scraper with intelligent filtering
3. Finally, integrate quality signals into search ranking

---

## Phase 1: Data Model & Source Registry Foundation

### Overview
Extend the type system to support multiple sources per project, trust levels, and rich metadata. Create the source registry structure.

### Changes Required:

#### 1. Extend DocumentChunk Metadata
**File**: `packages/shared/src/types.ts`
**Changes**: Add new optional metadata fields for quality signals

```typescript
export interface DocumentChunk {
  id: string;
  url: string;
  title: string;
  section: string;
  content: string;
  contentType: 'prose' | 'code' | 'api-reference';
  project: string;
  metadata: {
    headings: string[];
    codeLanguage?: string;
    lastScraped: string;
    // Existing GitHub metadata
    sourceType?: 'docs' | 'github';
    className?: string;
    methodName?: string;
    functionName?: string;
    typeName?: string;
    isStatic?: boolean;
    filePath?: string;
    // NEW: Trust and quality metadata
    trustLevel?: 'official' | 'verified-community' | 'community';
    sourceId?: string; // Reference to source registry entry
    versionHint?: string; // Inferred version compatibility (e.g., "o1js@>=0.15.0")
    prerequisites?: string[]; // Inferred prerequisites
    repoStats?: {
      stars: number;
      forks: number;
      lastCommit: string; // ISO timestamp
    };
    // NEW: Context from surrounding docs
    readmeContext?: string; // Relevant excerpt from README
    exampleDescription?: string; // What this example demonstrates
    // NEW: Quality filtering metadata
    qualityScore?: number; // 0-100 from LLM evaluation
    indexedReason?: string; // Why this was deemed index-worthy
  };
}
```

#### 2. Create Source Registry Schema
**File**: `packages/shared/src/config/source-registry.ts` (NEW)
**Changes**: Define schema for source entries

```typescript
import { z } from 'zod';

export const TrustLevelSchema = z.enum(['official', 'verified-community', 'community']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const RepoTypeSchema = z.enum(['sdk', 'example-repo', 'tutorial-repo', 'ecosystem-lib']);
export type RepoType = z.infer<typeof RepoTypeSchema>;

export const GitHubSourceEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), // Unique source ID
  type: z.literal('github'),
  repoType: RepoTypeSchema,
  trustLevel: TrustLevelSchema,

  // GitHub specifics
  repo: z.string(), // "org/repo"
  branch: z.string().default('main'),

  // Scrape strategy (depends on repoType)
  scrapeStrategy: z.object({
    // For example-repos: scrape these directories broadly
    exampleDirs: z.array(z.string()).default(['examples', 'demos', 'tutorials', 'samples']),
    // For sdk-repos: only scrape public API + examples
    apiPaths: z.array(z.string()).optional(), // e.g., ["src/lib/provable/*.ts"]
    // Always exclude
    exclude: z.array(z.string()).default(['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']),
    // File extensions to consider
    extensions: z.array(z.string()).default(['.ts', '.tsx', '.js', '.jsx', '.rs', '.go']),
  }),

  // Quality thresholds
  qualityThresholds: z.object({
    minDocumentationScore: z.number().min(0).max(100).default(30), // Reject if below
    minLLMRelevanceScore: z.number().min(0).max(100).default(50), // Reject if below
    requireReadme: z.boolean().default(true), // Require README in directory
  }).default({}),

  // Metadata
  description: z.string().optional(), // Human description of what this source provides
  maintainer: z.string().optional(), // Who maintains this source entry
  addedAt: z.string().optional(), // ISO timestamp
  lastScraped: z.string().optional(),
});

export const BlogSourceEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.literal('blog'),
  trustLevel: TrustLevelSchema,
  url: z.string().url(),
  // ... future expansion
});

export const SourceEntrySchema = z.discriminatedUnion('type', [
  GitHubSourceEntrySchema,
  BlogSourceEntrySchema,
]);

export type SourceEntry = z.infer<typeof SourceEntrySchema>;
export type GitHubSourceEntry = z.infer<typeof GitHubSourceEntrySchema>;

// Project-to-sources mapping
export const ProjectSourcesSchema = z.object({
  projectId: z.string(),
  sources: z.array(z.string()), // Source IDs
});

export type ProjectSources = z.infer<typeof ProjectSourcesSchema>;
```

#### 3. Create Source Registry Loader
**File**: `packages/shared/src/config/load-sources.ts` (NEW)
**Changes**: Functions to load source registry

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { SourceEntrySchema, ProjectSourcesSchema, type SourceEntry, type ProjectSources } from './source-registry.js';

const CONFIG_DIR = 'config';
const SOURCES_DIR = 'sources';
const PROJECT_SOURCES_FILE = 'project-sources.json';

export function getSourcesDir(): string {
  // Similar logic to existing getConfigDir()
  const paths = [
    join(process.cwd(), CONFIG_DIR, SOURCES_DIR),
    join(process.cwd(), '..', '..', CONFIG_DIR, SOURCES_DIR),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Sources directory not found`);
}

export function loadSourceEntry(sourceId: string): SourceEntry {
  const sourcesDir = getSourcesDir();
  const filePath = join(sourcesDir, `${sourceId}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const content = JSON.parse(readFileSync(filePath, 'utf-8'));
  return SourceEntrySchema.parse(content);
}

export function loadAllSources(): SourceEntry[] {
  const sourcesDir = getSourcesDir();
  const files = readdirSync(sourcesDir).filter(f => f.endsWith('.json') && f !== PROJECT_SOURCES_FILE);

  return files.map(f => {
    const content = JSON.parse(readFileSync(join(sourcesDir, f), 'utf-8'));
    return SourceEntrySchema.parse(content);
  });
}

export function loadProjectSources(projectId: string): SourceEntry[] {
  const sourcesDir = getSourcesDir();
  const mappingFile = join(sourcesDir, PROJECT_SOURCES_FILE);

  if (!existsSync(mappingFile)) {
    return []; // No sources configured
  }

  const mappings: ProjectSources[] = JSON.parse(readFileSync(mappingFile, 'utf-8'));
  const projectMapping = mappings.find(m => m.projectId === projectId);

  if (!projectMapping) {
    return [];
  }

  return projectMapping.sources.map(sid => loadSourceEntry(sid));
}

export function listSourceIds(): string[] {
  const sourcesDir = getSourcesDir();
  return readdirSync(sourcesDir)
    .filter(f => f.endsWith('.json') && f !== PROJECT_SOURCES_FILE)
    .map(f => f.replace('.json', ''));
}
```

#### 4. Create Directory Structure
**Directory**: `config/sources/` (NEW)

Create initial source files:

**File**: `config/sources/mina-o1js-official.json`
```json
{
  "id": "mina-o1js-official",
  "type": "github",
  "repoType": "sdk",
  "trustLevel": "official",
  "repo": "o1-labs/o1js",
  "branch": "main",
  "scrapeStrategy": {
    "apiPaths": [
      "src/lib/provable/*.ts",
      "src/lib/mina/*.ts",
      "src/lib/proof-system/*.ts"
    ],
    "exampleDirs": ["src/examples"],
    "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]
  },
  "qualityThresholds": {
    "minDocumentationScore": 20,
    "minLLMRelevanceScore": 40,
    "requireReadme": false
  },
  "description": "Official o1js SDK - core provable types and zkApp infrastructure",
  "maintainer": "o1-labs"
}
```

**File**: `config/sources/mina-zkapp-examples.json`
```json
{
  "id": "mina-zkapp-examples",
  "type": "github",
  "repoType": "example-repo",
  "trustLevel": "official",
  "repo": "o1-labs/zkapp-cli",
  "branch": "main",
  "scrapeStrategy": {
    "exampleDirs": ["examples", "templates"],
    "exclude": ["**/*.test.ts", "**/node_modules/**"]
  },
  "qualityThresholds": {
    "minDocumentationScore": 30,
    "minLLMRelevanceScore": 50,
    "requireReadme": true
  },
  "description": "Official zkApp CLI examples and project templates"
}
```

**File**: `config/sources/project-sources.json`
```json
[
  {
    "projectId": "mina",
    "sources": ["mina-o1js-official", "mina-zkapp-examples"]
  },
  {
    "projectId": "solana",
    "sources": []
  },
  {
    "projectId": "cosmos",
    "sources": []
  }
]
```

#### 5. Update Shared Package Exports
**File**: `packages/shared/src/index.ts`
**Changes**: Export new modules

```typescript
// Add to existing exports
export * from './config/source-registry.js';
export * from './config/load-sources.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Source registry files validate against schema: `npm run test:sources` (new script)
- [ ] Existing project configs still load correctly

#### Manual Verification:
- [ ] `config/sources/` directory exists with initial source files
- [ ] `loadProjectSources('mina')` returns the configured sources
- [ ] New metadata fields appear in TypeScript intellisense

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Intelligent GitHub Scraper

### Overview
Refactor the GitHub scraper to use the source registry and implement the multi-stage quality pipeline: directory filtering → documentation detection → LLM relevance validation.

### Changes Required:

#### 1. Create Quality Assessment Module
**File**: `packages/scraper/src/quality-assessor.ts` (NEW)
**Changes**: Implement quality scoring functions

```typescript
import OpenAI from 'openai';

export interface DocumentationScore {
  score: number; // 0-100
  hasReadme: boolean;
  hasJsDoc: boolean;
  hasInlineComments: boolean;
  commentDensity: number; // comments per line of code
}

export interface LLMRelevanceResult {
  score: number; // 0-100
  isUsefulExample: boolean;
  exampleDescription: string; // What this code demonstrates
  prerequisites: string[]; // Inferred prerequisites
  versionHint: string | null; // Inferred version compatibility
  reasoning: string; // Why this score
}

/**
 * Assess documentation quality of a code file
 */
export function assessDocumentation(
  content: string,
  readmeContent: string | null,
  language: string
): DocumentationScore {
  const lines = content.split('\n');
  const codeLines = lines.filter(l => l.trim() && !isComment(l, language)).length;
  const commentLines = lines.filter(l => isComment(l, language)).length;

  const hasJsDoc = /\/\*\*[\s\S]*?\*\//.test(content);
  const hasInlineComments = commentLines > 0;
  const commentDensity = codeLines > 0 ? commentLines / codeLines : 0;

  let score = 0;
  if (readmeContent) score += 40;
  if (hasJsDoc) score += 30;
  if (commentDensity > 0.1) score += 20;
  if (commentDensity > 0.2) score += 10;

  return {
    score: Math.min(100, score),
    hasReadme: !!readmeContent,
    hasJsDoc,
    hasInlineComments,
    commentDensity,
  };
}

function isComment(line: string, language: string): boolean {
  const trimmed = line.trim();
  if (language === 'typescript' || language === 'javascript') {
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  }
  if (language === 'rust') {
    return trimmed.startsWith('//') || trimmed.startsWith('///');
  }
  if (language === 'go') {
    return trimmed.startsWith('//');
  }
  return false;
}

/**
 * Use LLM to assess if code is a useful, index-worthy example
 */
export async function assessLLMRelevance(
  content: string,
  filePath: string,
  readmeContext: string | null,
  projectName: string,
  openaiApiKey: string
): Promise<LLMRelevanceResult> {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are evaluating whether a code file should be indexed as a useful example for developers learning ${projectName}.

File: ${filePath}
${readmeContext ? `README context:\n${readmeContext.slice(0, 1000)}\n` : ''}

Code:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

Evaluate this code and respond with JSON:
{
  "score": <0-100, where 100 is extremely useful example>,
  "isUsefulExample": <true if this demonstrates a concept developers would want to learn>,
  "exampleDescription": "<1-2 sentence description of what this code demonstrates, or 'N/A' if not useful>",
  "prerequisites": ["<prerequisite 1>", "<prerequisite 2>"],
  "versionHint": "<inferred version compatibility like 'o1js@>=0.15.0' or null>",
  "reasoning": "<brief explanation of your score>"
}

Scoring guidelines:
- 80-100: Complete, well-documented example that teaches a clear concept
- 60-79: Useful example but may lack context or documentation
- 40-59: Partially useful, might help as reference but not standalone
- 20-39: Internal utility code, not educational
- 0-19: Boilerplate, config, or completely irrelevant

Be strict. Most internal SDK code should score below 40.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      score: result.score || 0,
      isUsefulExample: result.isUsefulExample || false,
      exampleDescription: result.exampleDescription || 'N/A',
      prerequisites: result.prerequisites || [],
      versionHint: result.versionHint || null,
      reasoning: result.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('LLM relevance assessment failed:', error);
    return {
      score: 0,
      isUsefulExample: false,
      exampleDescription: 'Assessment failed',
      prerequisites: [],
      versionHint: null,
      reasoning: 'LLM call failed',
    };
  }
}
```

#### 2. Create README Context Extractor
**File**: `packages/scraper/src/readme-extractor.ts` (NEW)
**Changes**: Extract relevant context from READMEs

```typescript
export interface ReadmeContext {
  fullContent: string;
  relevantExcerpt: string; // Most relevant section for the code file
  title: string | null;
  description: string | null;
}

/**
 * Fetch README from same directory or parent directories
 */
export async function fetchReadmeContext(
  filePath: string,
  fetchFile: (path: string) => Promise<string | null>
): Promise<ReadmeContext | null> {
  const pathParts = filePath.split('/');

  // Try README in same directory, then parent directories
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const dirPath = pathParts.slice(0, i).join('/');
    const readmePaths = [
      `${dirPath}/README.md`,
      `${dirPath}/readme.md`,
      `${dirPath}/README`,
    ];

    for (const readmePath of readmePaths) {
      const content = await fetchFile(readmePath);
      if (content) {
        return parseReadme(content, filePath);
      }
    }
  }

  return null;
}

function parseReadme(content: string, targetFilePath: string): ReadmeContext {
  const fileName = targetFilePath.split('/').pop() || '';

  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : null;

  // Extract description (text after title, before next heading)
  const descMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n#|\n```|$)/);
  const description = descMatch ? descMatch[1].trim().slice(0, 500) : null;

  // Try to find section mentioning the specific file
  const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  const relevantSection = findRelevantSection(content, fileNameWithoutExt);

  return {
    fullContent: content,
    relevantExcerpt: relevantSection || description || content.slice(0, 1000),
    title,
    description,
  };
}

function findRelevantSection(content: string, fileName: string): string | null {
  // Look for section headers or paragraphs mentioning the file
  const regex = new RegExp(`(#{1,3}[^#]*${fileName}[\\s\\S]*?)(?=\\n#{1,3}|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].slice(0, 800) : null;
}
```

#### 3. Refactor GitHubSourceScraper
**File**: `packages/scraper/src/github-source.ts`
**Changes**: Integrate source registry, quality pipeline, and README context

```typescript
// Add imports at top
import type { GitHubSourceEntry } from '@mina-docs/shared';
import { assessDocumentation, assessLLMRelevance, type LLMRelevanceResult } from './quality-assessor.js';
import { fetchReadmeContext, type ReadmeContext } from './readme-extractor.js';

// Update GitHubScraperOptions
export interface GitHubScraperOptions {
  source: GitHubSourceEntry; // NEW: Use source registry entry instead of raw config
  token?: string;
  project: string;
  openaiApiKey: string; // NEW: Required for LLM assessment
}

// Add to GitHubSourceScraper class
export class GitHubSourceScraper {
  private source: GitHubSourceEntry;
  private openaiApiKey: string;
  private readmeCache: Map<string, ReadmeContext | null> = new Map();

  constructor(private options: GitHubScraperOptions) {
    this.source = options.source;
    this.openaiApiKey = options.openaiApiKey;
    // ... rest of constructor
  }

  /**
   * Determine if a file should be scraped based on repo type and path
   */
  shouldScrapeFile(filePath: string): { shouldScrape: boolean; reason: string } {
    const strategy = this.source.scrapeStrategy;
    const ext = '.' + (filePath.split('.').pop() || '');

    // Check extension
    if (!strategy.extensions.includes(ext)) {
      return { shouldScrape: false, reason: `Extension ${ext} not in allowed list` };
    }

    // Check exclusions
    if (strategy.exclude.some(pattern => minimatch(filePath, pattern))) {
      return { shouldScrape: false, reason: `Matches exclude pattern` };
    }

    // Repo-type specific logic
    if (this.source.repoType === 'sdk') {
      // SDK repos: only scrape apiPaths and exampleDirs
      const inApiPath = strategy.apiPaths?.some(p => minimatch(filePath, p)) || false;
      const inExampleDir = strategy.exampleDirs.some(dir => filePath.startsWith(dir + '/') || filePath.includes('/' + dir + '/'));

      if (!inApiPath && !inExampleDir) {
        return { shouldScrape: false, reason: `SDK repo: not in apiPaths or exampleDirs` };
      }
    } else {
      // Example/tutorial repos: prioritize example directories but allow others
      const inExampleDir = strategy.exampleDirs.some(dir => filePath.startsWith(dir + '/') || filePath.includes('/' + dir + '/'));
      // Still scrape non-example dirs but with higher quality threshold (handled later)
    }

    return { shouldScrape: true, reason: 'Passed directory filtering' };
  }

  /**
   * Run quality pipeline on a file
   */
  async assessFileQuality(
    filePath: string,
    content: string,
    language: string
  ): Promise<{
    shouldIndex: boolean;
    documentationScore: number;
    llmResult: LLMRelevanceResult | null;
    readmeContext: ReadmeContext | null;
    rejectionReason?: string;
  }> {
    const thresholds = this.source.qualityThresholds;

    // Step 1: Fetch README context
    const readmeContext = await this.getReadmeContext(filePath);

    // Step 2: Check README requirement
    if (thresholds.requireReadme && !readmeContext) {
      return {
        shouldIndex: false,
        documentationScore: 0,
        llmResult: null,
        readmeContext: null,
        rejectionReason: 'No README found in directory (required)',
      };
    }

    // Step 3: Assess documentation quality
    const docScore = assessDocumentation(content, readmeContext?.fullContent || null, language);

    if (docScore.score < thresholds.minDocumentationScore) {
      return {
        shouldIndex: false,
        documentationScore: docScore.score,
        llmResult: null,
        readmeContext,
        rejectionReason: `Documentation score ${docScore.score} below threshold ${thresholds.minDocumentationScore}`,
      };
    }

    // Step 4: LLM relevance assessment
    const llmResult = await assessLLMRelevance(
      content,
      filePath,
      readmeContext?.relevantExcerpt || null,
      this.project,
      this.openaiApiKey
    );

    if (llmResult.score < thresholds.minLLMRelevanceScore) {
      return {
        shouldIndex: false,
        documentationScore: docScore.score,
        llmResult,
        readmeContext,
        rejectionReason: `LLM relevance score ${llmResult.score} below threshold ${thresholds.minLLMRelevanceScore}: ${llmResult.reasoning}`,
      };
    }

    return {
      shouldIndex: true,
      documentationScore: docScore.score,
      llmResult,
      readmeContext,
    };
  }

  /**
   * Get README context with caching
   */
  private async getReadmeContext(filePath: string): Promise<ReadmeContext | null> {
    const dirPath = filePath.split('/').slice(0, -1).join('/');

    if (this.readmeCache.has(dirPath)) {
      return this.readmeCache.get(dirPath)!;
    }

    const context = await fetchReadmeContext(filePath, (p) => this.fetchFile(p));
    this.readmeCache.set(dirPath, context);
    return context;
  }

  /**
   * Fetch GitHub repo metadata (stars, forks, etc.)
   */
  async fetchRepoMetadata(): Promise<{ stars: number; forks: number; lastCommit: string } | null> {
    try {
      const url = `https://api.github.com/repos/${this.source.repo}`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;

      const data = await response.json();
      return {
        stars: data.stargazers_count,
        forks: data.forks_count,
        lastCommit: data.pushed_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Updated scrape method with quality pipeline
   */
  async *scrape(): AsyncGenerator<{ path: string; chunks: DocumentChunk[]; skipped: boolean; reason?: string }> {
    console.log(`\nScraping ${this.source.repo} (${this.source.repoType}, trust: ${this.source.trustLevel})`);

    const repoMetadata = await this.fetchRepoMetadata();
    const allFiles = await this.listAllFiles();

    let indexed = 0;
    let skipped = 0;

    for (const filePath of allFiles) {
      // Stage 1: Directory filtering
      const shouldScrape = this.shouldScrapeFile(filePath);
      if (!shouldScrape.shouldScrape) {
        skipped++;
        yield { path: filePath, chunks: [], skipped: true, reason: shouldScrape.reason };
        continue;
      }

      console.log(`  Evaluating: ${filePath}`);

      const content = await this.fetchFile(filePath);
      if (!content) {
        yield { path: filePath, chunks: [], skipped: true, reason: 'Failed to fetch' };
        continue;
      }

      const language = this.detectLanguage(filePath);

      // Stage 2 & 3: Quality assessment
      const quality = await this.assessFileQuality(filePath, content, language);

      if (!quality.shouldIndex) {
        console.log(`    ✗ Skipped: ${quality.rejectionReason}`);
        skipped++;
        yield { path: filePath, chunks: [], skipped: true, reason: quality.rejectionReason };
        continue;
      }

      console.log(`    ✓ Accepted (doc: ${quality.documentationScore}, llm: ${quality.llmResult?.score})`);

      // Parse and create chunks with enriched metadata
      const chunks = this.parseSourceFile(filePath, content);

      // Enrich chunks with quality metadata
      for (const chunk of chunks) {
        chunk.metadata.trustLevel = this.source.trustLevel;
        chunk.metadata.sourceId = this.source.id;
        chunk.metadata.qualityScore = quality.llmResult?.score;
        chunk.metadata.indexedReason = `Doc: ${quality.documentationScore}, LLM: ${quality.llmResult?.score}`;

        if (quality.llmResult) {
          chunk.metadata.exampleDescription = quality.llmResult.exampleDescription;
          chunk.metadata.prerequisites = quality.llmResult.prerequisites;
          chunk.metadata.versionHint = quality.llmResult.versionHint || undefined;
        }

        if (quality.readmeContext) {
          chunk.metadata.readmeContext = quality.readmeContext.relevantExcerpt;
        }

        if (repoMetadata) {
          chunk.metadata.repoStats = repoMetadata;
        }
      }

      indexed++;
      yield { path: filePath, chunks, skipped: false };

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\nCompleted: ${indexed} files indexed, ${skipped} skipped`);
  }
}
```

#### 4. Update Scraper Entry Point
**File**: `packages/scraper/src/index.ts`
**Changes**: Use source registry for scraping

Add function to scrape all sources for a project:

```typescript
import { loadProjectSources, type GitHubSourceEntry } from '@mina-docs/shared';

export async function scrapeProjectSources(
  projectId: string,
  options: { openaiApiKey: string; githubToken?: string }
): Promise<{ sourceId: string; chunks: DocumentChunk[]; stats: { indexed: number; skipped: number } }[]> {
  const sources = loadProjectSources(projectId);
  const results = [];

  for (const source of sources) {
    if (source.type !== 'github') continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Source: ${source.id} (${source.description || 'No description'})`);
    console.log(`${'='.repeat(60)}`);

    const scraper = new GitHubSourceScraper({
      source: source as GitHubSourceEntry,
      project: projectId,
      openaiApiKey: options.openaiApiKey,
      token: options.githubToken,
    });

    const chunks: DocumentChunk[] = [];
    let indexed = 0;
    let skipped = 0;

    for await (const result of scraper.scrape()) {
      if (result.skipped) {
        skipped++;
      } else {
        indexed++;
        chunks.push(...result.chunks);
      }
    }

    results.push({
      sourceId: source.id,
      chunks,
      stats: { indexed, skipped },
    });
  }

  return results;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Scraper runs without errors: `npm run scraper -- --project mina --dry-run`
- [ ] Quality assessor correctly identifies low-quality code (unit tests)

#### Manual Verification:
- [ ] Running scraper shows "Skipped" messages with clear reasons
- [ ] Indexed chunks have populated `trustLevel`, `qualityScore`, `exampleDescription`
- [ ] SDK repos only index from apiPaths and exampleDirs
- [ ] Example repos index more broadly but still skip low-quality files

**Implementation Note**: After completing this phase, pause for manual verification that the quality filtering is working as expected before proceeding.

---

## Phase 3: Trust Scoring & Search Integration

### Overview
Integrate trust levels and quality scores into the search ranking to surface higher-quality content first.

### Changes Required:

#### 1. Add Trust Weight to Hybrid Search
**File**: `packages/shared/src/search.ts`
**Changes**: Factor trust level into score calculation

```typescript
// Add trust level weights
const TRUST_WEIGHTS: Record<string, number> = {
  'official': 1.0,
  'verified-community': 0.85,
  'community': 0.7,
};

// In mergeResults function, apply trust weight
function applyTrustWeight(result: SearchResult): SearchResult {
  const trustLevel = result.chunk.metadata.trustLevel || 'community';
  const trustWeight = TRUST_WEIGHTS[trustLevel] || 0.7;

  return {
    ...result,
    score: result.score * trustWeight,
  };
}

// Apply before final sorting in search method
```

#### 2. Update Confidence Scoring
**File**: `packages/shared/src/confidence.ts`
**Changes**: Factor source quality into confidence calculation

```typescript
// Add source quality factor to ConfidenceFactors
export interface ConfidenceFactors {
  retrievalScore: number;
  coverageScore: number;
  answerQualityScore: number;
  sourceConsistency: number;
  sourceQualityScore: number; // NEW
}

// Calculate source quality score
function calculateSourceQualityScore(results: SearchResult[]): number {
  if (results.length === 0) return 0;

  let score = 0;

  // Trust level distribution
  const trustCounts = { official: 0, 'verified-community': 0, community: 0 };
  for (const r of results) {
    const trust = r.chunk.metadata.trustLevel || 'community';
    trustCounts[trust]++;
  }

  // More official sources = higher score
  const officialRatio = trustCounts.official / results.length;
  score += officialRatio * 40;

  // Average quality score from LLM assessment
  const qualityScores = results
    .map(r => r.chunk.metadata.qualityScore)
    .filter((s): s is number => s !== undefined);

  if (qualityScores.length > 0) {
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    score += (avgQuality / 100) * 40;
  }

  // Recency bonus (recent commits = more relevant)
  const recentSources = results.filter(r => {
    const lastCommit = r.chunk.metadata.repoStats?.lastCommit;
    if (!lastCommit) return false;
    const monthsAgo = (Date.now() - new Date(lastCommit).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsAgo < 6;
  }).length;

  score += (recentSources / results.length) * 20;

  return Math.min(100, score);
}

// Update FACTOR_WEIGHTS
const FACTOR_WEIGHTS = {
  retrievalScore: 0.25,
  coverageScore: 0.20,
  answerQualityScore: 0.25,
  sourceConsistency: 0.15,
  sourceQualityScore: 0.15, // NEW
};
```

#### 3. Update Context Formatter
**File**: `packages/server/src/tools/context-formatter.ts`
**Changes**: Show trust indicators in formatted output

```typescript
export function formatChunkWithMetadata(
  result: SearchResult,
  index: number,
  options: FormatOptions = {}
): string {
  const { chunk } = result;

  // Build trust indicator
  const trustIndicator = chunk.metadata.trustLevel === 'official'
    ? '[OFFICIAL]'
    : chunk.metadata.trustLevel === 'verified-community'
    ? '[VERIFIED]'
    : '[COMMUNITY]';

  // Quality indicator
  const qualityScore = chunk.metadata.qualityScore;
  const qualityIndicator = qualityScore
    ? `[Quality: ${qualityScore}/100]`
    : '';

  const sourceLabel = `[Source ${index + 1}] ${trustIndicator} ${qualityIndicator}`;

  // Include example description if available
  let contextSection = '';
  if (chunk.metadata.exampleDescription && chunk.metadata.exampleDescription !== 'N/A') {
    contextSection = `What this demonstrates: ${chunk.metadata.exampleDescription}\n`;
  }

  // Include prerequisites if available
  if (chunk.metadata.prerequisites && chunk.metadata.prerequisites.length > 0) {
    contextSection += `Prerequisites: ${chunk.metadata.prerequisites.join(', ')}\n`;
  }

  // Include version hint if available
  if (chunk.metadata.versionHint) {
    contextSection += `Version: ${chunk.metadata.versionHint}\n`;
  }

  // ... rest of formatting
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Search returns results sorted by combined score (relevance + trust)
- [ ] Confidence score includes source quality factor

#### Manual Verification:
- [ ] Official sources appear higher in results than community sources at similar relevance
- [ ] Response metadata shows trust level distribution
- [ ] Low-quality sources don't dominate results even if textually relevant

**Implementation Note**: After completing this phase, test with real queries to verify ranking behavior before proceeding.

---

## Phase 4: Metadata Enrichment Pipeline

### Overview
Enhance version inference, prerequisites extraction, and community validation signal collection.

### Changes Required:

#### 1. Version Inference Enhancement
**File**: `packages/scraper/src/version-inferrer.ts` (NEW)
**Changes**: Better version detection from imports and package.json

```typescript
export interface VersionInfo {
  packageName: string;
  versionConstraint: string; // e.g., ">=0.15.0"
  confidence: 'high' | 'medium' | 'low';
  source: 'package.json' | 'import' | 'comment' | 'inferred';
}

/**
 * Infer version from package.json in same directory
 */
export async function inferVersionFromPackageJson(
  fetchFile: (path: string) => Promise<string | null>,
  filePath: string,
  projectPackages: string[] // e.g., ['o1js', '@o1labs/snarkyjs']
): Promise<VersionInfo[]> {
  const dirPath = filePath.split('/').slice(0, -1).join('/');
  const packageJsonPaths = [
    `${dirPath}/package.json`,
    `${dirPath}/../package.json`,
  ];

  for (const pkgPath of packageJsonPaths) {
    const content = await fetchFile(pkgPath);
    if (!content) continue;

    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      const versions: VersionInfo[] = [];
      for (const pkgName of projectPackages) {
        if (deps[pkgName]) {
          versions.push({
            packageName: pkgName,
            versionConstraint: deps[pkgName],
            confidence: 'high',
            source: 'package.json',
          });
        }
      }

      if (versions.length > 0) return versions;
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * Infer version from import statements
 */
export function inferVersionFromImports(
  content: string,
  projectPackages: string[]
): VersionInfo[] {
  const versions: VersionInfo[] = [];

  // Look for version comments near imports
  // e.g., // o1js v0.15.0
  const versionCommentRegex = new RegExp(
    `(${projectPackages.join('|')})\\s*(?:v|@|version)?\\s*(\\d+\\.\\d+(?:\\.\\d+)?)`,
    'gi'
  );

  let match;
  while ((match = versionCommentRegex.exec(content)) !== null) {
    versions.push({
      packageName: match[1],
      versionConstraint: `>=${match[2]}`,
      confidence: 'medium',
      source: 'comment',
    });
  }

  return versions;
}
```

#### 2. GitHub API Integration for Repo Stats
**File**: `packages/scraper/src/github-metadata.ts` (NEW)
**Changes**: Comprehensive repo metadata fetching

```typescript
export interface RepoMetadata {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  lastCommit: string;
  lastRelease: string | null;
  license: string | null;
  topics: string[];
  isArchived: boolean;
  defaultBranch: string;
}

export async function fetchRepoMetadata(
  repo: string,
  headers: Record<string, string>
): Promise<RepoMetadata | null> {
  try {
    const [repoData, releasesData] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => r.json()),
      fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]);

    return {
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.watchers_count,
      openIssues: repoData.open_issues_count,
      lastCommit: repoData.pushed_at,
      lastRelease: releasesData?.tag_name || null,
      license: repoData.license?.spdx_id || null,
      topics: repoData.topics || [],
      isArchived: repoData.archived,
      defaultBranch: repoData.default_branch,
    };
  } catch (error) {
    console.error(`Failed to fetch metadata for ${repo}:`, error);
    return null;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Version inference correctly extracts from package.json
- [ ] Repo metadata includes stars, forks, last commit

#### Manual Verification:
- [ ] Indexed chunks show version hints where detectable
- [ ] Repo stats appear in chunk metadata
- [ ] Old/archived repos are flagged appropriately

---

## Phase 5: Source Discovery CLI

### Overview
Create a CLI tool for discovering and approving new sources.

### Changes Required:

#### 1. Create Discovery Module
**File**: `packages/scraper/src/source-discovery.ts` (NEW)
**Changes**: GitHub search integration and awesome-list parsing

```typescript
export interface DiscoveredSource {
  repo: string;
  description: string;
  stars: number;
  lastUpdated: string;
  relevanceScore: number;
  suggestedTrustLevel: 'verified-community' | 'community';
  suggestedRepoType: 'example-repo' | 'ecosystem-lib';
  matchReason: string;
}

/**
 * Search GitHub for repos related to a project
 */
export async function discoverGitHubSources(
  project: string,
  searchTerms: string[],
  headers: Record<string, string>,
  options: { minStars?: number; maxResults?: number } = {}
): Promise<DiscoveredSource[]> {
  const { minStars = 10, maxResults = 20 } = options;

  const query = searchTerms.map(t => `${t} in:name,description,readme`).join(' OR ');
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${maxResults}`;

  const response = await fetch(url, { headers });
  const data = await response.json();

  return data.items
    .filter((repo: any) => repo.stargazers_count >= minStars && !repo.archived)
    .map((repo: any) => ({
      repo: repo.full_name,
      description: repo.description || '',
      stars: repo.stargazers_count,
      lastUpdated: repo.pushed_at,
      relevanceScore: calculateRelevance(repo, searchTerms),
      suggestedTrustLevel: repo.stargazers_count > 100 ? 'verified-community' : 'community',
      suggestedRepoType: inferRepoType(repo),
      matchReason: `Matched search terms: ${searchTerms.join(', ')}`,
    }));
}

/**
 * Parse awesome-list for curated sources
 */
export async function parseAwesomeList(
  awesomeRepo: string,
  headers: Record<string, string>
): Promise<DiscoveredSource[]> {
  // Fetch README from awesome-list repo
  const url = `https://api.github.com/repos/${awesomeRepo}/readme`;
  const response = await fetch(url, { headers });
  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  // Parse GitHub links from markdown
  const linkRegex = /\[([^\]]+)\]\(https:\/\/github\.com\/([^)]+)\)/g;
  const sources: DiscoveredSource[] = [];

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const [_, title, repoPath] = match;
    const repo = repoPath.replace(/\/$/, '').split('/').slice(0, 2).join('/');

    sources.push({
      repo,
      description: title,
      stars: 0, // Would need additional API call
      lastUpdated: '',
      relevanceScore: 70, // Curated lists are generally relevant
      suggestedTrustLevel: 'verified-community',
      suggestedRepoType: 'example-repo',
      matchReason: `Listed in ${awesomeRepo}`,
    });
  }

  return sources;
}
```

#### 2. Create CLI Commands
**File**: `packages/scraper/src/cli/discover.ts` (NEW)
**Changes**: Interactive CLI for source discovery

```typescript
import { input, confirm, select } from '@inquirer/prompts';
import { discoverGitHubSources, parseAwesomeList } from '../source-discovery.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export async function runDiscoveryWizard(projectId: string) {
  console.log(`\nSource Discovery for: ${projectId}`);
  console.log('='.repeat(40));

  // Get search terms
  const searchTermsInput = await input({
    message: 'Enter search terms (comma-separated):',
    default: projectId,
  });
  const searchTerms = searchTermsInput.split(',').map(t => t.trim());

  // Discover sources
  console.log('\nSearching GitHub...');
  const discovered = await discoverGitHubSources(projectId, searchTerms, {
    'User-Agent': 'crypto-docs-discovery',
  });

  console.log(`\nFound ${discovered.length} potential sources:\n`);

  // Review each source
  for (const source of discovered) {
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Repo: ${source.repo}`);
    console.log(`Stars: ${source.stars} | Last updated: ${source.lastUpdated}`);
    console.log(`Description: ${source.description}`);
    console.log(`Suggested: ${source.suggestedTrustLevel} / ${source.suggestedRepoType}`);

    const action = await select({
      message: 'Action:',
      choices: [
        { name: 'Skip', value: 'skip' },
        { name: 'Add as suggested', value: 'add' },
        { name: 'Add with modifications', value: 'modify' },
      ],
    });

    if (action === 'add' || action === 'modify') {
      let trustLevel = source.suggestedTrustLevel;
      let repoType = source.suggestedRepoType;

      if (action === 'modify') {
        trustLevel = await select({
          message: 'Trust level:',
          choices: [
            { name: 'verified-community', value: 'verified-community' },
            { name: 'community', value: 'community' },
          ],
        });

        repoType = await select({
          message: 'Repo type:',
          choices: [
            { name: 'example-repo', value: 'example-repo' },
            { name: 'ecosystem-lib', value: 'ecosystem-lib' },
            { name: 'tutorial-repo', value: 'tutorial-repo' },
          ],
        });
      }

      // Generate source config
      const sourceId = source.repo.replace('/', '-').toLowerCase();
      const config = {
        id: sourceId,
        type: 'github',
        repoType,
        trustLevel,
        repo: source.repo,
        branch: 'main',
        scrapeStrategy: {
          exampleDirs: ['examples', 'demos', 'tutorials', 'samples'],
          exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
        },
        qualityThresholds: {
          minDocumentationScore: 30,
          minLLMRelevanceScore: 50,
          requireReadme: true,
        },
        description: source.description,
        addedAt: new Date().toISOString(),
      };

      // Save to file
      const filePath = join(process.cwd(), 'config', 'sources', `${sourceId}.json`);
      writeFileSync(filePath, JSON.stringify(config, null, 2));
      console.log(`✓ Saved: ${filePath}`);
    }
  }

  console.log('\nDiscovery complete!');
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] CLI runs without errors: `npm run discover -- --project mina`

#### Manual Verification:
- [ ] Discovery finds relevant repos for search terms
- [ ] Interactive prompts work correctly
- [ ] Generated source configs are valid JSON matching schema

---

## Phase 6: Migration & Backward Compatibility

### Overview
Migrate existing project configs to use the source registry while maintaining backward compatibility.

### Changes Required:

#### 1. Update Project Config Loading
**File**: `packages/shared/src/config/load-config.ts`
**Changes**: Support both old and new config formats

```typescript
export async function loadProjectConfigWithSources(projectId: string): Promise<{
  config: ProjectConfig;
  sources: SourceEntry[];
}> {
  const config = loadProjectConfig(projectId);

  // Check if project uses source registry
  const registrySources = loadProjectSources(projectId);

  if (registrySources.length > 0) {
    // Use source registry
    return { config, sources: registrySources };
  }

  // Backward compatibility: convert old github config to source entry
  if (config.github) {
    const legacySource: GitHubSourceEntry = {
      id: `${projectId}-legacy`,
      type: 'github',
      repoType: 'sdk',
      trustLevel: 'official',
      repo: config.github.repo,
      branch: config.github.branch,
      scrapeStrategy: {
        apiPaths: config.github.include,
        exampleDirs: [],
        exclude: config.github.exclude,
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.rs', '.go'],
      },
      qualityThresholds: {
        minDocumentationScore: 0, // Legacy: no filtering
        minLLMRelevanceScore: 0,
        requireReadme: false,
      },
    };

    return { config, sources: [legacySource] };
  }

  return { config, sources: [] };
}
```

#### 2. Migration Script
**File**: `scripts/migrate-to-source-registry.ts` (NEW)
**Changes**: One-time migration of existing configs

```typescript
/**
 * Migrate existing project github configs to source registry
 */
import { loadAllProjectConfigs } from '@mina-docs/shared';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

async function migrate() {
  const sourcesDir = join(process.cwd(), 'config', 'sources');

  if (!existsSync(sourcesDir)) {
    mkdirSync(sourcesDir, { recursive: true });
  }

  const configs = loadAllProjectConfigs();
  const projectSources: { projectId: string; sources: string[] }[] = [];

  for (const config of configs) {
    if (!config.github) {
      projectSources.push({ projectId: config.id, sources: [] });
      continue;
    }

    const sourceId = `${config.id}-official`;
    const source = {
      id: sourceId,
      type: 'github',
      repoType: 'sdk',
      trustLevel: 'official',
      repo: config.github.repo,
      branch: config.github.branch,
      scrapeStrategy: {
        apiPaths: config.github.include,
        exampleDirs: ['examples'],
        exclude: config.github.exclude,
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.rs', '.go'],
      },
      qualityThresholds: {
        minDocumentationScore: 20,
        minLLMRelevanceScore: 40,
        requireReadme: false,
      },
      description: `Official ${config.name} SDK`,
      maintainer: config.github.repo.split('/')[0],
    };

    writeFileSync(
      join(sourcesDir, `${sourceId}.json`),
      JSON.stringify(source, null, 2)
    );

    projectSources.push({ projectId: config.id, sources: [sourceId] });
    console.log(`✓ Migrated ${config.id} → ${sourceId}`);
  }

  // Write project-sources mapping
  writeFileSync(
    join(sourcesDir, 'project-sources.json'),
    JSON.stringify(projectSources, null, 2)
  );

  console.log('\nMigration complete!');
}

migrate().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Migration script runs without errors: `npx tsx scripts/migrate-to-source-registry.ts`
- [ ] All existing project configs still work

#### Manual Verification:
- [ ] Scraper works with both old-style and new-style configs
- [ ] No breaking changes to existing API
- [ ] Generated source files match expected schema

---

## Testing Strategy

### Unit Tests:
- Quality assessor correctly scores documentation
- LLM relevance mock returns expected format
- Directory filtering respects repo type
- Trust weight calculation is correct
- Version inference extracts from package.json

### Integration Tests:
- End-to-end scrape of a test repo with quality filtering
- Search results correctly weighted by trust level
- Source registry loads and validates correctly

### Manual Testing Steps:
1. Add a new community source via CLI discovery
2. Run scraper and verify quality filtering logs
3. Query the MCP server and verify trust indicators appear
4. Compare search results before/after trust weighting

---

## Performance Considerations

- **LLM calls add latency**: Each file assessment requires an API call. Consider batching or caching.
- **GitHub API rate limits**: 60 requests/hour unauthenticated, 5000/hour with token. Use token for scraping.
- **Database size**: More sources = more chunks. Monitor Qdrant memory usage.
- **Search latency**: Trust weighting is O(n) on results, negligible impact.

---

## Migration Notes

1. **Existing data remains valid**: Old chunks without `trustLevel` default to 'community'
2. **Re-scrape recommended**: After migration, re-scrape to populate new metadata
3. **No breaking API changes**: All new fields are optional in responses
4. **Gradual rollout**: Can enable source registry per-project

---

## References

- Existing GitHub scraper: `packages/scraper/src/github-source.ts`
- Project config schema: `packages/shared/src/config/project-config.ts`
- Confidence scoring: `packages/shared/src/confidence.ts`
- Search implementation: `packages/shared/src/search.ts`
