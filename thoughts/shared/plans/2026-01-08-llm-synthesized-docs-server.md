# LLM-Synthesized Documentation Server Implementation Plan

## Overview

Transform the crypto-docs MCP server from a "chunk retriever" into an "answer synthesizer" that provides complete, actionable responses to coding agents. Instead of returning raw documentation chunks, the server will use OpenAI to synthesize comprehensive answers with code examples, imports, and citations.

## Current State Analysis

### What Exists Now
- 8 MCP tools that all essentially do the same thing: search for chunks and return them formatted
- Hybrid search (vector + FTS with reciprocal rank fusion)
- OpenAI integration for embeddings only
- Chunk types: prose, code, api-reference

### The Problem
A coding agent asking "How do I transfer tokens in Mina?" gets back:
- 3-5 disconnected chunks
- No synthesis or explanation
- Missing imports, prerequisites, or complete examples
- Agent must piece together the answer itself

### Key Discoveries
- All current tools are thin wrappers around the same search (`packages/server/src/tools/*.ts`)
- OpenAI client already available via embeddings module (`packages/shared/src/embeddings.ts`)
- Hybrid search with RRF already implemented (`packages/shared/src/search.ts:85-124`)
- No reranking step currently exists

## Desired End State

After implementation, a coding agent asking "How do I transfer tokens in Mina?" gets:

```markdown
## Answer

To transfer tokens in Mina using o1js, you need to create a transaction that calls
the `send()` method on a token account. Here's a complete working example:

### Prerequisites
- o1js v1.0.0 or later
- A funded Mina account (sender)
- Network connection to Mina devnet or mainnet

### Complete Example

```typescript
import { Mina, PrivateKey, PublicKey, UInt64, AccountUpdate } from 'o1js';

// Setup network
const Network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
Mina.setActiveInstance(Network);

// Your keys
const senderKey = PrivateKey.fromBase58('...');
const senderAddress = senderKey.toPublicKey();
const receiverAddress = PublicKey.fromBase58('...');

// Create and send transaction
const tx = await Mina.transaction(senderAddress, async () => {
  const update = AccountUpdate.createSigned(senderAddress);
  update.send({ to: receiverAddress, amount: UInt64.from(1_000_000_000) }); // 1 MINA
});

await tx.prove();
await tx.sign([senderKey]).send();
```

### Important Notes
- Amounts are in nanomina (1 MINA = 1,000,000,000 nanomina)
- Transactions require proving, which takes ~10-30 seconds
- Always handle errors for network issues

### Sources
- [Token Operations - Mina Docs](https://docs.minaprotocol.com/...)
- [AccountUpdate API Reference](https://docs.minaprotocol.com/...)
```

### Verification Criteria
- Agent can copy-paste code and it works (with their keys)
- All imports are included
- Prerequisites are clear
- Common gotchas are mentioned
- Sources are cited for verification

## What We're NOT Doing

