# Agentic Evaluation Loop Implementation Plan

## Overview

Transform the MCP server's single-pass LLM synthesis into an iterative, self-improving evaluation loop. The system will use multiple LLM calls that evaluate each other's outputs, dynamically deciding whether to query more from indexed docs, search the web for live documentation, or refine the answer—all while compressing context between steps.

**Key Design Principles:**
- NOT an explicit agent framework—a orchestrated chain of LLM evaluations
- LLM self-assessment determines when the answer is sufficient
- Both structured extraction AND LLM summaries for context compression
- Tavily API for live web search capabilities

## Current State Analysis

### What Exists Now

**Single-Pass Flow** (`packages/server/src/tools/ask-docs.ts`):
1. Query analysis → keyword extraction, type classification
2. Hybrid search → vector + FTS retrieval
3. Corrective RAG → retry with alternative queries if poor results
4. **Single LLM synthesis** → one call generates the answer
5. Post-hoc confidence scoring → evaluates AFTER generation
6. Search guidance → appends suggestions if confidence low

**Existing Building Blocks:**
- `analyzeQuery()` - Query understanding (`query-analyzer.ts:241`)
- `calculateConfidenceScore()` - Multi-factor scoring (`confidence.ts:55`)
- `extractQueryUnderstanding()` - Intent extraction (`understanding-extractor.ts:36`)
- `generateSearchGuidance()` - Web search suggestions (`search-query-generator.ts:92`)
- `correctiveSearch()` - Retry logic with merging (`corrective-rag.ts:138`)
- `LLMClient.synthesize()` - LLM call wrapper (`llm.ts:32`)

### Gap

The system evaluates quality **after** synthesis but doesn't:
- Iterate to improve the answer
- Have the LLM assess its own answer sufficiency
- Actually perform web searches (only suggests them)
- Compress and carry forward context between evaluation steps

## Desired End State

After implementation, the `ask-docs` flow will:

1. **Initial Synthesis**: Generate first-pass answer from indexed docs
2. **Self-Evaluation**: LLM evaluates if the answer is sufficient
3. **Dynamic Decisions**: Based on evaluation, system can:
   - Query indexed docs with refined/expanded searches
   - Search the web via Tavily for live documentation
   - Synthesize additional context into improved answer
   - Declare the answer sufficient and return
4. **Context Compression**: Between steps, extract key findings + LLM summary
5. **Termination**: LLM explicitly declares answer sufficient OR max iterations reached

### Verification

- Query about well-documented topic: Returns answer in 1-2 iterations
- Query about partially-documented topic: Iterates, possibly searches web, improves
- Query about undocumented topic: Searches web, synthesizes from external sources
- Response includes `evaluationTrace` showing the decision process
- Latency is reasonable (3-5 seconds for simple queries, up to 15s for complex)

## What We're NOT Doing

- Building a general-purpose agent framework
- Adding conversational memory beyond single request
- Implementing tool use beyond search (no code execution, etc.)
- Changing the core retrieval/embedding pipeline
- Adding new MCP tools (this enhances `ask-docs` internally)

## Implementation Approach

Build in layers:
1. **Phase 1**: Tavily web search integration (new capability)
2. **Phase 2**: Evaluation/compression types and interfaces
3. **Phase 3**: Evaluator LLM prompts and logic
4. **Phase 4**: Orchestration loop that ties it all together
5. **Phase 5**: Integration into ask-docs.ts

---

## Phase 1: Tavily Web Search Integration

### Overview
Add Tavily API client for performing web searches during the evaluation loop.

### Changes Required:

#### 1. Add Tavily Client
**File**: `packages/shared/src/web-search.ts` (NEW)
**Changes**: Create Tavily integration for web search and content extraction

```typescript
/**
 * Web Search Module
 *
 * Provides web search capabilities using Tavily API for finding
 * live documentation and external resources.
 */

export interface WebSearchConfig {
  apiKey: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  answer?: string; // Tavily can provide a direct answer
  responseTime: number;
}

export class WebSearchClient {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';
  private maxResults: number;
  private searchDepth: 'basic' | 'advanced';

  constructor(config: WebSearchConfig) {
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults ?? 5;
    this.searchDepth = config.searchDepth ?? 'basic';
  }

  /**
   * Search the web for documentation and resources
   */
  async search(
    query: string,
    options?: {
      includeAnswer?: boolean;
      includeDomains?: string[];
      excludeDomains?: string[];
      maxResults?: number;
    }
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: this.searchDepth,
        include_answer: options?.includeAnswer ?? true,
        include_domains: options?.includeDomains,
        exclude_domains: options?.excludeDomains,
        max_results: options?.maxResults ?? this.maxResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      query,
      results: data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.published_date,
      })),
      answer: data.answer,
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * Extract content from a specific URL
   */
  async extract(urls: string[]): Promise<Array<{ url: string; content: string }>> {
    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        urls,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily extract failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }
}

/**
 * Generate search queries optimized for finding documentation
 */
export function generateDocSearchQueries(
  project: string,
  topic: string,
  queryType: string
): string[] {
  const projectName = getProjectDisplayName(project);

  const queries: string[] = [];

  // Primary documentation search
  queries.push(`${projectName} ${topic} documentation`);

  // Type-specific searches
  switch (queryType) {
    case 'howto':
      queries.push(`${projectName} ${topic} tutorial example`);
      queries.push(`how to ${topic} ${projectName}`);
      break;
    case 'error':
      queries.push(`${projectName} ${topic} error fix solution`);
      queries.push(`${topic} troubleshooting ${projectName}`);
      break;
    case 'api_reference':
    case 'code_lookup':
      queries.push(`${projectName} ${topic} API reference`);
      queries.push(`${getProjectSDK(project)} ${topic} example`);
      break;
    case 'concept':
      queries.push(`${projectName} ${topic} explained`);
      queries.push(`what is ${topic} in ${projectName}`);
      break;
  }

  return queries.slice(0, 3); // Limit to avoid too many API calls
}

function getProjectDisplayName(project: string): string {
  const names: Record<string, string> = {
    mina: 'Mina Protocol',
    solana: 'Solana',
    cosmos: 'Cosmos SDK',
  };
  return names[project.toLowerCase()] || project;
}

function getProjectSDK(project: string): string {
  const sdks: Record<string, string> = {
    mina: 'o1js',
    solana: 'Anchor',
    cosmos: 'cosmos-sdk',
  };
  return sdks[project.toLowerCase()] || project;
}
```

