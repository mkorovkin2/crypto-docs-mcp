# Query Type-Aware Retrieval Implementation Plan

## Overview

Implement query type-aware retrieval that adjusts search parameters, adjacent chunk expansion, and reranking based on query classification. This improves RAG quality for abstract/conceptual questions by providing more context and using specialized scoring for different query types.

## Current State Analysis

### What Exists
- `packages/shared/src/query-analyzer.ts` has `classifyQuery()`, `analyzeQuery()`, and `getOptimizedSearchOptions()`
- Query types: `error`, `howto`, `concept`, `code_lookup`, `api_reference`, `general`
- Reranker uses `EXTENDED_PREVIEW_LENGTH = 2000` by default
- `ask-docs.ts` already uses `analysis.suggestedLimit` and `analysis.suggestedContentType`
- Adjacent chunk expansion infrastructure exists with configurable window sizes

### What's Missing
- `getOptimizedSearchOptions()` doesn't return `expandAdjacent` or `adjacentConfig`
- Reranker doesn't have query-type-aware scoring prompts
- `search-docs.ts`, `explain-error.ts`, and `corrective-rag.ts` don't use query analysis results
- No longer context window for concept queries in reranker

### Key Discoveries
- `getOptimizedSearchOptions()` at `query-analyzer.ts:258-272` is **exported but never used**
- Reranker at `reranker.ts:17-18` has `SHORT_PREVIEW_LENGTH = 500` and `EXTENDED_PREVIEW_LENGTH = 2000`
- `corrective-rag.ts:149-154` and `191-196` hard-codes search options without expansion
- `evaluation-orchestrator.ts:593-598` also hard-codes search options

## Desired End State

After implementation:
1. `getOptimizedSearchOptions()` returns complete search configuration including expansion options
2. Reranker uses 3000 char context for concept queries with specialized scoring instructions
3. All tools use `getOptimizedSearchOptions()` for consistent query-aware behavior
4. `corrective-rag.ts` passes expansion options to retry searches

### Verification
- Concept queries retrieve 15 chunks with larger adjacent windows (3 chunks)
- Code lookup queries retrieve 8 chunks with no adjacent expansion
- Reranker uses concept-specific scoring for "what is" / "explain" queries
- `search-docs.ts` and `explain-error.ts` use analysis-driven parameters

## What We're NOT Doing

- Not changing chunking strategy (separate improvement)
- Not adding contextual retrieval prefix to embeddings (separate improvement)
- Not modifying `evaluation-orchestrator.ts` (lower priority, agentic loop has its own logic)
- Not adding new query types (current types are sufficient)

## Implementation Approach

1. Extend `getOptimizedSearchOptions()` to return full search config including expansion
2. Add query type to reranker interface for type-aware scoring
3. Update tool files to use the centralized options function
4. Update `corrective-rag.ts` to accept and forward search options

---

## Phase 1: Extend Query Analyzer

### Overview
Add `expandAdjacent`, `adjacentConfig`, and enhanced parameters to `getOptimizedSearchOptions()`.

### Changes Required:

#### 1. packages/shared/src/query-analyzer.ts
**File**: `packages/shared/src/query-analyzer.ts`
**Changes**: Import AdjacentChunkConfig and extend getOptimizedSearchOptions return type

**Add import at top of file (after line 8):**
```typescript
import type { AdjacentChunkConfig } from './adjacent-chunks.js';
```

