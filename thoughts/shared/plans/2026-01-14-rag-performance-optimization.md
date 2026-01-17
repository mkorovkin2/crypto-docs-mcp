# RAG Performance Optimization Implementation Plan

---

## ⚠️ STATUS: DEPRIORITIZED ⚠️

**This plan has NOT been implemented.**

We want to do this optimization work, but it is not a priority right now. This document captures the research and proposed changes for future reference.

**Do not implement until explicitly prioritized.**

---

## Overview

Optimize RAG pipeline performance by parallelizing sequential operations and adding early exit paths. These changes reduce latency without changing the models used.

## Current State Analysis

The current pipeline has these sequential bottlenecks:

1. **Query variations → decomposition** (`ask-docs.ts:67-120`): Decomposition waits for variations to complete (~500-1500ms wasted)
2. **Evaluation loop doc queries** (`evaluation-orchestrator.ts:591`): Uses sequential for-loop instead of Promise.all
3. **No early exit before evaluation loop**: Even high-confidence answers go through full evaluation setup

### Key Discoveries:
- Query variations: `ask-docs.ts:73-78` - LLM call that takes 500-2000ms
- Query decomposition: `ask-docs.ts:102-106` - LLM call that takes 500-1500ms, runs AFTER variations
- Doc queries in eval loop: `evaluation-orchestrator.ts:591` - `for (const query of queries.slice(0, 2))` iterates sequentially
- Quick return threshold check: `evaluation-orchestrator.ts:132` - but this is INSIDE the evaluation loop, not before it

## Desired End State

1. Query variations and decomposition run in parallel, reducing pre-search latency by ~500-1500ms
2. Additional doc queries in evaluation loop run in parallel, reducing per-iteration latency by ~500ms
3. High-confidence answers skip evaluation loop setup entirely

### Verification:
- Measure latency before/after with logs
- Ensure answer quality is unchanged (same results, just faster)
- Run existing test queries to verify no regressions

## What We're NOT Doing

- Changing models or providers
- Modifying reranking logic
- Changing the evaluation loop structure (just parallelizing within it)
- Adding caching (separate optimization)
- Changing prompt content

## Implementation Approach

Make surgical changes to parallelize existing operations without altering the logic or results.

---

## Phase 1: Parallelize Query Variations + Decomposition

### Overview
Run query variations and decomposition LLM calls in parallel instead of sequentially.

### Changes Required:

#### 1. Modify ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Lines**: 67-120

**Current code** (sequential):
```typescript
// 3. Generate query variations using fast LLM
logger.info('Generating query variations with LLM...');
const variationStart = Date.now();

const variationLLM = context.llmEvaluator || context.llmClient;
const queryVariations = await generateQueryVariations(args.question, variationLLM, {
  count: config.queryVariations.count,
  maxTokens: config.queryVariations.maxTokens,
  project: args.project,
  analysis
});
// ... variation processing ...

// 3b. Query decomposition for multi-hop retrieval (concept/howto queries)
let searchQueries = enhancedVariations;
let wasDecomposed = false;

if (shouldDecompose(args.question, analysis.type)) {
  logger.info('Query may benefit from decomposition, generating sub-queries...');
  const decomposition = await decomposeQuery(
    args.question,
    analysis.type,
    context.llmEvaluator || context.llmClient
  );
  // ... decomposition processing ...
}
```