#### 2. Add Environment Configuration
**File**: `packages/server/src/config.ts`
**Changes**: Add Tavily API key configuration

```typescript
// Add to existing config interface
export interface ServerConfig {
  // ... existing fields ...
  tavily?: {
    apiKey: string;
    searchDepth?: 'basic' | 'advanced';
    maxResults?: number;
  };
}

// Add to config loading
const config: ServerConfig = {
  // ... existing config ...
  tavily: process.env.TAVILY_API_KEY ? {
    apiKey: process.env.TAVILY_API_KEY,
    searchDepth: (process.env.TAVILY_SEARCH_DEPTH as 'basic' | 'advanced') || 'basic',
    maxResults: parseInt(process.env.TAVILY_MAX_RESULTS || '5'),
  } : undefined,
};
```

#### 3. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add web search exports

```typescript
// Add to existing exports
export * from './web-search.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors
- [ ] New exports accessible from shared package

#### Manual Verification:
- [ ] With valid TAVILY_API_KEY, search returns results
- [ ] Search results include relevant documentation URLs
- [ ] Extract function retrieves content from URLs

**Implementation Note**: Pause here for manual verification that Tavily integration works before proceeding.

---

## Phase 2: Evaluation Types and Interfaces

### Overview
Define the types for the evaluation loop: evaluation state, decisions, context compression.

### Changes Required:

#### 1. Create Evaluation Types
**File**: `packages/shared/src/evaluation-types.ts` (NEW)
**Changes**: Define all types for the agentic evaluation loop

```typescript
/**
 * Evaluation Loop Types
 *
 * Types for the iterative, self-improving answer evaluation system.
 */

import type { SearchResult } from './types.js';
import type { WebSearchResult } from './web-search.js';
import type { QueryAnalysis } from './query-analyzer.js';
import type { ConfidenceResult } from './confidence.js';

/**
 * Actions the evaluator can decide to take
 */
export type EvaluationAction =
  | { type: 'RETURN_ANSWER'; reason: string }
  | { type: 'QUERY_MORE_DOCS'; queries: string[]; reason: string }
  | { type: 'SEARCH_WEB'; queries: string[]; reason: string }
  | { type: 'REFINE_ANSWER'; focusAreas: string[]; reason: string };

/**
 * Result of a single evaluation step
 */
export interface EvaluationStepResult {
  /** The step number (1-indexed) */
  step: number;
  /** Action decided by the evaluator */
  action: EvaluationAction;
  /** Current answer text (may be refined) */
  currentAnswer: string;
  /** Confidence assessment */
  confidence: {
    score: number;
    factors: string[];
    gaps: string[];
  };
  /** Compressed context to carry forward */
  compressedContext: CompressedContext;
  /** Time taken for this step */
  durationMs: number;
}

/**
 * Compressed context passed between evaluation steps
 */
export interface CompressedContext {
  /** Structured extraction of key findings */
  structured: {
    /** Key facts established so far */
    establishedFacts: string[];
    /** Knowledge gaps identified */
    identifiedGaps: string[];
    /** Sources used with relevance notes */
    sourcesUsed: Array<{
      url: string;
      relevance: 'high' | 'medium' | 'low';
      contribution: string;
    }>;
    /** Queries already tried */
    queriesTried: string[];
    /** Web searches already performed */
    webSearchesDone: string[];
  };
  /** LLM-generated summary of the evaluation so far */
  summary: string;
  /** What the evaluator thinks is still needed */
  stillNeeded: string[];
}

/**
 * Complete trace of the evaluation loop
 */
export interface EvaluationTrace {
  /** Original query */
  query: string;
  /** Project being queried */
  project: string;
  /** Query analysis */
  analysis: QueryAnalysis;
  /** Each step of the evaluation */
  steps: EvaluationStepResult[];
  /** Final decision */
  finalAction: 'returned' | 'max_iterations' | 'error';
  /** Total evaluation time */
  totalDurationMs: number;
  /** Resources used */
  resourcesUsed: {
    llmCalls: number;
    docQueries: number;
    webSearches: number;
    tokensUsed?: number;
  };
}

/**
 * Configuration for the evaluation loop
 */
export interface EvaluationConfig {
  /** Maximum iterations before forcing return */
  maxIterations: number;
  /** Minimum confidence to auto-return without evaluation */
  autoReturnConfidenceThreshold: number;
  /** Whether to enable web search */
  enableWebSearch: boolean;
  /** Maximum web searches per evaluation */
  maxWebSearches: number;
  /** Maximum additional doc queries per evaluation */
  maxDocQueries: number;
}

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  maxIterations: 3,
  autoReturnConfidenceThreshold: 85,
  enableWebSearch: true,
  maxWebSearches: 2,
  maxDocQueries: 2,
};

/**
 * Input to the evaluation loop
 */