**Replace lines 255-272 (getOptimizedSearchOptions function) with:**
```typescript
/**
 * Search options optimized for a query type
 */
export interface OptimizedSearchOptions {
  query: string;
  contentType?: 'prose' | 'code' | 'api-reference';
  limit: number;
  rerank: boolean;
  rerankTopK: number;
  expandAdjacent: boolean;
  adjacentConfig?: Partial<AdjacentChunkConfig>;
}

/**
 * Get search options optimized for a query type
 */
export function getOptimizedSearchOptions(analysis: QueryAnalysis): OptimizedSearchOptions {
  const type = analysis.type;

  switch (type) {
    case 'concept':
      // Concepts need more context and comprehensive explanations
      return {
        query: analysis.expandedQuery,
        contentType: 'prose', // Prioritize explanatory text
        limit: 15,            // More chunks for comprehensive explanation
        rerank: true,
        rerankTopK: 12,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 3,           // Larger window for concepts
          code: 2,
          'api-reference': 1
        }
      };

    case 'howto':
      // How-to queries need a mix of prose and code
      return {
        query: analysis.expandedQuery,
        contentType: undefined, // Mix of prose and code
        limit: 12,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 3,            // More code context for tutorials
          'api-reference': 1
        }
      };

    case 'error':
      // Error queries need broad context to find solutions
      return {
        query: analysis.expandedQuery,
        contentType: undefined, // Search all types
        limit: 15,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 3,
          'api-reference': 2
        }
      };

    case 'code_lookup':
      // Code lookups are specific - less expansion needed
      return {
        query: analysis.expandedQuery,
        contentType: 'code',
        limit: 10,
        rerank: true,
        rerankTopK: 8,
        expandAdjacent: false, // Code is usually self-contained
      };

    case 'api_reference':
      // API reference lookups are specific
      return {
        query: analysis.expandedQuery,
        contentType: 'api-reference',
        limit: 8,
        rerank: true,
        rerankTopK: 6,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 1,
          code: 1,
          'api-reference': 2   // API docs often span multiple chunks
        }
      };

    case 'general':
    default:
      // General queries use balanced defaults
      return {
        query: analysis.expandedQuery,
        contentType: undefined,
        limit: 10,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 2,
          'api-reference': 1
        }
      };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/shared
- [ ] Export is available: `grep "export function getOptimizedSearchOptions" packages/shared/src/query-analyzer.ts`

#### Manual Verification:
- [ ] Verify `getOptimizedSearchOptions({ type: 'concept', ... })` returns `expandAdjacent: true` with `adjacentConfig.prose: 3`
- [ ] Verify `getOptimizedSearchOptions({ type: 'code_lookup', ... })` returns `expandAdjacent: false`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Enhance Reranker with Query-Type Awareness

### Overview
Add query type parameter to reranker and implement type-specific scoring prompts with longer context for concepts.

### Changes Required:

#### 1. packages/shared/src/reranker.ts
**File**: `packages/shared/src/reranker.ts`
**Changes**: Add queryType to options, increase context for concepts, add type-specific prompts

**Update imports at top (add after line 2):**
```typescript
import type { QueryType } from './query-analyzer.js';
```

**Replace lines 9-13 (RerankerOptions interface) with:**
```typescript
export interface RerankerOptions {
  topK?: number;
  /** Use extended context (2000 chars) for better accuracy. Default: true */
  extendedContext?: boolean;
  /** Query type for specialized scoring. If provided, uses type-specific prompts. */
  queryType?: QueryType;
}
```

**Replace lines 15-18 (constants) with:**
```typescript
const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast model for reranking
const DEFAULT_TOP_K = 10;
const SHORT_PREVIEW_LENGTH = 500;
const EXTENDED_PREVIEW_LENGTH = 2000;
const CONCEPT_PREVIEW_LENGTH = 3000; // Longer context for conceptual queries
```

**Replace lines 43-44 with query-type-aware preview length:**
```typescript
    // Use longer preview for concept queries that need more context
    const queryType = options.queryType;
    let previewLength: number;
    if (queryType === 'concept') {
      previewLength = CONCEPT_PREVIEW_LENGTH;
    } else if (extendedContext) {
      previewLength = EXTENDED_PREVIEW_LENGTH;
    } else {
      previewLength = SHORT_PREVIEW_LENGTH;
    }
