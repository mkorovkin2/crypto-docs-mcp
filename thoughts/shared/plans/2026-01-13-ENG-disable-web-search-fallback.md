# Disable Web Search Fallback Implementation Plan

## Overview

Remove the web search fallback functionality from the MCP server's agentic evaluation loop. When the RAG system can't find good answers in the indexed documentation, it should no longer attempt to search the web via Tavily.

## Current State Analysis

The web search fallback is deeply integrated into the agentic evaluation system:

1. **Evaluator (`evaluator.ts:69-80`)**: The LLM evaluator is prompted to choose `SEARCH_WEB` action when confidence < 70 or coverage gaps exist
2. **Orchestrator (`evaluation-orchestrator.ts:277-379`)**: Handles `SEARCH_WEB` action by calling Tavily API, analyzing results, and synthesizing answers
3. **Types (`evaluation-types.ts:21`)**: `SEARCH_WEB` is defined as one of the four available evaluation actions

### Key Discoveries:
- `evaluator.ts:76`: "STRONGLY PREFER SEARCH_WEB when confidence is below 70!"
- `evaluator.ts:80`: "If confidence is below 70 and web search is available, you should almost always choose SEARCH_WEB"
- `evaluation-orchestrator.ts:191`: Web search availability determined by `config.enableWebSearch && webSearchesRemaining > 0 && !!deps.webSearch`

## Desired End State

After this plan is complete:
- The evaluator LLM will no longer have `SEARCH_WEB` as an available action
- The orchestrator will never execute web searches
- Answers will only be based on indexed RAG documentation
- All web search code remains in place (unused) for potential future re-enablement

### Verification:
- Run the MCP server and query with low-confidence questions
- Confirm no web searches are attempted (no Tavily API calls)
- Confirm evaluator logs show only `RETURN_ANSWER`, `QUERY_MORE_DOCS`, `REFINE_ANSWER` as options

## What We're NOT Doing

- NOT deleting web search related files (`web-search.ts`, `web-result-analyzer.ts`, etc.)
- NOT removing Tavily configuration from `.env.example` or `config.ts`
- NOT modifying the server initialization code that creates the WebSearchClient
- NOT removing web search types from `evaluation-types.ts`

## Implementation Approach

Disable web search at two key points:
1. Remove `SEARCH_WEB` from the evaluator's system prompt (so LLM never considers it)
2. Force `enableWebSearch` to always be false in the evaluation config

This approach ensures web search is never triggered regardless of configuration.

---

## Phase 1: Disable Web Search in Evaluator System Prompt

### Overview
Remove the `SEARCH_WEB` action from the evaluator's available actions so the LLM never considers it as an option.

### Changes Required:

#### 1. Remove SEARCH_WEB from Evaluator Prompt
**File**: `packages/shared/src/evaluator.ts`
**Changes**: Remove the entire SEARCH_WEB action section from `EVALUATOR_SYSTEM_PROMPT`

Remove lines 69-80 (the SEARCH_WEB action definition and preference statements):
```typescript
// DELETE THIS ENTIRE BLOCK:
- SEARCH_WEB: Need external information not in indexed docs.
  Use when: ANY of these conditions are met:
  * Confidence score < 70 (indicates indexed docs are insufficient)
  * Coverage gaps exist (key terms not found in indexed docs)
  * Topic seems newer/advanced and indexed docs clearly don't cover it
  * Need official/authoritative source for verification
  * Answer is incomplete and QUERY_MORE_DOCS has already been tried
  STRONGLY PREFER SEARCH_WEB when confidence is below 70!

// DELETE THIS LINE TOO (line 80):
IMPORTANT: If confidence is below 70 and web search is available, you should almost always choose SEARCH_WEB rather than RETURN_ANSWER or QUERY_MORE_DOCS.
```

Also update the OUTPUT FORMAT section (lines 91, 96) to remove SEARCH_WEB references:
```typescript
// BEFORE (line 91):
"action": "RETURN_ANSWER" | "QUERY_MORE_DOCS" | "SEARCH_WEB" | "REFINE_ANSWER",

// AFTER:
"action": "RETURN_ANSWER" | "QUERY_MORE_DOCS" | "REFINE_ANSWER",
```

Remove line 96 (actionDetails for SEARCH_WEB):
```typescript
// DELETE THIS LINE:
// For SEARCH_WEB: { "queries": ["search query 1", "search query 2"] } - REQUIRED
```

#### 2. Remove SEARCH_WEB from Response Parser
**File**: `packages/shared/src/evaluator.ts`
**Changes**: Remove the `SEARCH_WEB` case from `responseToAction()` function

Delete lines 319-329:
```typescript
// DELETE THIS ENTIRE CASE:
case 'SEARCH_WEB': {
  const queries = Array.isArray(parsed.decision.actionDetails.queries)
    ? parsed.decision.actionDetails.queries
    : [];
  evaluatorLog.debug(`Action: SEARCH_WEB - ${queries.length} queries: [${queries.join(', ')}]`);
  return {
    type: 'SEARCH_WEB',
    queries,
    reason: parsed.decision.reason,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation succeeds: `cd packages/shared && npm run build`
- [ ] Server builds successfully: `cd packages/server && npm run build`

#### Manual Verification:
- [ ] Start server and run a query with low confidence (e.g., obscure topic)
- [ ] Verify evaluator logs show only RETURN_ANSWER, QUERY_MORE_DOCS, REFINE_ANSWER as options
- [ ] Verify no "SEARCH_WEB" appears in any evaluation decision logs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Force Disable Web Search in Configuration

### Overview
Even if someone passes `enableWebSearch: true` in the config, ensure web search is never executed.

### Changes Required:

#### 1. Force enableWebSearch to False in Evaluation Loop
**File**: `packages/shared/src/evaluation-orchestrator.ts`
**Changes**: Override `enableWebSearch` to always be false

At line 90-93 where config is merged, add override:
```typescript
// BEFORE:
const config: EvaluationConfig = {
  ...DEFAULT_EVALUATION_CONFIG,
  ...input.config,
};