export interface EvaluationInput {
  /** The user's question */
  query: string;
  /** Project context */
  project: string;
  /** Query analysis */
  analysis: QueryAnalysis;
  /** Initial search results from indexed docs */
  initialResults: SearchResult[];
  /** Initial synthesized answer */
  initialAnswer: string;
  /** Initial confidence result */
  initialConfidence: ConfidenceResult;
  /** Configuration */
  config: EvaluationConfig;
}

/**
 * Output from the evaluation loop
 */
export interface EvaluationOutput {
  /** Final answer to return */
  answer: string;
  /** Final confidence score */
  confidence: number;
  /** Complete evaluation trace */
  trace: EvaluationTrace;
  /** Sources used (indexed + web) */
  sources: Array<{
    type: 'indexed' | 'web';
    url: string;
    title: string;
  }>;
  /** Whether web search was used */
  usedWebSearch: boolean;
  /** Warnings or notes */
  warnings: string[];
}

/**
 * Context available to the evaluator LLM
 */
export interface EvaluatorContext {
  /** Original query and analysis */
  query: {
    text: string;
    type: string;
    intent: string;
    technicalTerms: string[];
  };
  /** Current answer being evaluated */
  currentAnswer: string;
  /** Current confidence assessment */
  confidence: ConfidenceResult;
  /** What we know from previous steps */
  previousContext: CompressedContext | null;
  /** Available actions and their costs */
  availableActions: {
    canQueryMoreDocs: boolean;
    canSearchWeb: boolean;
    docQueriesRemaining: number;
    webSearchesRemaining: number;
  };
  /** Indexed doc results summary */
  indexedResults: {
    count: number;
    topTopics: string[];
    coverageGaps: string[];
  };
  /** Web search results if any */
  webResults?: {
    query: string;
    results: WebSearchResult[];
  }[];
}
```

#### 2. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add evaluation types exports

```typescript
// Add to existing exports
export * from './evaluation-types.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors
- [ ] All types are exported and importable

#### Manual Verification:
- [ ] Types make sense for the evaluation flow
- [ ] No missing fields for expected use cases

---

## Phase 3: Evaluator LLM Logic

### Overview
Create the evaluator that assesses answer quality and decides next actions.

### Changes Required:

#### 1. Create Evaluator Module
**File**: `packages/shared/src/evaluator.ts` (NEW)
**Changes**: LLM-based evaluator that decides if answer is sufficient

```typescript
/**
 * Evaluator Module
 *
 * Uses LLM to assess answer quality and decide whether to iterate,
 * search for more information, or return the answer.
 */

import type { LLMClient } from './llm.js';
import type {
  EvaluatorContext,
  EvaluationAction,
  CompressedContext,
  EvaluationStepResult,
} from './evaluation-types.js';

/**
 * Prompt for the evaluator LLM
 */
const EVALUATOR_SYSTEM_PROMPT = `You are an expert answer quality evaluator for a documentation system. Your job is to assess if an answer adequately addresses a user's question and decide what action to take.

You will receive:
1. The original question and its analysis
2. The current answer being evaluated
3. Confidence scores and their factors
4. Context from previous evaluation steps (if any)
5. Available actions you can take

Your task is to:
1. Assess if the answer ACTUALLY answers the question completely
2. Identify specific gaps or issues
3. Decide the best action to take
4. Compress the current context for the next step

CRITICAL: Be genuinely critical. Don't accept vague or incomplete answers.

AVAILABLE ACTIONS:
- RETURN_ANSWER: Answer is sufficient, return it to the user
- QUERY_MORE_DOCS: Need to search indexed documentation with different queries
- SEARCH_WEB: Need external information not in indexed docs
- REFINE_ANSWER: Have enough info but answer needs improvement

OUTPUT FORMAT (JSON):
{
  "assessment": {
    "answersQuestion": boolean,
    "completeness": "complete" | "partial" | "minimal" | "wrong",
    "specificIssues": ["issue1", "issue2"],
    "confidenceInAssessment": number (0-100)
  },
  "decision": {
    "action": "RETURN_ANSWER" | "QUERY_MORE_DOCS" | "SEARCH_WEB" | "REFINE_ANSWER",
    "reason": "why this action",
    "actionDetails": {
      // For QUERY_MORE_DOCS: { "queries": ["query1", "query2"] }
      // For SEARCH_WEB: { "queries": ["search1", "search2"] }
      // For REFINE_ANSWER: { "focusAreas": ["area1", "area2"] }
      // For RETURN_ANSWER: {}
    }
  },
  "contextCompression": {
    "establishedFacts": ["fact1", "fact2"],
    "identifiedGaps": ["gap1", "gap2"],
    "stillNeeded": ["need1", "need2"],
    "summary": "Brief summary of evaluation so far"
  }
}`;

/**
 * Build the user prompt for evaluation
 */
function buildEvaluatorUserPrompt(context: EvaluatorContext): string {
  const parts: string[] = [];

  parts.push('## Original Question');
  parts.push(`Query: "${context.query.text}"`);
  parts.push(`Type: ${context.query.type}`);
  parts.push(`Intent: ${context.query.intent}`);
  parts.push(`Key Terms: ${context.query.technicalTerms.join(', ')}`);
  parts.push('');

  parts.push('## Current Answer');
  parts.push('```');
  parts.push(context.currentAnswer.slice(0, 3000)); // Truncate very long answers
  if (context.currentAnswer.length > 3000) {
    parts.push('... [truncated]');
  }
  parts.push('```');
  parts.push('');

  parts.push('## Confidence Assessment');
  parts.push(`Score: ${context.confidence.score}/100`);
  parts.push(`Factors:`);
  parts.push(`- Retrieval: ${context.confidence.factors.retrievalScore}`);
  parts.push(`- Coverage: ${context.confidence.factors.coverageScore}`);
  parts.push(`- Answer Quality: ${context.confidence.factors.answerQualityScore}`);
  parts.push(`- Source Consistency: ${context.confidence.factors.sourceConsistency}`);
  parts.push(`Explanation: ${context.confidence.explanation}`);
  parts.push('');

  parts.push('## Indexed Documentation Results');
  parts.push(`Results found: ${context.indexedResults.count}`);
  parts.push(`Top topics covered: ${context.indexedResults.topTopics.join(', ')}`);
  parts.push(`Coverage gaps: ${context.indexedResults.coverageGaps.join(', ') || 'None identified'}`);
  parts.push('');

  if (context.previousContext) {
    parts.push('## Previous Evaluation Context');
    parts.push(`Summary: ${context.previousContext.summary}`);
    parts.push(`Established facts: ${context.previousContext.structured.establishedFacts.join('; ')}`);
    parts.push(`Queries tried: ${context.previousContext.structured.queriesTried.join(', ')}`);
    if (context.previousContext.structured.webSearchesDone.length > 0) {
      parts.push(`Web searches done: ${context.previousContext.structured.webSearchesDone.join(', ')}`);
    }
    parts.push('');
  }

  if (context.webResults && context.webResults.length > 0) {
    parts.push('## Web Search Results');
    for (const ws of context.webResults) {
      parts.push(`Query: "${ws.query}"`);
      for (const r of ws.results.slice(0, 3)) {
        parts.push(`- ${r.title}: ${r.content.slice(0, 200)}...`);
      }
    }
    parts.push('');
  }

  parts.push('## Available Actions');
  parts.push(`Can query more docs: ${context.availableActions.canQueryMoreDocs} (${context.availableActions.docQueriesRemaining} remaining)`);
  parts.push(`Can search web: ${context.availableActions.canSearchWeb} (${context.availableActions.webSearchesRemaining} remaining)`);
  parts.push('');

  parts.push('Evaluate the answer and decide what action to take. Be critical and specific.');

  return parts.join('\n');
}