1. **Agentic retrieval** - No inner planning loop; single retrieve→rerank→synthesize flow
2. **Contextual chunk enhancement** - Deferred to future iteration (requires reindexing)
3. **Multiple LLM providers** - OpenAI only for now
4. **Streaming responses** - Full response returned (MCP doesn't support streaming well)
5. **Caching synthesized answers** - Each query is fresh (could add later)

## Implementation Approach

The implementation follows a bottom-up approach:
1. Add LLM synthesis infrastructure
2. Add reranking for quality retrieval
3. Create new synthesized tools
4. Remove old chunk-returning tools

---

## Phase 1: LLM Synthesis Infrastructure

### Overview
Add OpenAI chat completion capability and synthesis prompt templates.

### Changes Required:

#### 1. Create LLM Module
**File**: `packages/shared/src/llm.ts` (NEW)

```typescript
import OpenAI from 'openai';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SynthesisOptions {
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.3;

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_MODEL;
    this.defaultMaxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
    this.defaultTemperature = config.temperature || DEFAULT_TEMPERATURE;
  }

  async synthesize(
    systemPrompt: string,
    userPrompt: string,
    options: SynthesisOptions = {}
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: options.maxTokens || this.defaultMaxTokens,
      temperature: options.temperature || this.defaultTemperature
    });

    return response.choices[0]?.message?.content || '';
  }
}
```

#### 2. Create Synthesis Prompts Module
**File**: `packages/server/src/prompts/index.ts` (NEW)

```typescript
export const PROMPTS = {
  // General Q&A synthesis
  askDocs: {
    system: `You are an expert documentation assistant for blockchain development. Your job is to synthesize information from documentation into complete, actionable answers.

CRITICAL RULES:
1. ONLY use information from the provided documentation chunks. Never make up information.
2. If the documentation doesn't contain enough information, say "I don't have complete information about [topic]. The documentation covers [what it does cover]."
3. Always include source citations using [Source N] format.
4. For code questions, provide COMPLETE working examples with ALL imports.
5. Mention prerequisites, common gotchas, and important notes.
6. Use clear markdown formatting.

OUTPUT FORMAT:
- Start with a direct answer to the question
- Include code examples with full imports when relevant
- Add "Prerequisites" section if setup is needed
- Add "Important Notes" section for gotchas
- End with "Sources" listing the documentation URLs used`,

    user: (query: string, context: string, project: string) => `
PROJECT: ${project}

DOCUMENTATION CHUNKS:
${context}

QUESTION: ${query}

Provide a complete, actionable answer based on the documentation above.`
  },

  // Complete working example synthesis
  workingExample: {
    system: `You are an expert code documentation assistant. Your job is to synthesize complete, runnable code examples from documentation.

CRITICAL RULES:
1. ONLY use code patterns from the provided documentation. Never invent APIs.
2. Include ALL necessary imports at the top.
3. Include ALL type definitions needed.
4. Add comments explaining each significant step.
5. If you can't create a complete example from the docs, say what's missing.
6. Include setup/configuration code if needed.

OUTPUT FORMAT:
## Complete Example: [Task Name]

### Prerequisites
- [Required packages/setup]

### Full Code
\`\`\`[language]
// Complete, runnable code with all imports
\`\`\`

### Step-by-Step Explanation
1. [Explain each major step]

### Common Variations
- [Alternative approaches if documented]

### Sources
- [URLs used]`,

    user: (task: string, context: string, project: string) => `
PROJECT: ${project}

DOCUMENTATION CHUNKS:
${context}

TASK: ${task}

Create a complete, runnable code example for this task.`
  },

  // Error explanation synthesis
  explainError: {
    system: `You are an expert debugging assistant for blockchain development. Your job is to help developers understand and fix errors.

CRITICAL RULES:
1. ONLY provide solutions documented in the provided chunks. Don't guess.
2. If the error isn't covered in the docs, say so clearly.
3. Provide the specific fix, not just general advice.
4. Include code showing the fix when possible.

OUTPUT FORMAT:
## Error Analysis: [Brief Error Summary]

### What This Error Means
[Clear explanation]

### Likely Cause
[Most common cause based on docs]

### How to Fix
[Specific fix with code if applicable]

### Prevention
[How to avoid this in the future]

### Sources
- [URLs used]`,

    user: (error: string, errorContext: string, chunks: string, project: string) => `
PROJECT: ${project}

ERROR MESSAGE:
${error}

CONTEXT (what user was doing):
${errorContext || 'Not provided'}

DOCUMENTATION CHUNKS:
${chunks}

Explain this error and how to fix it based on the documentation.`
  }
};
```

#### 3. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add LLM export

```typescript
// Add at end of file:
export * from './llm.js';
```

#### 4. Add Server Configuration for LLM
**File**: `packages/server/src/config.ts`
**Changes**: Add LLM config options

```typescript
import { z } from 'zod';