// AFTER:
const config: EvaluationConfig = {
  ...DEFAULT_EVALUATION_CONFIG,
  ...input.config,
  enableWebSearch: false, // Web search disabled - answers only from indexed docs
};
```

#### 2. Update Default Config
**File**: `packages/shared/src/evaluation-types.ts`
**Changes**: Change default for `enableWebSearch` to false

At line 127:
```typescript
// BEFORE:
enableWebSearch: true,

// AFTER:
enableWebSearch: false, // Disabled - use only indexed documentation
```

#### 3. Remove Web Search Availability from Context (Optional but Clean)
**File**: `packages/shared/src/evaluation-orchestrator.ts`
**Changes**: Set `canSearchWeb` to always false in evaluator context

At line 191:
```typescript
// BEFORE:
canSearchWeb: config.enableWebSearch && webSearchesRemaining > 0 && !!deps.webSearch,

// AFTER:
canSearchWeb: false, // Web search disabled
```

#### 4. Remove Web Search Log Output
**File**: `packages/shared/src/evaluation-orchestrator.ts`
**Changes**: Remove confusing log about web search availability

At line 218, modify the log to not mention web search:
```typescript
// BEFORE:
evalLog.info(`  Web search available: ${evaluatorContext.availableActions.canSearchWeb} (${webSearchesRemaining} remaining)`);

// AFTER:
// (Remove this line entirely, or keep only doc queries info)
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation succeeds: `cd packages/shared && npm run build`
- [ ] Server builds successfully: `cd packages/server && npm run build`

#### Manual Verification:
- [ ] Server startup logs do NOT show "Web search client initialized (Tavily)" (even if TAVILY_API_KEY is set)
- [ ] Run multiple queries and verify no web searches are ever performed
- [ ] Evaluation trace shows `webSearches: 0` in resourcesUsed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Clean Up Ask-Docs Tool (Optional)

### Overview
Remove the web search suggestion generation from the ask-docs tool to avoid confusing users with "try web search" suggestions.

### Changes Required:

#### 1. Remove Web Search Suggestions from No-Results Handler
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Remove web_search suggestions when no results found

At lines 403-410, remove or comment out:
```typescript
// DELETE OR COMMENT OUT:
// Add web search suggestions
for (const search of searchGuidance.suggestedSearches.slice(0, 2)) {
  builder.addSuggestion(
    'web_search',
    search.rationale,
    { query: search.query, engine: search.suggestedEngine }
  );
}
```

#### 2. Remove Web Search Suggestions from Low Confidence Handler
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Remove web_search suggestions in original flow when confidence is low

At lines 346-355, remove or comment out:
```typescript
// DELETE OR COMMENT OUT:
// Add web search as a suggestion
for (const search of searchGuidance.suggestedSearches.slice(0, 2)) {
  builder.addSuggestion(
    'web_search',
    search.rationale,
    { query: search.query, engine: search.suggestedEngine }
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation succeeds: `cd packages/server && npm run build`

#### Manual Verification:
- [ ] Query with no results shows no web_search suggestions
- [ ] Low confidence answers show no web_search suggestions
- [ ] Suggestions only include relevant documentation actions

**Implementation Note**: This phase is optional - the web search suggestions don't actually trigger web searches, they just tell the user they could manually search. Can be skipped if you want to keep this guidance.

---

## Testing Strategy

### Unit Tests:
- Verify evaluator never returns SEARCH_WEB action
- Verify evaluation config always has enableWebSearch: false

### Integration Tests:
- Run full evaluation loop with low confidence results
- Verify resourcesUsed.webSearches is always 0

### Manual Testing Steps:
1. Start the MCP server
2. Ask a question about an obscure topic likely not in indexed docs
3. Verify answer comes only from indexed docs (check for web source URLs)
4. Check logs for any Tavily API calls (should be none)
5. Check evaluation trace shows webSearches: 0

## Performance Considerations

This change should slightly improve performance by:
- Reducing evaluation loop iterations (no web search detours)
- Eliminating Tavily API latency
- Removing web result analysis LLM calls

## Migration Notes

No data migration needed. The change is entirely behavioral.

To re-enable web search in the future:
1. Restore SEARCH_WEB action in evaluator prompt
2. Change `enableWebSearch: false` back to `true` or remove the override
3. Restore web search suggestion generation in ask-docs

## References

- Evaluator system prompt: `packages/shared/src/evaluator.ts:42-107`
- Evaluation orchestrator: `packages/shared/src/evaluation-orchestrator.ts:277-379`
- Evaluation types: `packages/shared/src/evaluation-types.ts:18-22`
- Ask-docs tool: `packages/server/src/tools/ask-docs.ts:244-255`