/**
 * Parse the evaluator's JSON response
 */
function parseEvaluatorResponse(response: string): {
  assessment: {
    answersQuestion: boolean;
    completeness: string;
    specificIssues: string[];
    confidenceInAssessment: number;
  };
  decision: {
    action: string;
    reason: string;
    actionDetails: Record<string, any>;
  };
  contextCompression: {
    establishedFacts: string[];
    identifiedGaps: string[];
    stillNeeded: string[];
    summary: string;
  };
} {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    // Fallback: try to extract partial info
    console.error('Failed to parse evaluator response:', e);
    return {
      assessment: {
        answersQuestion: false,
        completeness: 'minimal',
        specificIssues: ['Failed to parse evaluation'],
        confidenceInAssessment: 0,
      },
      decision: {
        action: 'RETURN_ANSWER',
        reason: 'Evaluation parsing failed, returning current answer',
        actionDetails: {},
      },
      contextCompression: {
        establishedFacts: [],
        identifiedGaps: ['Evaluation failed'],
        stillNeeded: [],
        summary: 'Evaluation could not be completed',
      },
    };
  }
}

/**
 * Run a single evaluation step
 */
export async function runEvaluationStep(
  llmClient: LLMClient,
  context: EvaluatorContext,
  stepNumber: number
): Promise<EvaluationStepResult> {
  const startTime = Date.now();

  const response = await llmClient.synthesize(
    EVALUATOR_SYSTEM_PROMPT,
    buildEvaluatorUserPrompt(context),
    { temperature: 0.2, maxTokens: 2000 }
  );

  const parsed = parseEvaluatorResponse(response);

  // Convert to our action type
  let action: EvaluationAction;
  switch (parsed.decision.action) {
    case 'RETURN_ANSWER':
      action = { type: 'RETURN_ANSWER', reason: parsed.decision.reason };
      break;
    case 'QUERY_MORE_DOCS':
      action = {
        type: 'QUERY_MORE_DOCS',
        queries: parsed.decision.actionDetails.queries || [],
        reason: parsed.decision.reason,
      };
      break;
    case 'SEARCH_WEB':
      action = {
        type: 'SEARCH_WEB',
        queries: parsed.decision.actionDetails.queries || [],
        reason: parsed.decision.reason,
      };
      break;
    case 'REFINE_ANSWER':
      action = {
        type: 'REFINE_ANSWER',
        focusAreas: parsed.decision.actionDetails.focusAreas || [],
        reason: parsed.decision.reason,
      };
      break;
    default:
      action = { type: 'RETURN_ANSWER', reason: 'Unknown action, returning answer' };
  }

  // Build compressed context
  const compressedContext: CompressedContext = {
    structured: {
      establishedFacts: parsed.contextCompression.establishedFacts,
      identifiedGaps: parsed.contextCompression.identifiedGaps,
      sourcesUsed: [], // Will be populated by orchestrator
      queriesTried: context.previousContext?.structured.queriesTried || [],
      webSearchesDone: context.previousContext?.structured.webSearchesDone || [],
    },
    summary: parsed.contextCompression.summary,
    stillNeeded: parsed.contextCompression.stillNeeded,
  };

  return {
    step: stepNumber,
    action,
    currentAnswer: context.currentAnswer,
    confidence: {
      score: context.confidence.score,
      factors: Object.entries(context.confidence.factors)
        .map(([k, v]) => `${k}: ${v}`),
      gaps: parsed.assessment.specificIssues,
    },
    compressedContext,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extract topics from search results for context
 */
export function extractTopicsFromResults(results: Array<{ chunk: { section: string; title: string } }>): string[] {
  const topics = new Set<string>();
  for (const r of results.slice(0, 10)) {
    topics.add(r.chunk.section);
    topics.add(r.chunk.title);
  }
  return Array.from(topics).slice(0, 5);
}

/**
 * Identify coverage gaps by comparing query terms to results
 */
export function identifyCoverageGaps(
  queryTerms: string[],
  results: Array<{ chunk: { content: string } }>
): string[] {
  const resultContent = results.map(r => r.chunk.content.toLowerCase()).join(' ');
  return queryTerms.filter(term => !resultContent.includes(term.toLowerCase()));
}
```

#### 2. Create Answer Refiner
**File**: `packages/shared/src/answer-refiner.ts` (NEW)
**Changes**: Module to refine answers based on evaluation feedback

```typescript
/**
 * Answer Refiner Module
 *
 * Refines an answer based on evaluation feedback and additional context.
 */

import type { LLMClient } from './llm.js';
import type { CompressedContext } from './evaluation-types.js';
import type { SearchResult } from './types.js';
import type { WebSearchResult } from './web-search.js';

interface RefineInput {
  originalQuery: string;
  currentAnswer: string;
  focusAreas: string[];
  additionalContext: {
    newDocResults?: SearchResult[];
    webResults?: WebSearchResult[];
  };
  previousContext: CompressedContext;
  project: string;
}

const REFINER_SYSTEM_PROMPT = `You are an expert at improving documentation answers. Your job is to refine an answer based on feedback and additional context.

RULES:
1. Preserve accurate information from the original answer
2. Add new information from the additional context provided
3. Focus specifically on the areas identified for improvement
4. Maintain proper citations using [Source N] format
5. Keep code examples complete with all imports
6. Be concise - don't add fluff, only substantive improvements

OUTPUT: Return ONLY the improved answer, no meta-commentary.`;

export async function refineAnswer(
  llmClient: LLMClient,
  input: RefineInput
): Promise<string> {
  const parts: string[] = [];

  parts.push(`## Original Question\n${input.originalQuery}`);
  parts.push('');

  parts.push(`## Current Answer to Improve\n${input.currentAnswer}`);
  parts.push('');

  parts.push(`## Areas to Focus On\n${input.focusAreas.map(a => `- ${a}`).join('\n')}`);
  parts.push('');

  parts.push(`## What We Know So Far\n${input.previousContext.summary}`);
  parts.push(`Established facts: ${input.previousContext.structured.establishedFacts.join('; ')}`);
  parts.push('');

  if (input.additionalContext.newDocResults && input.additionalContext.newDocResults.length > 0) {
    parts.push('## Additional Documentation Found');
    for (const r of input.additionalContext.newDocResults.slice(0, 5)) {
      parts.push(`### ${r.chunk.title} - ${r.chunk.section}`);
      parts.push(r.chunk.content.slice(0, 1000));
      parts.push('');
    }
  }

  if (input.additionalContext.webResults && input.additionalContext.webResults.length > 0) {
    parts.push('## Web Search Results');
    for (const r of input.additionalContext.webResults.slice(0, 3)) {
      parts.push(`### ${r.title}`);
      parts.push(`URL: ${r.url}`);
      parts.push(r.content.slice(0, 800));
      parts.push('');
    }
  }

  parts.push('Improve the answer by addressing the focus areas and incorporating the new information. Return only the improved answer.');

  const refined = await llmClient.synthesize(
    REFINER_SYSTEM_PROMPT,
    parts.join('\n'),
    { maxTokens: 4000, temperature: 0.3 }
  );

  return refined;
}
```

#### 3. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add evaluator exports

```typescript
// Add to existing exports
export * from './evaluator.js';
export * from './answer-refiner.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors

#### Manual Verification:
- [ ] Evaluator returns valid JSON with actions
- [ ] Evaluator correctly identifies incomplete answers
- [ ] Refiner produces improved answers with new context

---

## Phase 4: Orchestration Loop

### Overview
Create the main orchestration loop that ties together evaluation, action execution, and iteration.

### Changes Required:

#### 1. Create Orchestrator Module
**File**: `packages/shared/src/evaluation-orchestrator.ts` (NEW)
**Changes**: Main loop that orchestrates the evaluation process

```typescript
/**
 * Evaluation Orchestrator
 *
 * Orchestrates the iterative evaluation loop, executing actions
 * and managing state between evaluation steps.
 */

import type { LLMClient } from './llm.js';
import type { HybridSearch } from './search.js';
import type { WebSearchClient } from './web-search.js';
import type {
  EvaluationInput,
  EvaluationOutput,
  EvaluationTrace,
  EvaluationStepResult,
  CompressedContext,
  EvaluatorContext,
  EvaluationConfig,
  DEFAULT_EVALUATION_CONFIG,
} from './evaluation-types.js';
import type { SearchResult } from './types.js';
import type { WebSearchResult } from './web-search.js';
import {
  runEvaluationStep,
  extractTopicsFromResults,
  identifyCoverageGaps,
} from './evaluator.js';
import { refineAnswer } from './answer-refiner.js';
import { extractQueryUnderstanding } from './understanding-extractor.js';
import { generateDocSearchQueries } from './web-search.js';

interface OrchestratorDependencies {
  llmClient: LLMClient;
  search: HybridSearch;
  webSearch?: WebSearchClient;
}

/**
 * Run the full evaluation loop
 */
export async function runEvaluationLoop(
  input: EvaluationInput,
  deps: OrchestratorDependencies
): Promise<EvaluationOutput> {
  const startTime = Date.now();
  const config = { ...DEFAULT_EVALUATION_CONFIG, ...input.config };

  // Initialize trace
  const trace: EvaluationTrace = {
    query: input.query,
    project: input.project,
    analysis: input.analysis,
    steps: [],
    finalAction: 'returned',
    totalDurationMs: 0,
    resourcesUsed: {
      llmCalls: 1, // Initial synthesis
      docQueries: 1, // Initial search
      webSearches: 0,
    },
  };

  // Quick return for very high confidence
  if (input.initialConfidence.score >= config.autoReturnConfidenceThreshold) {
    trace.totalDurationMs = Date.now() - startTime;
    return {
      answer: input.initialAnswer,
      confidence: input.initialConfidence.score,
      trace,
      sources: input.initialResults.map(r => ({
        type: 'indexed' as const,
        url: r.chunk.url,
        title: r.chunk.title,
      })),
      usedWebSearch: false,
      warnings: [],
    };
  }

  // State for the loop
  let currentAnswer = input.initialAnswer;
  let currentResults = input.initialResults;
  let webSearchResults: WebSearchResult[] = [];
  let previousContext: CompressedContext | null = null;
  let docQueriesRemaining = config.maxDocQueries;
  let webSearchesRemaining = config.maxWebSearches;

  // Track all sources
  const allSources: EvaluationOutput['sources'] = input.initialResults.map(r => ({
    type: 'indexed' as const,
    url: r.chunk.url,
    title: r.chunk.title,
  }));

  // Warnings to collect
  const warnings: string[] = [];

  // Main evaluation loop
  for (let step = 1; step <= config.maxIterations; step++) {
    // Build context for evaluator
    const understanding = extractQueryUnderstanding(
      input.query,
      input.project,
      input.analysis,
      currentResults,
      input.initialConfidence
    );

    const evaluatorContext: EvaluatorContext = {
      query: {
        text: input.query,
        type: input.analysis.type,
        intent: understanding.intent,
        technicalTerms: understanding.technicalTerms,
      },
      currentAnswer,
      confidence: input.initialConfidence, // TODO: Recalculate after refinement
      previousContext,
      availableActions: {
        canQueryMoreDocs: docQueriesRemaining > 0,
        canSearchWeb: config.enableWebSearch && webSearchesRemaining > 0 && !!deps.webSearch,
        docQueriesRemaining,
        webSearchesRemaining,
      },
      indexedResults: {
        count: currentResults.length,
        topTopics: extractTopicsFromResults(currentResults),
        coverageGaps: identifyCoverageGaps(understanding.technicalTerms, currentResults),
      },
    };

    // Run evaluation
    const stepResult = await runEvaluationStep(deps.llmClient, evaluatorContext, step);
    trace.steps.push(stepResult);
    trace.resourcesUsed.llmCalls++;

    // Update previous context
    previousContext = stepResult.compressedContext;

    // Execute the decided action
    switch (stepResult.action.type) {
      case 'RETURN_ANSWER':
        // Done - return the answer
        trace.finalAction = 'returned';
        trace.totalDurationMs = Date.now() - startTime;
        return {
          answer: currentAnswer,
          confidence: stepResult.confidence.score,
          trace,
          sources: allSources,
          usedWebSearch: webSearchResults.length > 0,
          warnings,
        };

      case 'QUERY_MORE_DOCS':
        if (docQueriesRemaining > 0) {
          for (const query of stepResult.action.queries.slice(0, 2)) {
            const newResults = await deps.search.search(query, {
              limit: 10,
              project: input.project,
              rerank: true,
            });
            trace.resourcesUsed.docQueries++;
            docQueriesRemaining--;

            // Merge new results (dedupe by URL)
            const existingUrls = new Set(currentResults.map(r => r.chunk.url));
            const uniqueNew = newResults.filter(r => !existingUrls.has(r.chunk.url));
            currentResults = [...currentResults, ...uniqueNew];

            // Track new sources
            for (const r of uniqueNew) {
              allSources.push({
                type: 'indexed',
                url: r.chunk.url,
                title: r.chunk.title,
              });
            }

            // Update compressed context
            previousContext!.structured.queriesTried.push(query);
          }
        }
        break;

      case 'SEARCH_WEB':
        if (config.enableWebSearch && deps.webSearch && webSearchesRemaining > 0) {
          for (const query of stepResult.action.queries.slice(0, 2)) {
            try {
              const webResponse = await deps.webSearch.search(query, {
                includeAnswer: false,
                maxResults: 5,
              });
              trace.resourcesUsed.webSearches++;
              webSearchesRemaining--;

              webSearchResults = [...webSearchResults, ...webResponse.results];

              // Track web sources
              for (const r of webResponse.results) {
                allSources.push({
                  type: 'web',
                  url: r.url,
                  title: r.title,
                });
              }

              // Update compressed context
              previousContext!.structured.webSearchesDone.push(query);
            } catch (e) {
              warnings.push(`Web search failed: ${query}`);
            }
          }

          // Add web results to evaluator context for next iteration
          evaluatorContext.webResults = [{
            query: stepResult.action.queries[0],
            results: webSearchResults,
          }];
        } else {
          warnings.push('Web search requested but not available');
        }
        break;

      case 'REFINE_ANSWER':
        // Refine the answer with current context
        currentAnswer = await refineAnswer(deps.llmClient, {
          originalQuery: input.query,
          currentAnswer,
          focusAreas: stepResult.action.focusAreas,
          additionalContext: {
            newDocResults: currentResults.slice(input.initialResults.length),
            webResults: webSearchResults,
          },
          previousContext: previousContext!,
          project: input.project,
        });
        trace.resourcesUsed.llmCalls++;
        break;
    }
  }

  // Max iterations reached
  trace.finalAction = 'max_iterations';
  trace.totalDurationMs = Date.now() - startTime;
  warnings.push(`Reached maximum ${config.maxIterations} evaluation iterations`);

  return {
    answer: currentAnswer,
    confidence: trace.steps[trace.steps.length - 1]?.confidence.score || 50,
    trace,
    sources: allSources,
    usedWebSearch: webSearchResults.length > 0,
    warnings,
  };
}
```

#### 2. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add orchestrator exports

```typescript
// Add to existing exports
export * from './evaluation-orchestrator.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors

#### Manual Verification:
- [ ] Loop terminates correctly on RETURN_ANSWER
- [ ] Loop executes QUERY_MORE_DOCS and merges results
- [ ] Loop executes SEARCH_WEB when available
- [ ] Loop respects maxIterations

---

## Phase 5: Integration into ask-docs

### Overview
Integrate the evaluation loop into the ask-docs tool, making it the new default flow.

### Changes Required:

#### 1. Update Tool Context
**File**: `packages/server/src/tools/index.ts`
**Changes**: Add WebSearchClient to tool context

```typescript
import { WebSearchClient } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  llmClient: LLMClient;
  reranker: Reranker;
  webSearch?: WebSearchClient; // NEW
}

// In server initialization, add:
const webSearch = config.tavily?.apiKey
  ? new WebSearchClient({
      apiKey: config.tavily.apiKey,
      searchDepth: config.tavily.searchDepth,
      maxResults: config.tavily.maxResults,
    })
  : undefined;
```

#### 2. Update ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Use evaluation loop for answer generation

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import {
  analyzeQuery,
  correctiveSearch,
  shouldApplyCorrectiveRAG,
  extractQueryUnderstanding,
  shouldIncludeSearchGuidance,
  generateSearchGuidance,
  formatSearchGuidanceAsMarkdown,
  calculateConfidenceScore,
  // NEW imports
  runEvaluationLoop,
  DEFAULT_EVALUATION_CONFIG,
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence, getFullConfidenceResult } from '../utils/response-builder.js';
import { generateSuggestions, generateRelatedQueries } from '../utils/suggestion-generator.js';
import { conversationContext } from '../context/conversation-context.js';
import { logger } from '../utils/logger.js';

export const AskDocsSchema = z.object({
  question: z.string().describe('Your question about the documentation'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)'),
  // NEW: Option to use agentic evaluation
  useAgenticEvaluation: z.boolean().optional().default(true).describe('Use iterative evaluation loop (default: true)'),
});

type AskDocsArgs = z.infer<typeof AskDocsSchema>;

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // 1. Analyze query
  logger.debug('Analyzing query...');
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);
  logger.queryAnalysis(analysis);

  // 2. Enhance with conversation context
  const enhancedQuery = conversationContext.enhanceQuery(args.project, analysis.expandedQuery);
  const isFollowUp = conversationContext.isLikelyFollowUp(args.project, args.question);

  // 3. Initial retrieval
  logger.info('Performing initial search...');
  const searchStart = Date.now();
  let results = await context.search.search(enhancedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });
  logger.search(enhancedQuery, results.length, Date.now() - searchStart);

  // 4. Apply corrective RAG if needed
  if (shouldApplyCorrectiveRAG(results)) {
    logger.info('Applying corrective RAG...');
    const corrective = await correctiveSearch(
      context.search,
      args.question,
      analysis,
      args.project,
      { maxRetries: 2, mergeResults: true }
    );
    results = corrective.results;
    if (corrective.wasRetried) {
      builder.addWarning(`Retried with alternative queries: ${corrective.alternativeQueries.join(', ')}`);
    }
  }

  // 5. Store conversation context
  conversationContext.addTurn(args.project, args.question, analysis.type, analysis.keywords);

  // 6. Handle no results
  if (results.length === 0) {
    return handleNoResults(args, analysis, builder);
  }

  // 7. Format context and generate initial answer
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });
  const projectContext = getProjectContext(args.project);

  logger.info('Generating initial answer...');
  const initialAnswer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system + projectContext,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  const initialConfidence = getFullConfidenceResult(args.question, analysis, results, initialAnswer);

  // 8. NEW: Run agentic evaluation loop if enabled
  if (args.useAgenticEvaluation) {
    logger.info('Running agentic evaluation loop...');

    const evaluationOutput = await runEvaluationLoop(
      {
        query: args.question,
        project: args.project,
        analysis,
        initialResults: results,
        initialAnswer,
        initialConfidence,
        config: {
          ...DEFAULT_EVALUATION_CONFIG,
          enableWebSearch: !!context.webSearch,
        },
      },
      {
        llmClient: context.llmClient,
        search: context.search,
        webSearch: context.webSearch,
      }
    );

    // Use evaluation output
    builder.setConfidence(evaluationOutput.confidence);
    builder.setRetrievalQuality(results);

    // Add sources
    for (const source of evaluationOutput.sources) {
      if (source.type === 'web') {
        builder.addWebSource(source.url, source.title);
      }
    }
    builder.setSources(results);

    // Add warnings
    for (const warning of evaluationOutput.warnings) {
      builder.addWarning(warning);
    }

    // Add evaluation trace to metadata (optional, for debugging)
    if (process.env.DEBUG_EVALUATION) {
      builder.setEvaluationTrace(evaluationOutput.trace);
    }

    // Log evaluation stats
    logger.info(`Evaluation completed: ${evaluationOutput.trace.steps.length} steps, ` +
      `${evaluationOutput.trace.resourcesUsed.llmCalls} LLM calls, ` +
      `${evaluationOutput.trace.resourcesUsed.webSearches} web searches, ` +
      `${evaluationOutput.trace.totalDurationMs}ms total`);

    // Generate suggestions
    const suggestions = generateSuggestions(analysis, results, args.project);
    suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));

    const relatedQueries = generateRelatedQueries(args.question, analysis, results, args.project);
    relatedQueries.forEach(q => builder.addRelatedQuery(q));

    return builder.buildMCPResponse(evaluationOutput.answer);
  }

  // 9. Original flow (fallback if agentic disabled)
  const confidence = calculateConfidence(args.question, analysis, results, initialAnswer);
  builder.setConfidence(confidence);
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // Add search guidance if needed
  const understanding = extractQueryUnderstanding(args.question, args.project, analysis, results, initialConfidence);
  if (shouldIncludeSearchGuidance(results, confidence, understanding)) {
    const searchGuidance = generateSearchGuidance(understanding, args.question);
    const guidanceText = formatSearchGuidanceAsMarkdown(searchGuidance);
    builder.setSearchGuidance(searchGuidance);
    builder.addWarning('Answer may be incomplete - web search recommended');
    return builder.buildMCPResponse(`${initialAnswer}\n${guidanceText}`);
  }

  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));

  const relatedQueries = generateRelatedQueries(args.question, analysis, results, args.project);
  relatedQueries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(initialAnswer);
}

function handleNoResults(
  args: AskDocsArgs,
  analysis: QueryAnalysis,
  builder: ResponseBuilder
) {
  builder.setConfidence(0);
  builder.addWarning('No documentation found for this query');
  builder.addSuggestion('search_docs', 'Try a broader search', {
    query: analysis.keywords[0] || args.question.split(' ')[0],
    project: args.project
  });
  return builder.buildMCPResponse(
    `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
  );
}
```

#### 3. Update ResponseBuilder for evaluation metadata
**File**: `packages/server/src/utils/response-builder.ts`
**Changes**: Add support for evaluation trace and web sources

```typescript
import type { EvaluationTrace } from '@mina-docs/shared';