export const ServerConfigSchema = z.object({
  // Existing config...
  qdrantUrl: z.string().default('http://localhost:6333'),
  qdrantCollection: z.string().default('crypto_docs'),
  sqlitePath: z.string().default('./data/crypto_docs.db'),
  openaiApiKey: z.string(),

  // NEW: LLM synthesis config
  llm: z.object({
    model: z.string().default('gpt-4o'),
    maxTokens: z.number().default(4000),
    temperature: z.number().default(0.3)
  }).default({})
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadServerConfig(): ServerConfig {
  return ServerConfigSchema.parse({
    qdrantUrl: process.env.QDRANT_URL,
    qdrantCollection: process.env.QDRANT_COLLECTION,
    sqlitePath: process.env.SQLITE_PATH,
    openaiApiKey: process.env.OPENAI_API_KEY,
    llm: {
      model: process.env.LLM_MODEL,
      maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : undefined,
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined
    }
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build` in packages/shared and packages/server
- [ ] LLMClient can be instantiated without errors

#### Manual Verification:
- [ ] Test LLMClient.synthesize() with a simple prompt returns valid response

**Implementation Note**: After completing this phase, test the LLM module in isolation before proceeding.

---

## Phase 2: Enhanced Retrieval with Reranking

### Overview
Add a reranking step to improve retrieval quality before synthesis.

### Changes Required:

#### 1. Create Reranker Module
**File**: `packages/shared/src/reranker.ts` (NEW)

```typescript
import OpenAI from 'openai';
import type { SearchResult } from './types.js';

export interface RerankerConfig {
  apiKey: string;
  model?: string;
}

export interface RerankerOptions {
  topK?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast model for reranking
const DEFAULT_TOP_K = 10;

export class Reranker {
  private client: OpenAI;
  private model: string;

  constructor(config: RerankerConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_MODEL;
  }

  async rerank(
    query: string,
    results: SearchResult[],
    options: RerankerOptions = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK || DEFAULT_TOP_K;

    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    // Create scoring prompt
    const documents = results.map((r, i) => ({
      index: i,
      title: r.chunk.title,
      section: r.chunk.section,
      preview: r.chunk.content.slice(0, 500)
    }));

    const prompt = `You are a document relevance scorer. Rate how relevant each document is to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map(d => `[${d.index}] ${d.title} - ${d.section}
${d.preview}...
`).join('\n')}

Return a JSON array of the ${topK} most relevant document indices, ordered by relevance (most relevant first).
Example: [3, 1, 7, 0, 5]

Only return the JSON array, nothing else.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0
      });

      const content = response.choices[0]?.message?.content || '[]';
      const indices: number[] = JSON.parse(content);

      // Return results in reranked order
      return indices
        .filter(i => i >= 0 && i < results.length)
        .map(i => results[i])
        .slice(0, topK);
    } catch (error) {
      console.error('Reranking failed, returning original order:', error);
      return results.slice(0, topK);
    }
  }
}
```

#### 2. Update HybridSearch to Support Reranking
**File**: `packages/shared/src/search.ts`
**Changes**: Add reranking option to search

```typescript
import type { DocumentChunk, SearchResult } from './types.js';
import { VectorDB } from './db/vector.js';
import { FullTextDB } from './db/fts.js';
import { generateSingleEmbedding } from './embeddings.js';
import { Reranker } from './reranker.js';

export interface HybridSearchOptions {
  vectorDb: VectorDB;
  ftsDb: FullTextDB;
  openaiApiKey: string;
  reranker?: Reranker; // NEW: optional reranker
}

export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string;
  mode?: 'hybrid' | 'vector' | 'fts';
  rerank?: boolean; // NEW: enable reranking
  rerankTopK?: number; // NEW: how many to return after reranking
}

export class HybridSearch {
  constructor(private options: HybridSearchOptions) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      contentType,
      project,
      mode = 'hybrid',
      rerank = false,
      rerankTopK = 10
    } = options;

    // Fetch more candidates if reranking
    const fetchLimit = rerank ? Math.max(limit * 3, 30) : limit;

    let results: SearchResult[];

    if (mode === 'fts') {
      results = await this.ftsSearch(query, { limit: fetchLimit, contentType, project });
    } else if (mode === 'vector') {
      results = await this.vectorSearch(query, { limit: fetchLimit, contentType, project });
    } else {
      // Hybrid: combine vector and FTS results
      const [vectorResults, ftsResults] = await Promise.all([
        this.vectorSearch(query, { limit: fetchLimit, contentType, project }),
        this.ftsSearch(query, { limit: fetchLimit, contentType, project })
      ]);
      results = this.reciprocalRankFusion(vectorResults, ftsResults, fetchLimit);
    }

    // Apply reranking if enabled and reranker is available
    if (rerank && this.options.reranker && results.length > rerankTopK) {
      results = await this.options.reranker.rerank(query, results, { topK: rerankTopK });
    }

    return results.slice(0, limit);
  }

  // ... rest of existing methods unchanged
}
```

#### 3. Export Reranker from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add reranker export

```typescript
export * from './reranker.js';
```

#### 4. Update Server Initialization
**File**: `packages/server/src/index.ts`
**Changes**: Initialize reranker and pass to search

```typescript
import {
  VectorDB,
  FullTextDB,
  HybridSearch,
  Reranker,
  LLMClient
} from '@mina-docs/shared';

// In initialization:
const reranker = new Reranker({ apiKey: config.openaiApiKey });
const llmClient = new LLMClient({
  apiKey: config.openaiApiKey,
  model: config.llm.model,
  maxTokens: config.llm.maxTokens,
  temperature: config.llm.temperature
});

const search = new HybridSearch({
  vectorDb,
  ftsDb,
  openaiApiKey: config.openaiApiKey,
  reranker // NEW
});

// Update tool context
const toolContext = {
  search,
  ftsDb,
  llmClient // NEW
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] Reranker module exports correctly

#### Manual Verification:
- [ ] Test search with rerank=true returns reordered results
- [ ] Verify reranking improves relevance for test queries

**Implementation Note**: After completing this phase, compare search quality with and without reranking.

---

## Phase 3: New Synthesized Tools

### Overview
Replace the 8 existing tools with 4 new tools that synthesize answers.

### Changes Required:

#### 1. Update Tool Context Type
**File**: `packages/server/src/tools/index.ts`
**Changes**: Add LLMClient to context

```typescript
import type { HybridSearch, FullTextDB, LLMClient } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  llmClient: LLMClient; // NEW
}
```

#### 2. Create `ask_docs` Tool
**File**: `packages/server/src/tools/ask-docs.ts` (NEW)

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

export const AskDocsSchema = z.object({
  question: z.string().describe('Your question about the documentation'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type AskDocsArgs = z.infer<typeof AskDocsSchema>;

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Retrieve with reranking for quality
  const results = await context.search.search(args.question, {
    limit: 10,
    project: args.project,
    rerank: true,
    rerankTopK: 10
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
      }]
    };
  }

  // 2. Format chunks as context with source numbers
  const contextChunks = results.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    return `${sourceLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize answer
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append source URLs at the end for reference
  const sources = results.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${answer}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
```

#### 3. Create `get_working_example` Tool
**File**: `packages/server/src/tools/working-example.ts` (NEW)

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

export const GetWorkingExampleSchema = z.object({
  task: z.string().describe('What you want to accomplish (e.g., "transfer tokens", "deploy smart contract")'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type GetWorkingExampleArgs = z.infer<typeof GetWorkingExampleSchema>;

export async function getWorkingExample(
  args: GetWorkingExampleArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Search for code examples and related prose
  const [codeResults, proseResults] = await Promise.all([
    context.search.search(args.task, {
      limit: 15,
      project: args.project,
      contentType: 'code',
      rerank: true,
      rerankTopK: 8
    }),
    context.search.search(`${args.task} tutorial guide how to`, {
      limit: 10,
      project: args.project,
      contentType: 'prose',
      rerank: true,
      rerankTopK: 5
    })
  ]);

  const allResults = [...codeResults, ...proseResults];

  if (allResults.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No code examples found for "${args.task}" in ${args.project}. Try different keywords or check the project name.`
      }]
    };
  }

  // 2. Format context
  const contextChunks = allResults.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    const typeLabel = r.chunk.contentType === 'code' ? '[CODE]' : '[DOCS]';
    return `${sourceLabel} ${typeLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
${r.chunk.contentType === 'code' ? `Language: ${r.chunk.metadata.codeLanguage || 'unknown'}` : ''}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize complete example
  const example = await context.llmClient.synthesize(
    PROMPTS.workingExample.system,
    PROMPTS.workingExample.user(args.task, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append sources
  const sources = allResults.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${example}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
```

#### 4. Create `explain_error` Tool
**File**: `packages/server/src/tools/explain-error.ts` (NEW)

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

export const ExplainErrorSchema = z.object({
  error: z.string().describe('The error message or description'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  context: z.string().optional().describe('What you were trying to do when the error occurred'),
  maxTokens: z.number().optional().default(2000).describe('Maximum response length (default: 2000)')
});

type ExplainErrorArgs = z.infer<typeof ExplainErrorSchema>;

export async function explainError(
  args: ExplainErrorArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Search for error-related content
  const searchQuery = args.context
    ? `${args.error} ${args.context} error fix troubleshoot`
    : `${args.error} error fix troubleshoot`;

  const results = await context.search.search(searchQuery, {
    limit: 15,
    project: args.project,
    rerank: true,
    rerankTopK: 8
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for this error in ${args.project}. The error might be:
1. A runtime environment issue (check your setup)
2. A version mismatch (check package versions)
3. Not documented yet

Try searching the project's GitHub issues or community forums.`
      }]
    };
  }

  // 2. Format context
  const contextChunks = results.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    return `${sourceLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize error explanation
  const explanation = await context.llmClient.synthesize(
    PROMPTS.explainError.system,
    PROMPTS.explainError.user(args.error, args.context || '', contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append sources
  const sources = results.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${explanation}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
```

#### 5. Create `search_docs` Tool (Raw Search)
**File**: `packages/server/src/tools/search-docs.ts` (NEW)

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';

export const SearchDocsSchema = z.object({
  query: z.string().describe('Search query'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional().describe('Filter by content type'),
  limit: z.number().optional().default(10).describe('Maximum results (default: 10)')
});

type SearchDocsArgs = z.infer<typeof SearchDocsSchema>;

export async function searchDocs(
  args: SearchDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const results = await context.search.search(args.query, {
    limit: args.limit,
    project: args.project,
    contentType: args.contentType,
    rerank: true,
    rerankTopK: args.limit
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No results found for "${args.query}" in ${args.project}.`
      }]
    };
  }

  const formatted = results.map((r, i) => {
    const content = r.chunk.contentType === 'code'
      ? '```' + (r.chunk.metadata.codeLanguage || '') + '\n' + r.chunk.content + '\n```'
      : r.chunk.content;

    return `## ${i + 1}. ${r.chunk.title} - ${r.chunk.section}
**Type:** ${r.chunk.contentType} | **URL:** ${r.chunk.url}

${content}`;
  }).join('\n\n---\n\n');

  return {
    content: [{
      type: 'text',
      text: `# Search Results: "${args.query}" (${args.project})\n\n${formatted}`
    }]
  };
}
```

#### 6. Update Tool Definitions and Handler
**File**: `packages/server/src/tools/index.ts`
**Changes**: Replace old tools with new ones

```typescript
import { askDocs, AskDocsSchema } from './ask-docs.js';
import { getWorkingExample, GetWorkingExampleSchema } from './working-example.js';
import { explainError, ExplainErrorSchema } from './explain-error.js';
import { searchDocs, SearchDocsSchema } from './search-docs.js';
import { listProjectsTool, ListProjectsSchema } from './list-projects.js';
import type { HybridSearch, FullTextDB, LLMClient } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
  llmClient: LLMClient;
}

export function getToolDefinitions() {
  return [
    {
      name: 'list_projects',
      description: 'List all available documentation projects. Use this first to see what projects are available.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'ask_docs',
      description: 'Ask a question about project documentation. Returns a synthesized, comprehensive answer with code examples, explanations, and source citations. Best for: "How do I...", "What is...", "Explain..."',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'Your question about the documentation'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 4000)'
          }
        },
        required: ['question', 'project']
      }
    },
    {
      name: 'get_working_example',
      description: 'Get a complete, runnable code example for a task. Returns code with ALL imports, type definitions, setup, and step-by-step explanation. Best for: "Show me how to...", "Code for...", "Example of..."',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: {
            type: 'string',
            description: 'What you want to accomplish (e.g., "transfer tokens", "deploy smart contract")'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 4000)'
          }
        },
        required: ['task', 'project']
      }
    },
    {
      name: 'explain_error',
      description: 'Get help understanding and fixing an error. Returns the error cause, how to fix it, and how to prevent it. Best for debugging.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'string',
            description: 'The error message or description'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          context: {
            type: 'string',
            description: 'What you were trying to do when the error occurred (optional but helps)'
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum response length (default: 2000)'
          }
        },
        required: ['error', 'project']
      }
    },
    {
      name: 'search_docs',
      description: 'Search documentation and return raw chunks. Use this for browsing or when you need the exact documentation text. For answered questions, use ask_docs instead.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          project: {
            type: 'string',
            description: 'Project to search (e.g., "mina", "solana", "cosmos")'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter by content type (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)'
          }
        },
        required: ['query', 'project']
      }
    }
  ];
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const parsedArgs = args || {};

    switch (name) {
      case 'list_projects':
        return await listProjectsTool(ListProjectsSchema.parse(parsedArgs));

      case 'ask_docs':
        return await askDocs(AskDocsSchema.parse(parsedArgs), context);

      case 'get_working_example':
        return await getWorkingExample(GetWorkingExampleSchema.parse(parsedArgs), context);

      case 'explain_error':
        return await explainError(ExplainErrorSchema.parse(parsedArgs), context);

      case 'search_docs':
        return await searchDocs(SearchDocsSchema.parse(parsedArgs), context);

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        };
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
```

#### 7. Delete Old Tool Files
Delete these files (no longer needed):
- `packages/server/src/tools/search.ts`
- `packages/server/src/tools/examples.ts`
- `packages/server/src/tools/explain.ts`
- `packages/server/src/tools/debug.ts`
- `packages/server/src/tools/api-signatures.ts`
- `packages/server/src/tools/imports.ts`
- `packages/server/src/tools/patterns.ts`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] Server starts without errors: `npm run start`
- [ ] All 5 tools appear in tool list

#### Manual Verification:
- [ ] `ask_docs` with question="How do I create a smart contract?" returns synthesized answer
- [ ] `get_working_example` with task="transfer tokens" returns complete code with imports
- [ ] `explain_error` returns actionable fix information
- [ ] `search_docs` returns raw chunks for browsing
- [ ] All responses include source citations

**Implementation Note**: This is the main phase. Test each tool thoroughly with various queries before finalizing.

---

## Phase 4: Update Environment and Documentation

### Overview
Update configuration and add documentation for the new system.

### Changes Required:

#### 1. Update .env.example
**File**: `.env.example`
**Changes**: Add LLM configuration

```bash
# Vector Database (Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=crypto_docs