**New code** (parallel):
```typescript
// 3. Generate query variations AND decomposition in parallel
logger.info('Generating query variations and decomposition in parallel...');
const parallelStart = Date.now();

const variationLLM = context.llmEvaluator || context.llmClient;

// Check if decomposition is needed before starting parallel calls
const needsDecomposition = shouldDecompose(args.question, analysis.type);

// Run variations and decomposition in parallel
const [queryVariations, decomposition] = await Promise.all([
  generateQueryVariations(args.question, variationLLM, {
    count: config.queryVariations.count,
    maxTokens: config.queryVariations.maxTokens,
    project: args.project,
    analysis
  }),
  needsDecomposition
    ? decomposeQuery(args.question, analysis.type, variationLLM)
    : Promise.resolve({ originalQuery: args.question, subQueries: [], wasDecomposed: false, durationMs: 0 })
]);

logger.debug(`Parallel query expansion completed in ${Date.now() - parallelStart}ms`);
logger.debug(`Generated ${queryVariations.variations.length} variations in ${queryVariations.durationMs}ms`);
if (needsDecomposition) {
  logger.debug(`Decomposition completed in ${decomposition.durationMs}ms`);
}

// Process variations (same as before)
const contextKeywords = conversationContext.getContextForExpansion(args.project);
const enhancedVariations = queryVariations.variations.map((v: string) => {
  if (isFollowUp && contextKeywords.recentKeywords.length > 0) {
    const relevantKeywords = contextKeywords.recentKeywords
      .filter((k: string) => !v.toLowerCase().includes(k.toLowerCase()))
      .slice(0, 2);
    if (relevantKeywords.length > 0) {
      return `${v} ${relevantKeywords.join(' ')}`;
    }
  }
  return v;
});

// Combine search queries
let searchQueries = enhancedVariations;
let wasDecomposed = decomposition.wasDecomposed;

if (wasDecomposed) {
  logger.debug(`Decomposed into ${decomposition.subQueries.length} sub-queries: ${JSON.stringify(decomposition.subQueries)}`);

  // Combine decomposed queries with variations, removing duplicates
  const allQueries = new Set<string>([
    ...decomposition.subQueries,
    ...enhancedVariations
  ]);
  searchQueries = [...allQueries].slice(0, 8); // Max 8 queries to limit latency
  logger.debug(`Combined ${searchQueries.length} unique search queries`);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Test with a concept query (triggers decomposition): "How does Polymarket handle market resolution?"
- [ ] Verify logs show parallel execution (both complete in similar timeframe)
- [ ] Compare total latency before/after (expect ~500-1500ms improvement)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Parallelize Evaluation Loop Doc Queries

### Overview
Change sequential doc query execution to parallel using Promise.all.

### Changes Required:

#### 1. Modify evaluation-orchestrator.ts
**File**: `packages/shared/src/evaluation-orchestrator.ts`
**Function**: `executeDocQueries` (lines 579-616)

**Current code** (sequential):
```typescript
async function executeDocQueries(
  search: HybridSearch,
  queries: string[],
  project: string,
  existingResults: SearchResult[]
): Promise<{
  merged: SearchResult[];
  added: SearchResult[];
}> {
  const existingUrls = new Set(existingResults.map(r => r.chunk.url));
  const allNew: SearchResult[] = [];

  for (const query of queries.slice(0, 2)) { // Limit to 2 queries
    try {
      const results = await search.search(query, {
        limit: 10,
        project,
        rerank: true,
        rerankTopK: 5,
      });

      // Add only unique results
      for (const r of results) {
        if (!existingUrls.has(r.chunk.url)) {
          existingUrls.add(r.chunk.url);
          allNew.push(r);
        }
      }
    } catch (e) {
      console.error(`Doc query failed for "${query}":`, e);
    }
  }

  return {
    merged: [...existingResults, ...allNew],
    added: allNew,
  };
}
```

**New code** (parallel):
```typescript
async function executeDocQueries(
  search: HybridSearch,
  queries: string[],
  project: string,
  existingResults: SearchResult[]
): Promise<{
  merged: SearchResult[];
  added: SearchResult[];
}> {
  const existingUrls = new Set(existingResults.map(r => r.chunk.url));
  const queriesToRun = queries.slice(0, 2); // Limit to 2 queries

  // Execute all queries in parallel
  const searchPromises = queriesToRun.map(query =>
    search.search(query, {
      limit: 10,
      project,
      rerank: true,
      rerankTopK: 5,
    }).catch(e => {
      console.error(`Doc query failed for "${query}":`, e);
      return [] as SearchResult[];
    })
  );

  const resultSets = await Promise.all(searchPromises);

  // Merge results, deduplicating by URL
  const allNew: SearchResult[] = [];
  for (const results of resultSets) {
    for (const r of results) {
      if (!existingUrls.has(r.chunk.url)) {
        existingUrls.add(r.chunk.url);
        allNew.push(r);
      }
    }
  }

  return {
    merged: [...existingResults, ...allNew],
    added: allNew,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Test with a query that triggers QUERY_MORE_DOCS action
- [ ] Verify logs show both queries completing in similar timeframe
- [ ] Compare iteration latency before/after (expect ~500ms improvement per iteration)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Early Exit Optimizations

### Overview
Skip evaluation loop setup entirely for very high confidence answers. Currently, the quick return check happens INSIDE `runEvaluationLoop`, but we still pay the cost of:
1. Building the evaluation input object
2. Function call overhead
3. Trace initialization

Move the confidence check earlier to skip the evaluation loop entirely when appropriate.

### Changes Required:

#### 1. Modify ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Location**: After initial confidence calculation (around line 265)

**Current code**:
```typescript
// 11. Calculate initial confidence
const initialConfidence = getFullConfidenceResult(args.question, analysis, results, initialAnswer);

// 12. Use agentic evaluation loop if enabled
if (useAgentic) {
  return runAgenticEvaluation(
    args,
    context,
    builder,
    analysis,
    results,
    initialAnswer,
    initialConfidence,
    isFollowUp
  );
}
```

**New code**:
```typescript
// 11. Calculate initial confidence
const initialConfidence = getFullConfidenceResult(args.question, analysis, results, initialAnswer);

// 12. Early exit for very high confidence - skip evaluation loop entirely
const confidenceThreshold = config.agenticEvaluation.autoReturnConfidenceThreshold;
if (useAgentic && initialConfidence.score >= confidenceThreshold) {
  logger.info(`High confidence (${initialConfidence.score}%) >= threshold (${confidenceThreshold}%) - skipping evaluation loop`);

  // Generate related queries (still useful for the user)
  const relatedQueryLLM = context.llmEvaluator || context.llmClient;
  const topicsCovered = extractTopicsForRelatedQueries(results);
  const coverageGaps = extractCoverageGapsForRelatedQueries(analysis.keywords, results);

  const relatedQueriesResult = await generateRelatedQueriesWithLLM(
    relatedQueryLLM,
    {
      originalQuestion: args.question,
      currentAnswer: initialAnswer,
      project: args.project,
      analysis,
      topicsCovered,
      coverageGaps,
      previousContext: null,
    },
    { maxTokens: 1000 }
  );

  // Build response directly
  builder.setConfidence(initialConfidence.score);
  relatedQueriesResult.queries.forEach(q => builder.addRelatedQuery(q));

  if (isFollowUp) {
    builder.addWarning('This appears to be a follow-up question - context from previous queries was considered');
  }

  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));

  return builder.buildMCPResponse(initialAnswer);
}

// 13. Use agentic evaluation loop if enabled (for lower confidence)
if (useAgentic) {
  return runAgenticEvaluation(
    args,
    context,
    builder,
    analysis,
    results,
    initialAnswer,
    initialConfidence,
    isFollowUp
  );
}
```

#### 2. Add missing imports to ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Location**: Import section (top of file)

Add to the imports from `@mina-docs/shared`:
```typescript
import {
  // ... existing imports ...
  extractTopicsForRelatedQueries,
  extractCoverageGapsForRelatedQueries,
} from '@mina-docs/shared';
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Test with a query that produces high confidence results
- [ ] Verify logs show "skipping evaluation loop" message
- [ ] Compare total latency for high-confidence queries (expect significant improvement - skips 2-10s of evaluation)

**Implementation Note**: After completing this phase, the optimization work is complete.

---

## Testing Strategy

### Unit Tests:
- None needed - these are internal optimizations that don't change behavior

### Integration Tests:
- Run existing test queries and compare:
  1. Answer quality (should be identical)
  2. Latency (should be reduced)

### Manual Testing Steps:
1. Test concept query: "How does Polymarket handle market resolution?"
   - Should trigger decomposition
   - Verify parallel execution in logs
2. Test simple query: "What is the CLOB API?"
   - Should have high confidence
   - Verify early exit in logs
3. Test low-confidence query that triggers QUERY_MORE_DOCS
   - Verify parallel doc queries in logs

## Performance Considerations

### Expected Improvements:
- **Phase 1**: ~500-1500ms saved on queries that trigger decomposition
- **Phase 2**: ~500ms saved per evaluation iteration that triggers QUERY_MORE_DOCS
- **Phase 3**: ~2-10s saved on high-confidence queries (skips entire evaluation loop)

### Total Impact:
- Best case (high confidence): ~2-10s faster
- Typical case (1 iteration with decomposition): ~1-2s faster
- Worst case (low confidence, multiple iterations): ~1-2s faster

## References

- Current implementation: `packages/server/src/tools/ask-docs.ts`
- Evaluation orchestrator: `packages/shared/src/evaluation-orchestrator.ts`
- Query variations: `packages/shared/src/query-variations.ts`
- Query decomposition: `packages/shared/src/query-decomposer.ts`