export class ResponseBuilder {
  // ... existing properties ...
  private webSources: Array<{ url: string; title: string }> = [];
  private evaluationTrace?: EvaluationTrace;

  addWebSource(url: string, title: string): this {
    this.webSources.push({ url, title });
    return this;
  }

  setEvaluationTrace(trace: EvaluationTrace): this {
    this.evaluationTrace = trace;
    return this;
  }

  // Update build() to include new fields in metadata
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass

#### Manual Verification:
- [ ] Query about well-documented topic returns quickly (1-2 iterations)
- [ ] Query about partially-documented topic iterates and improves
- [ ] Web search is triggered when indexed docs are insufficient
- [ ] `useAgenticEvaluation: false` falls back to original behavior
- [ ] Response includes evaluation stats in logs

---

## Phase 6: Testing and Refinement

### Overview
Test the implementation with real queries and refine the prompts/thresholds.

### Test Cases:

#### 1. High Confidence Path (1 iteration)
Query: "How do I create a SmartContract in o1js?"
Expected: Returns quickly, no web search, high confidence

#### 2. Medium Confidence Path (2-3 iterations)
Query: "How do I use recursion in o1js proofs?"
Expected: May do additional doc queries, possibly refine answer

#### 3. Low Confidence / Web Search Path
Query: "What are the latest changes in o1js 1.2.0?"
Expected: Triggers web search for recent information

#### 4. Complete Unknown
Query: "How do I integrate o1js with Chainlink oracles?"
Expected: Web search, may return partial answer with guidance

### Manual Testing Steps:
1. Start server with `TAVILY_API_KEY` set
2. Test each scenario above via MCP client
3. Check logs for evaluation trace
4. Verify web search is actually called when expected
5. Compare answer quality to non-agentic mode

### Success Criteria:

#### Automated Verification:
- [ ] All existing evaluation tests pass
- [ ] New integration tests for evaluation loop pass

#### Manual Verification:
- [ ] Answer quality is improved over single-pass
- [ ] Latency is acceptable (< 15s for complex queries)
- [ ] Web search adds value when triggered
- [ ] No infinite loops or runaway iterations

---

## Testing Strategy

### Unit Tests:
- Evaluator JSON parsing handles edge cases
- Context compression preserves key information
- Action execution respects limits (maxDocQueries, maxWebSearches)
- Termination conditions work correctly

### Integration Tests:
- Full loop with mock LLM responses
- Web search integration with mock Tavily
- End-to-end ask-docs with agentic mode

### Manual Testing:
1. Test with real TAVILY_API_KEY
2. Compare agentic vs non-agentic answers
3. Verify evaluation trace in debug mode
4. Test edge cases (no results, timeout, API errors)

## Performance Considerations

- **Latency Budget**: Target 3-5s for simple, up to 15s for complex queries
- **LLM Calls**: Minimize by using high autoReturnConfidenceThreshold (85)
- **Web Search**: Only when truly needed (evaluator decides)
- **Context Size**: Compress between iterations to stay within limits
- **Caching**: Consider caching web search results for repeated queries

## Migration Notes

1. **Backwards Compatible**: `useAgenticEvaluation: false` preserves old behavior
2. **Optional Tavily**: Works without TAVILY_API_KEY (web search disabled)
3. **No Breaking Changes**: Response format unchanged, only quality improved
4. **Gradual Rollout**: Can enable per-query or globally

## References

- Current ask-docs: `packages/server/src/tools/ask-docs.ts`
- LLM client: `packages/shared/src/llm.ts`
- Confidence scoring: `packages/shared/src/confidence.ts`
- Understanding extractor: `packages/shared/src/understanding-extractor.ts`
- Search guidance: `packages/shared/src/search-query-generator.ts`
- Corrective RAG: `packages/shared/src/corrective-rag.ts`
- Existing fallback plan: `thoughts/shared/plans/2026-01-10-intelligent-fallback-web-search-guidance.md`