# Full-text Search (SQLite)
SQLITE_PATH=./data/crypto_docs.db

# OpenAI API Key (required - used for embeddings AND synthesis)
OPENAI_API_KEY=your-api-key-here

# LLM Synthesis Configuration (optional)
LLM_MODEL=gpt-4o
LLM_MAX_TOKENS=4000
LLM_TEMPERATURE=0.3

# GitHub Token (optional, for higher rate limits when scraping)
GITHUB_TOKEN=your-github-token

# Server Configuration
SERVER_HOST=localhost
SERVER_PORT=3000
```

#### 2. Update Server Initialization
**File**: `packages/server/src/index.ts`
**Changes**: Full update to use new modules

```typescript
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  VectorDB,
  FullTextDB,
  HybridSearch,
  Reranker,
  LLMClient
} from '@mina-docs/shared';
import { getToolDefinitions, handleToolCall, type ToolContext } from './tools/index.js';
import { loadServerConfig } from './config.js';

async function main() {
  const config = loadServerConfig();

  // Initialize databases
  const vectorDb = new VectorDB({
    url: config.qdrantUrl,
    collection: config.qdrantCollection
  });
  await vectorDb.initialize();

  const ftsDb = new FullTextDB({ path: config.sqlitePath });
  await ftsDb.initialize();

  // Initialize reranker
  const reranker = new Reranker({ apiKey: config.openaiApiKey });

  // Initialize LLM client for synthesis
  const llmClient = new LLMClient({
    apiKey: config.openaiApiKey,
    model: config.llm.model,
    maxTokens: config.llm.maxTokens,
    temperature: config.llm.temperature
  });

  // Initialize hybrid search with reranker
  const search = new HybridSearch({
    vectorDb,
    ftsDb,
    openaiApiKey: config.openaiApiKey,
    reranker
  });

  // Create tool context
  const toolContext: ToolContext = {
    search,
    ftsDb,
    llmClient
  };

  // Create MCP server
  const server = new Server(
    { name: 'crypto-docs', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  // Handle list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions()
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(
      request.params.name,
      request.params.arguments,
      toolContext
    );
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Crypto Docs MCP Server v2.0 started (LLM-synthesized responses)');
}

main().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [ ] Server starts with new configuration: `npm run start`
- [ ] All environment variables are read correctly

#### Manual Verification:
- [ ] Test complete flow: question → synthesized answer with citations
- [ ] Verify token limits are respected
- [ ] Test with different projects (mina, solana, cosmos)

---

## Testing Strategy

### Unit Tests:
- LLMClient synthesize function
- Reranker rerank function
- Prompt template formatting

### Integration Tests:
1. `ask_docs` returns synthesized answer with citations
2. `get_working_example` returns complete code with imports
3. `explain_error` returns actionable fix
4. `search_docs` returns raw chunks
5. Reranking improves result relevance

### Manual Testing Steps:
1. Start server: `npm run start`
2. Test via MCP client or curl:
   ```
   ask_docs: "How do I create a zkApp in Mina?"
   → Should return complete explanation with code

   get_working_example: "deploy a smart contract" (mina)
   → Should return full code with all imports

   explain_error: "Field.assertEquals() constraint unsatisfied"
   → Should explain the error and how to fix

   search_docs: "merkle tree" (mina)
   → Should return raw documentation chunks
   ```
3. Verify citations link to real documentation
4. Verify code examples are syntactically correct
5. Test with queries that should return "I don't know"

## Performance Considerations

- **Latency**: Quality mode adds ~2-4s for reranking + synthesis
- **Cost**: Each synthesized response uses ~1000-2000 input tokens + output tokens
- **Caching**: Not implemented; each query is fresh (could add response caching later)

## Migration Notes

- **Breaking change**: Old tools are removed (`search_documentation`, `get_code_examples`, etc.)
- **New tools**: `ask_docs`, `get_working_example`, `explain_error`, `search_docs`
- **API key usage**: Now uses OpenAI for both embeddings AND synthesis (more cost)

## Future Improvements (Not in This Plan)

1. **Contextual chunk enhancement** - Add context to chunks at index time (requires re-scraping)
2. **Response caching** - Cache synthesized answers for common queries
3. **Streaming** - Stream responses as they're generated
4. **Multiple LLM providers** - Support Claude, local models
5. **Query routing** - Automatically choose best tool based on query type

## References

- Current tools: `packages/server/src/tools/`
- Current search: `packages/shared/src/search.ts`
- Current embeddings: `packages/shared/src/embeddings.ts`
- Anthropic Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- RAG Best Practices: https://www.kapa.ai/blog/rag-best-practices