```

**Replace lines 70-89 (prompt construction) with query-type-aware prompt:**
```typescript
    // Build query-type-specific scoring guidelines
    let scoringGuidelines: string;
    if (queryType === 'concept') {
      scoringGuidelines = `SCORING GUIDELINES FOR CONCEPTUAL QUERY:
- PRIORITIZE documents that EXPLAIN the concept, not just mention it
- Prefer documents with definitions, examples, and context
- Prefer comprehensive sections over brief mentions
- Documents that cover related concepts for fuller understanding are valuable
- DEPRIORITIZE:
  - API reference docs that only show method signatures without explanation
  - Code snippets without explanatory context
  - Changelog entries or version notes
  - Documents that assume prior knowledge of the concept`;
    } else if (queryType === 'howto') {
      scoringGuidelines = `SCORING GUIDELINES FOR HOW-TO QUERY:
- PRIORITIZE step-by-step tutorials and guides
- Prefer documents with complete code examples
- Look for documents that explain prerequisites and setup
- Documents showing common patterns and best practices are valuable
- DEPRIORITIZE:
  - Conceptual overviews without practical steps
  - API references without usage examples`;
    } else if (queryType === 'error') {
      scoringGuidelines = `SCORING GUIDELINES FOR ERROR/DEBUG QUERY:
- PRIORITIZE documents mentioning this specific error or similar errors
- Look for troubleshooting guides and common issues sections
- Solutions with code fixes are highly valuable
- Stack Overflow-style Q&A content is relevant
- DEPRIORITIZE:
  - General documentation not related to errors
  - Conceptual content without practical fixes`;
    } else if (queryType === 'code_lookup') {
      scoringGuidelines = `SCORING GUIDELINES FOR CODE LOOKUP:
- PRIORITIZE [CODE] documents with matching function/class/method names
- Exact name matches in metadata are strong signals
- Complete implementations are better than fragments
- Consider parameter types and return types as relevance signals
- DEPRIORITIZE:
  - Prose explanations without actual code
  - Test files unless specifically requested`;
    } else if (queryType === 'api_reference') {
      scoringGuidelines = `SCORING GUIDELINES FOR API REFERENCE:
- PRIORITIZE [API-REFERENCE] documents with matching signatures
- Method parameters, return types, and options are important
- Type definitions and interfaces are highly relevant
- DEPRIORITIZE:
  - Tutorial content without API details
  - High-level overviews`;
    } else {
      // General/default scoring
      scoringGuidelines = `SCORING GUIDELINES:
- Prioritize documents that directly answer the query
- For code queries, prefer [CODE] documents with matching function/class names
- For concept queries, prefer [DOCS] with clear explanations
- For API queries, prefer [API-REFERENCE] with signatures
- Consider metadata (Class, Method, Function) matches as strong relevance signals`;
    }

    const prompt = `You are a document relevance scorer for blockchain developer documentation. Rate how relevant each document is to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map(d => `[${d.index}] [${d.type.toUpperCase()}]${d.metadata} ${d.title} - ${d.section}
${d.preview}${d.preview.length >= previewLength ? '...' : ''}
`).join('\n')}

${scoringGuidelines}

Return a JSON array of the ${topK} most relevant document indices, ordered by relevance (most relevant first).
Example: [3, 1, 7, 0, 5]

Only return the JSON array, nothing else.`;
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/shared
- [ ] New constant exists: `grep "CONCEPT_PREVIEW_LENGTH = 3000" packages/shared/src/reranker.ts`

#### Manual Verification:
- [ ] Test reranker with `queryType: 'concept'` and verify longer previews are used
- [ ] Verify concept-specific scoring prompt mentions "EXPLAIN" and "definitions"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Update Tool Files to Use Optimized Options

### Overview
Update `search-docs.ts` and `explain-error.ts` to use `getOptimizedSearchOptions()` for consistent query-aware behavior.

### Changes Required:

#### 1. packages/server/src/tools/search-docs.ts
**File**: `packages/server/src/tools/search-docs.ts`
**Changes**: Use getOptimizedSearchOptions for search parameters

**Update import at line 1-2 to add getOptimizedSearchOptions:**
```typescript
import { analyzeQuery, getOptimizedSearchOptions } from '@mina-docs/shared';
```

**Replace lines 31-37 (search call) with:**
```typescript
  // Get query-type-optimized search options
  const searchOptions = getOptimizedSearchOptions(analysis);

  const results = await context.search.search(searchOptions.query, {
    // User-provided limit overrides optimized limit if specified
    limit: args.limit ?? searchOptions.limit,
    project: args.project,
    // User-provided contentType overrides optimized type if specified
    contentType: args.contentType ?? searchOptions.contentType,
    rerank: searchOptions.rerank,
    rerankTopK: searchOptions.rerankTopK,
    expandAdjacent: searchOptions.expandAdjacent,
    adjacentConfig: searchOptions.adjacentConfig
  });
```

#### 2. packages/server/src/tools/explain-error.ts
**File**: `packages/server/src/tools/explain-error.ts`
**Changes**: Use getOptimizedSearchOptions for search parameters

**Update import (find existing analyzeQuery import and add getOptimizedSearchOptions):**
```typescript
import { analyzeQuery, getOptimizedSearchOptions } from '@mina-docs/shared';
```

**Replace lines 56-61 (search call) with:**
```typescript
  // Get query-type-optimized search options (error type will be detected)
  const searchOptions = getOptimizedSearchOptions(analysis);

  const results = await context.search.search(searchQuery, {
    limit: searchOptions.limit,
    project: args.project,
    contentType: searchOptions.contentType,
    rerank: searchOptions.rerank,
    rerankTopK: searchOptions.rerankTopK,
    expandAdjacent: searchOptions.expandAdjacent,
    adjacentConfig: searchOptions.adjacentConfig
  });
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/server
- [ ] Import exists in search-docs: `grep "getOptimizedSearchOptions" packages/server/src/tools/search-docs.ts`
- [ ] Import exists in explain-error: `grep "getOptimizedSearchOptions" packages/server/src/tools/explain-error.ts`

#### Manual Verification:
- [ ] Test `crypto_search_docs` tool with a concept query and verify more results are returned
- [ ] Test `crypto_explain_error` tool and verify adjacent expansion is applied

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Update Corrective RAG to Pass Expansion Options

### Overview
Update `corrective-rag.ts` to accept and forward search options including expansion parameters.

### Changes Required:

#### 1. packages/shared/src/corrective-rag.ts
**File**: `packages/shared/src/corrective-rag.ts`
**Changes**: Add search options parameter and pass to search calls

**Add import for OptimizedSearchOptions (near top of file):**
```typescript
import type { OptimizedSearchOptions } from './query-analyzer.js';
```

**Find the CorrectiveRAGOptions interface and add searchOptions field:**
```typescript
export interface CorrectiveRAGOptions {
  maxRetries?: number;
  mergeResults?: boolean;
  /** Search options from query analysis - will be used for all searches */
  searchOptions?: Partial<OptimizedSearchOptions>;
}
```

**Update the correctiveSearch function signature (around line 138) to use searchOptions:**

Find the initial search (around lines 149-154) and replace with:
```typescript
  const searchOpts = options.searchOptions || {};

  const initialResults = await search.search(query, {
    limit: searchOpts.limit ?? 15,
    project,
    contentType: searchOpts.contentType,
    rerank: searchOpts.rerank ?? true,
    rerankTopK: searchOpts.rerankTopK ?? 10,
    expandAdjacent: searchOpts.expandAdjacent ?? false,
    adjacentConfig: searchOpts.adjacentConfig
  });
```

Find the retry search (around lines 191-196) and replace with:
```typescript
      const altResults = await search.search(altQuery, {
        limit: searchOpts.limit ?? 15,
        project,
        contentType: searchOpts.contentType,
        rerank: searchOpts.rerank ?? true,
        rerankTopK: searchOpts.rerankTopK ?? 10,
        expandAdjacent: searchOpts.expandAdjacent ?? false,
        adjacentConfig: searchOpts.adjacentConfig
      });
```

#### 2. packages/server/src/tools/ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Pass searchOptions to correctiveSearch

Find the correctiveSearch call (around lines 139-145) and update to:
```typescript
      const searchOptions = getOptimizedSearchOptions(analysis);
      const correctiveResult = await correctiveSearch(
        context.search,
        args.question,
        analysis,
        args.project,
        {
          maxRetries: 2,
          mergeResults: true,
          searchOptions: {
            limit: searchOptions.limit,
            contentType: searchOptions.contentType,
            rerank: searchOptions.rerank,
            rerankTopK: searchOptions.rerankTopK,
            expandAdjacent: searchOptions.expandAdjacent,
            adjacentConfig: searchOptions.adjacentConfig
          }
        }
      );
```

**Note**: You'll need to add `getOptimizedSearchOptions` to the imports at the top of ask-docs.ts if not already present:
```typescript
import { analyzeQuery, getOptimizedSearchOptions } from '@mina-docs/shared';
```

#### 3. packages/server/src/tools/working-example.ts
**File**: `packages/server/src/tools/working-example.ts`
**Changes**: Pass searchOptions to correctiveSearch

Find the correctiveSearch call (around lines 80-86) and update to:
```typescript
      const searchOptions = getOptimizedSearchOptions(analysis);
      const correctiveResult = await correctiveSearch(
        context.search,
        `${args.task} code example implementation`,
        analysis,
        args.project,
        {
          maxRetries: 1,
          mergeResults: true,
          searchOptions: {
            limit: searchOptions.limit,
            contentType: 'code', // Working example always wants code
            rerank: searchOptions.rerank,
            rerankTopK: searchOptions.rerankTopK,
            expandAdjacent: true,
            adjacentConfig: { code: 4 } // More code context
          }
        }
      );
```

**Note**: Add import if needed:
```typescript
import { analyzeQuery, getOptimizedSearchOptions } from '@mina-docs/shared';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] CorrectiveRAGOptions has searchOptions: `grep "searchOptions" packages/shared/src/corrective-rag.ts`

#### Manual Verification:
- [ ] Test ask-docs with a concept query that triggers corrective RAG and verify expansion is applied
- [ ] Verify retry searches use the same expansion settings as initial search

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: Update Reranker Calls with Query Type

### Overview
Pass query type to reranker calls so it uses type-specific scoring.

### Changes Required:

#### 1. packages/shared/src/search.ts
**File**: `packages/shared/src/search.ts`
**Changes**: Add queryType to SearchOptions and pass to reranker

**Update SearchOptions interface (around line 15-25) to add queryType:**
```typescript
export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string;
  mode?: 'hybrid' | 'vector' | 'fts';
  rerank?: boolean;
  rerankTopK?: number;
  // Adjacent chunk expansion options
  expandAdjacent?: boolean;
  adjacentConfig?: Partial<AdjacentChunkConfig>;
  // Query type for reranker scoring
  queryType?: import('./query-analyzer.js').QueryType;
}
```

**Update the reranker call (around line 73-75) to pass queryType:**
```typescript
    // Apply reranking if enabled and reranker is available
    if (rerank && this.options.reranker && results.length > rerankTopK) {
      results = await this.options.reranker.rerank(query, results, {
        topK: rerankTopK,
        queryType: options.queryType
      });
    }
```

#### 2. packages/shared/src/query-analyzer.ts
**File**: `packages/shared/src/query-analyzer.ts`
**Changes**: Add queryType to OptimizedSearchOptions

**Update the OptimizedSearchOptions interface to include queryType:**
```typescript
export interface OptimizedSearchOptions {
  query: string;
  contentType?: 'prose' | 'code' | 'api-reference';
  limit: number;
  rerank: boolean;
  rerankTopK: number;
  expandAdjacent: boolean;
  adjacentConfig?: Partial<AdjacentChunkConfig>;
  queryType: QueryType; // Add this field
}
```

**Update each return statement in getOptimizedSearchOptions to include queryType:**
```typescript
// In case 'concept':
return {
  query: analysis.expandedQuery,
  contentType: 'prose',
  limit: 15,
  rerank: true,
  rerankTopK: 12,
  expandAdjacent: true,
  adjacentConfig: { prose: 3, code: 2, 'api-reference': 1 },
  queryType: type  // Add this line to each case
};
```

(Add `queryType: type` to all switch cases)

#### 3. Update tool files to pass queryType
In each tool file (`search-docs.ts`, `explain-error.ts`), update the search call to include queryType:

```typescript
const results = await context.search.search(searchOptions.query, {
  limit: args.limit ?? searchOptions.limit,
  project: args.project,
  contentType: args.contentType ?? searchOptions.contentType,
  rerank: searchOptions.rerank,
  rerankTopK: searchOptions.rerankTopK,
  expandAdjacent: searchOptions.expandAdjacent,
  adjacentConfig: searchOptions.adjacentConfig,
  queryType: searchOptions.queryType  // Add this line
});
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] SearchOptions includes queryType: `grep "queryType" packages/shared/src/search.ts`

#### Manual Verification:
- [ ] Test concept query and verify reranker log shows concept-specific scoring
- [ ] Enable `DEBUG_RERANKER=true` and verify the prompt contains "SCORING GUIDELINES FOR CONCEPTUAL QUERY"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:
- Test `getOptimizedSearchOptions()` returns correct config for each query type
- Test reranker uses correct preview length based on queryType

### Integration Tests:
- Query "What is market resolution?" should return 15 results with prose priority
- Query "show me the `createOrder` function" should return 10 code results without expansion

### Manual Testing Steps:
1. Start the MCP server: `npm run start`
2. Test concept query: `crypto_ask_docs` with "What is market resolution on Polymarket?"
   - Verify response includes more comprehensive explanation
   - Check logs show `expandAdjacent: true` with `adjacentConfig.prose: 3`
3. Test code query: `crypto_search_docs` with "createOrder function"
   - Verify results are code-focused
   - Check logs show `expandAdjacent: false`
4. Test error query: `crypto_explain_error` with an error message
   - Verify expansion is applied for broader context
5. Enable `DEBUG_RERANKER=true` and verify query-type-specific prompts appear

## Performance Considerations

- Concept queries fetch more chunks (15 vs 10) which increases latency slightly
- Longer reranker context (3000 chars) increases token usage for concept queries
- Expected ~20% increase in token cost for concept queries, offset by better quality

## Migration Notes

No migration required - changes are backwards compatible:
- `getOptimizedSearchOptions()` was previously unused
- New parameters have defaults that match previous behavior
- Tools that don't pass queryType will use general scoring

## References

- Research document: `thoughts/shared/research/2026-01-14-polymarket-rag-optimization.md`
- Query analyzer: `packages/shared/src/query-analyzer.ts:131-156` (classifyQuery)
- Reranker: `packages/shared/src/reranker.ts:32-174` (rerank method)
- Adjacent chunks: `packages/shared/src/adjacent-chunks.ts:50-186` (expandWithAdjacentChunks)
- Search: `packages/shared/src/search.ts:30-78` (search method)
