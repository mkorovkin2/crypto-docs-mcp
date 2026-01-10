# Crypto Docs MCP - Coding Agent Optimization Implementation Plan

## Overview

Transform the Crypto Docs MCP server from a "good documentation search" into an "expert coding assistant" that provides structured, actionable responses optimized for AI coding agents. This plan focuses on three pillars: (1) Better code output, (2) Smarter search/retrieval, and (3) Agent-friendly response patterns.

## Current State Analysis

### What's Already Working Well
- LLM-synthesized responses with GPT-4o (no raw chunks)
- Hybrid search with Reciprocal Rank Fusion (vector + FTS)
- Reranking with extended 2000-char context
- Query type classification (error/howto/concept/code_lookup/api_reference)
- Rich code metadata in prompts (class, method, function, file path)
- Project-specific context injection (Mina/Solana/Cosmos notes)

### Key Gaps for Coding Agent Optimization

1. **No Structured Metadata in Responses**: Agents receive prose only; no machine-readable signals
2. **No Confidence Indicators**: Agent can't tell if result is high-quality or a best-effort guess
3. **No Follow-up Suggestions**: Agent doesn't know what else to ask
4. **Token-based Chunking**: Code chunks break mid-function, losing semantic boundaries
5. **No Conversation Context**: Each query is independent; no memory of prior context
6. **No Code Verification**: Generated code isn't validated for syntax/completeness
7. **Single-shot Retrieval**: No iterative refinement for poor initial results

## Desired End State

After implementation, the MCP server will:

1. **Return Structured Responses**: JSON metadata block with confidence, suggestions, and related queries
2. **Provide Confidence Scores**: 0-100 score indicating retrieval/synthesis quality
3. **Suggest Follow-up Actions**: "Call get_working_example for runnable code" hints
4. **Maintain Conversation Context**: Remember project context and prior queries
5. **Generate Complete Code**: AST-aware chunking ensures imports and functions stay intact
6. **Self-Verify Code**: Check generated code for syntax errors before returning
7. **Iteratively Improve**: Retry with broader search if initial confidence is low

### Verification Criteria
- Agent can parse response metadata programmatically
- Confidence correlates with actual answer quality
- Follow-up suggestions lead to better outcomes
- Generated code compiles/parses without modification
- Multi-turn conversations maintain coherent context

## What We're NOT Doing

1. **Full agentic retrieval loops** - No inner LLM planning; fixed pipeline
2. **Real-time doc updates** - Docs refreshed via scraper, not live
3. **Custom embeddings model** - Continue using OpenAI text-embedding-3-small
4. **Multi-LLM support** - OpenAI only for now
5. **Streaming responses** - MCP doesn't handle streaming well

## Implementation Approach

Bottom-up implementation in 5 phases:
1. Agent-friendly response format (structured metadata)
2. Confidence scoring and retrieval quality signals
3. Smarter retrieval (multi-turn context, corrective RAG)
4. Code quality improvements (AST chunking, verification)
5. Follow-up intelligence (suggestions, related queries)

---

## Phase 1: Structured Response Format

### Overview
Add machine-readable metadata to all tool responses. Agents can parse this to make better decisions about next actions.

### Changes Required:

#### 1. Define Response Schema
**File**: `packages/shared/src/types.ts`
**Changes**: Add AgentResponse type

```typescript
/**
 * Structured response for agent consumption
 */
export interface AgentResponseMetadata {
  /** Confidence score 0-100 (100 = highly confident) */
  confidence: number;

  /** Quality of retrieval (number of relevant chunks found) */
  retrievalQuality: 'high' | 'medium' | 'low' | 'none';

  /** Number of source chunks used */
  sourcesUsed: number;

  /** Query type detected */
  queryType: string;

  /** Suggested follow-up actions */
  suggestions: Array<{
    action: string;  // Tool name or action type
    reason: string;  // Why this might help
    params?: Record<string, string>;  // Suggested parameters
  }>;

  /** Related queries the agent might consider */
  relatedQueries?: string[];

  /** Warnings about the response */
  warnings?: string[];

  /** Processing time in ms */
  processingTimeMs: number;
}

export interface AgentResponse {
  /** The synthesized text response */
  answer: string;

  /** Structured metadata for agents */
  metadata: AgentResponseMetadata;

  /** Source URLs for verification */
  sources: Array<{
    index: number;
    url: string;
    title: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
}
```

#### 2. Create Response Builder Utility
**File**: `packages/server/src/utils/response-builder.ts` (NEW)

```typescript
import type { AgentResponseMetadata, AgentResponse } from '@mina-docs/shared';
import type { SearchResult } from '@mina-docs/shared';

export class ResponseBuilder {
  private startTime: number;
  private metadata: Partial<AgentResponseMetadata> = {};
  private sources: AgentResponse['sources'] = [];
  private warnings: string[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  setConfidence(score: number): this {
    this.metadata.confidence = Math.max(0, Math.min(100, score));
    return this;
  }

  setRetrievalQuality(results: SearchResult[]): this {
    const count = results.length;
    if (count >= 8) {
      this.metadata.retrievalQuality = 'high';
    } else if (count >= 4) {
      this.metadata.retrievalQuality = 'medium';
    } else if (count > 0) {
      this.metadata.retrievalQuality = 'low';
    } else {
      this.metadata.retrievalQuality = 'none';
    }
    this.metadata.sourcesUsed = count;
    return this;
  }

  setQueryType(type: string): this {
    this.metadata.queryType = type;
    return this;
  }

  addSuggestion(action: string, reason: string, params?: Record<string, string>): this {
    if (!this.metadata.suggestions) {
      this.metadata.suggestions = [];
    }
    this.metadata.suggestions.push({ action, reason, params });
    return this;
  }

  addRelatedQuery(query: string): this {
    if (!this.metadata.relatedQueries) {
      this.metadata.relatedQueries = [];
    }
    this.metadata.relatedQueries.push(query);
    return this;
  }

  addWarning(warning: string): this {
    this.warnings.push(warning);
    return this;
  }

  setSources(results: SearchResult[]): this {
    this.sources = results.map((r, i) => ({
      index: i + 1,
      url: r.chunk.url,
      title: `${r.chunk.title} - ${r.chunk.section}`,
      relevance: r.score > 0.8 ? 'high' : r.score > 0.5 ? 'medium' : 'low'
    }));
    return this;
  }

  build(answer: string): AgentResponse {
    return {
      answer,
      metadata: {
        confidence: this.metadata.confidence || 50,
        retrievalQuality: this.metadata.retrievalQuality || 'low',
        sourcesUsed: this.metadata.sourcesUsed || 0,
        queryType: this.metadata.queryType || 'general',
        suggestions: this.metadata.suggestions || [],
        relatedQueries: this.metadata.relatedQueries,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        processingTimeMs: Date.now() - this.startTime
      },
      sources: this.sources
    };
  }

  /**
   * Format response for MCP (combines text + JSON metadata)
   */
  buildMCPResponse(answer: string): { content: Array<{ type: string; text: string }> } {
    const response = this.build(answer);

    // Format as markdown with embedded metadata
    const formattedAnswer = `${response.answer}

---

### Response Metadata
\`\`\`json
${JSON.stringify(response.metadata, null, 2)}
\`\`\`

### Sources
${response.sources.map(s => `[${s.index}] ${s.title}\n   ${s.url}`).join('\n')}`;

    return {
      content: [{
        type: 'text',
        text: formattedAnswer
      }]
    };
  }
}
```

#### 3. Update ask_docs to Use ResponseBuilder
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Integrate ResponseBuilder

```typescript
import { ResponseBuilder } from '../utils/response-builder.js';
import { generateSuggestions } from '../utils/suggestion-generator.js';

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // 1. Analyze query
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);

  // 2. Search
  const results = await context.search.search(analysis.expandedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });

  builder.setRetrievalQuality(results);
  builder.setSources(results);

  if (results.length === 0) {
    builder.setConfidence(0);
    builder.addWarning('No documentation found for this query');
    builder.addSuggestion('search_docs', 'Try a broader keyword search', {
      query: analysis.keywords[0] || args.question.split(' ')[0],
      project: args.project
    });
    return builder.buildMCPResponse(
      `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
    );
  }

  // 3. Format and synthesize
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  const projectContext = getProjectContext(args.project);
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system + projectContext,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Calculate confidence based on retrieval quality and answer length
  const confidence = calculateConfidence(results, answer, analysis);
  builder.setConfidence(confidence);

  // 5. Generate contextual suggestions
  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));

  // 6. Add related queries
  if (analysis.keywords.length > 0) {
    builder.addRelatedQuery(`How to use ${analysis.keywords[0]} in ${args.project}`);
  }

  return builder.buildMCPResponse(answer);
}

function calculateConfidence(
  results: SearchResult[],
  answer: string,
  analysis: QueryAnalysis
): number {
  let confidence = 50; // Base

  // More results = higher confidence
  confidence += Math.min(results.length * 3, 20);

  // High scores in top results
  const avgTopScore = results.slice(0, 3).reduce((sum, r) => sum + (r.score || 0.5), 0) / 3;
  confidence += avgTopScore * 20;

  // Answer length (too short might mean insufficient info)
  if (answer.length > 500) confidence += 10;

  // Code in answer for code queries
  if (analysis.type === 'code_lookup' && answer.includes('```')) {
    confidence += 10;
  }

  return Math.min(100, Math.max(0, Math.round(confidence)));
}
```

#### 4. Create Suggestion Generator
**File**: `packages/server/src/utils/suggestion-generator.ts` (NEW)

```typescript
import type { QueryAnalysis } from '@mina-docs/shared';
import type { SearchResult } from '@mina-docs/shared';

interface Suggestion {
  action: string;
  reason: string;
  params?: Record<string, string>;
}

export function generateSuggestions(
  analysis: QueryAnalysis,
  results: SearchResult[],
  project: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Suggest get_working_example for how-to queries
  if (analysis.type === 'howto' && !suggestions.some(s => s.action === 'get_working_example')) {
    suggestions.push({
      action: 'get_working_example',
      reason: 'Get a complete, runnable code example for this task',
      params: { task: analysis.keywords[0] || '', project }
    });
  }

  // Suggest explain_error for error-like queries
  if (analysis.type === 'error' && !suggestions.some(s => s.action === 'explain_error')) {
    suggestions.push({
      action: 'explain_error',
      reason: 'Get detailed error analysis and fix',
      params: { project }
    });
  }

  // Suggest search_docs for broader exploration
  if (results.length < 5) {
    suggestions.push({
      action: 'search_docs',
      reason: 'Limited results found - try browsing related documentation',
      params: {
        query: analysis.expandedQuery.split(' ').slice(0, 3).join(' '),
        project
      }
    });
  }

  // Suggest API lookup for code queries
  if (analysis.type === 'code_lookup' && analysis.keywords.length > 0) {
    suggestions.push({
      action: 'search_docs',
      reason: `Look up API reference for ${analysis.keywords[0]}`,
      params: {
        query: `${analysis.keywords[0]} API reference`,
        project,
        contentType: 'api-reference'
      }
    });
  }

  return suggestions;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] ResponseBuilder creates valid JSON metadata
- [ ] All tools return structured responses

#### Manual Verification:
- [ ] Response includes JSON metadata block
- [ ] Confidence scores correlate with answer quality
- [ ] Suggestions are contextually relevant

---

## Phase 2: Confidence Scoring & Retrieval Quality

### Overview
Implement robust confidence scoring based on retrieval quality, answer synthesis, and query-answer alignment.

### Changes Required:

#### 1. Create Confidence Scorer Module
**File**: `packages/shared/src/confidence.ts` (NEW)

```typescript
import type { SearchResult } from './types.js';
import type { QueryAnalysis } from './query-analyzer.js';

export interface ConfidenceFactors {
  retrievalScore: number;      // 0-100: How good were the retrieved docs
  coverageScore: number;       // 0-100: How well do docs cover the query
  answerQualityScore: number;  // 0-100: Does answer look complete
  sourceConsistency: number;   // 0-100: Do sources agree with each other
}

export interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactors;
  explanation: string;
}

/**
 * Calculate comprehensive confidence score
 */
export function calculateConfidenceScore(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  answer: string
): ConfidenceResult {
  const factors: ConfidenceFactors = {
    retrievalScore: calculateRetrievalScore(results),
    coverageScore: calculateCoverageScore(query, analysis, results),
    answerQualityScore: calculateAnswerQuality(answer, analysis),
    sourceConsistency: calculateSourceConsistency(results)
  };

  // Weighted average
  const weights = {
    retrievalScore: 0.3,
    coverageScore: 0.25,
    answerQualityScore: 0.3,
    sourceConsistency: 0.15
  };

  const score = Math.round(
    factors.retrievalScore * weights.retrievalScore +
    factors.coverageScore * weights.coverageScore +
    factors.answerQualityScore * weights.answerQualityScore +
    factors.sourceConsistency * weights.sourceConsistency
  );

  return {
    score,
    factors,
    explanation: generateExplanation(score, factors)
  };
}

function calculateRetrievalScore(results: SearchResult[]): number {
  if (results.length === 0) return 0;

  // Factor in number of results
  const countScore = Math.min(results.length / 10 * 50, 50);

  // Factor in average relevance score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  const relevanceScore = avgScore * 50;

  return Math.round(countScore + relevanceScore);
}

function calculateCoverageScore(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[]
): number {
  // Check if keywords from query appear in results
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const resultText = results.map(r => r.chunk.content.toLowerCase()).join(' ');

  const coveredWords = queryWords.filter(w => resultText.includes(w));
  const keywordCoverage = queryWords.length > 0
    ? (coveredWords.length / queryWords.length) * 100
    : 50;

  // Check if analysis keywords are covered
  const analysisKeywords = analysis.keywords.map(k => k.toLowerCase());
  const coveredAnalysisKeywords = analysisKeywords.filter(k => resultText.includes(k));
  const analysisCoverage = analysisKeywords.length > 0
    ? (coveredAnalysisKeywords.length / analysisKeywords.length) * 100
    : 50;

  return Math.round((keywordCoverage + analysisCoverage) / 2);
}

function calculateAnswerQuality(answer: string, analysis: QueryAnalysis): number {
  let score = 50;

  // Length check
  if (answer.length > 200) score += 10;
  if (answer.length > 500) score += 10;
  if (answer.length > 1000) score += 5;

  // Code presence for code queries
  if (analysis.type === 'code_lookup' || analysis.type === 'howto') {
    if (answer.includes('```')) score += 15;
    if (answer.includes('import')) score += 5;
  }

  // Structure indicators
  if (answer.includes('##')) score += 5;  // Has sections
  if (answer.includes('[Source')) score += 5;  // Has citations

  return Math.min(100, score);
}

function calculateSourceConsistency(results: SearchResult[]): number {
  if (results.length < 2) return 50;

  // Check if sources are from similar sections/topics
  const sections = results.map(r => r.chunk.section.toLowerCase());
  const uniqueSections = new Set(sections);

  // More variety = potentially inconsistent
  const varietyPenalty = (uniqueSections.size / results.length) * 30;

  return Math.round(100 - varietyPenalty);
}

function generateExplanation(score: number, factors: ConfidenceFactors): string {
  const parts: string[] = [];

  if (factors.retrievalScore < 40) {
    parts.push('Limited relevant documentation found');
  }
  if (factors.coverageScore < 40) {
    parts.push('Query keywords not well covered in results');
  }
  if (factors.answerQualityScore < 40) {
    parts.push('Answer may be incomplete');
  }

  if (parts.length === 0) {
    if (score >= 80) return 'High confidence - good retrieval and comprehensive answer';
    if (score >= 60) return 'Moderate confidence - reasonable coverage';
    return 'Low confidence - results may not fully address the query';
  }

  return parts.join('; ');
}
```

#### 2. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add confidence export

```typescript
export * from './confidence.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Confidence module compiles and exports correctly
- [ ] Score is always 0-100

#### Manual Verification:
- [ ] High confidence correlates with good answers
- [ ] Low confidence correlates with uncertain/incomplete answers

---

## Phase 3: Multi-Turn Context & Corrective RAG

### Overview
Add conversation context awareness and implement corrective retrieval for low-confidence results.

### Changes Required:

#### 1. Create Conversation Context Manager
**File**: `packages/server/src/context/conversation-context.ts` (NEW)

```typescript
/**
 * Manages conversation context for multi-turn interactions
 * Stores recent queries and results per project
 */

interface ConversationTurn {
  query: string;
  queryType: string;
  timestamp: number;
  keywords: string[];
}

interface ProjectContext {
  turns: ConversationTurn[];
  lastAccess: number;
}

const MAX_TURNS = 5;
const CONTEXT_TTL_MS = 10 * 60 * 1000; // 10 minutes

class ConversationContextManager {
  private contexts: Map<string, ProjectContext> = new Map();

  /**
   * Add a turn to the conversation context
   */
  addTurn(project: string, query: string, queryType: string, keywords: string[]): void {
    const ctx = this.getOrCreateContext(project);

    ctx.turns.push({
      query,
      queryType,
      timestamp: Date.now(),
      keywords
    });

    // Keep only recent turns
    if (ctx.turns.length > MAX_TURNS) {
      ctx.turns.shift();
    }

    ctx.lastAccess = Date.now();
    this.cleanup();
  }

  /**
   * Get context for query expansion
   */
  getContextForExpansion(project: string): {
    recentKeywords: string[];
    recentTopics: string[];
    isFollowUp: boolean;
  } {
    const ctx = this.contexts.get(project);

    if (!ctx || ctx.turns.length === 0) {
      return { recentKeywords: [], recentTopics: [], isFollowUp: false };
    }

    const recentKeywords = [...new Set(
      ctx.turns.flatMap(t => t.keywords).slice(-10)
    )];

    const recentTopics = ctx.turns.map(t =>
      t.query.split(' ').slice(0, 3).join(' ')
    );

    // Is this a follow-up? (query within 2 minutes of last)
    const lastTurn = ctx.turns[ctx.turns.length - 1];
    const isFollowUp = Date.now() - lastTurn.timestamp < 2 * 60 * 1000;

    return { recentKeywords, recentTopics, isFollowUp };
  }

  /**
   * Enhance query with conversation context
   */
  enhanceQuery(project: string, query: string): string {
    const context = this.getContextForExpansion(project);

    if (!context.isFollowUp || context.recentKeywords.length === 0) {
      return query;
    }

    // Add relevant context keywords that aren't already in query
    const queryLower = query.toLowerCase();
    const relevantKeywords = context.recentKeywords
      .filter(k => !queryLower.includes(k.toLowerCase()))
      .slice(0, 2);

    if (relevantKeywords.length > 0) {
      return `${query} (context: ${relevantKeywords.join(', ')})`;
    }

    return query;
  }

  private getOrCreateContext(project: string): ProjectContext {
    let ctx = this.contexts.get(project);
    if (!ctx) {
      ctx = { turns: [], lastAccess: Date.now() };
      this.contexts.set(project, ctx);
    }
    return ctx;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [project, ctx] of this.contexts.entries()) {
      if (now - ctx.lastAccess > CONTEXT_TTL_MS) {
        this.contexts.delete(project);
      }
    }
  }
}

export const conversationContext = new ConversationContextManager();
```

#### 2. Create Corrective RAG Module
**File**: `packages/shared/src/corrective-rag.ts` (NEW)

```typescript
import type { SearchResult } from './types.js';
import type { HybridSearch } from './search.js';
import type { QueryAnalysis } from './query-analyzer.js';

export interface CorrectiveRAGOptions {
  minConfidenceThreshold: number;  // Below this, retry with expanded query
  maxRetries: number;
}

const DEFAULT_OPTIONS: CorrectiveRAGOptions = {
  minConfidenceThreshold: 40,
  maxRetries: 2
};

/**
 * Evaluate retrieval quality quickly without LLM
 */
export function evaluateRetrievalQuality(
  query: string,
  results: SearchResult[]
): 'high' | 'medium' | 'low' {
  if (results.length === 0) return 'low';

  // Check result count
  if (results.length < 3) return 'low';

  // Check average score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  if (avgScore < 0.4) return 'low';

  // Check keyword coverage
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const resultText = results.slice(0, 3).map(r => r.chunk.content.toLowerCase()).join(' ');
  const coveredWords = queryWords.filter(w => resultText.includes(w));
  const coverage = queryWords.length > 0 ? coveredWords.length / queryWords.length : 0.5;

  if (coverage < 0.3) return 'low';
  if (coverage < 0.6 || avgScore < 0.6) return 'medium';

  return 'high';
}

/**
 * Generate alternative queries for retry
 */
export function generateAlternativeQueries(
  originalQuery: string,
  analysis: QueryAnalysis
): string[] {
  const alternatives: string[] = [];

  // Broader query (fewer keywords)
  const words = originalQuery.split(' ').filter(w => w.length > 3);
  if (words.length > 2) {
    alternatives.push(words.slice(0, Math.ceil(words.length / 2)).join(' '));
  }

  // Add tutorial/example suffix for how-to queries
  if (analysis.type === 'howto') {
    alternatives.push(`${originalQuery} tutorial example`);
  }

  // Add error/fix suffix for error queries
  if (analysis.type === 'error') {
    alternatives.push(`${originalQuery} solution fix`);
  }

  // Use extracted keywords directly
  if (analysis.keywords.length > 0) {
    alternatives.push(analysis.keywords.join(' '));
  }

  return alternatives;
}

/**
 * Perform corrective retrieval if initial results are poor
 */
export async function correctiveSearch(
  search: HybridSearch,
  query: string,
  analysis: QueryAnalysis,
  initialResults: SearchResult[],
  project: string,
  options: CorrectiveRAGOptions = DEFAULT_OPTIONS
): Promise<{
  results: SearchResult[];
  wasRetried: boolean;
  retriesUsed: number;
}> {
  const quality = evaluateRetrievalQuality(query, initialResults);

  if (quality === 'high') {
    return { results: initialResults, wasRetried: false, retriesUsed: 0 };
  }

  if (quality === 'medium' || initialResults.length >= 5) {
    // Medium quality - might be acceptable
    return { results: initialResults, wasRetried: false, retriesUsed: 0 };
  }

  // Low quality - try alternatives
  const alternatives = generateAlternativeQueries(query, analysis);
  let bestResults = initialResults;
  let retriesUsed = 0;

  for (const altQuery of alternatives.slice(0, options.maxRetries)) {
    retriesUsed++;

    const altResults = await search.search(altQuery, {
      limit: 15,
      project,
      rerank: true,
      rerankTopK: 10
    });

    // Merge results, preferring new unique ones
    const existingIds = new Set(bestResults.map(r => r.chunk.id));
    const newResults = altResults.filter(r => !existingIds.has(r.chunk.id));

    bestResults = [...bestResults, ...newResults].slice(0, 15);

    // Check if we've improved enough
    const newQuality = evaluateRetrievalQuality(query, bestResults);
    if (newQuality !== 'low') break;
  }

  return { results: bestResults, wasRetried: true, retriesUsed };
}
```

#### 3. Integrate into Tools
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Add corrective RAG and context awareness

```typescript
import { conversationContext } from '../context/conversation-context.js';
import { correctiveSearch, evaluateRetrievalQuality } from '@mina-docs/shared';

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // 1. Analyze query
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);

  // 2. Enhance query with conversation context
  const enhancedQuery = conversationContext.enhanceQuery(args.project, analysis.expandedQuery);

  // 3. Initial search
  const initialResults = await context.search.search(enhancedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });

  // 4. Corrective RAG if needed
  const { results, wasRetried, retriesUsed } = await correctiveSearch(
    context.search,
    args.question,
    analysis,
    initialResults,
    args.project
  );

  if (wasRetried) {
    builder.addWarning(`Initial search had low relevance; retried ${retriesUsed} time(s)`);
  }

  // 5. Store in conversation context
  conversationContext.addTurn(args.project, args.question, analysis.type, analysis.keywords);

  // ... rest of synthesis logic
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Corrective RAG improves results for poor queries
- [ ] Context manager stores and retrieves turns correctly

#### Manual Verification:
- [ ] Follow-up queries benefit from context
- [ ] Retried searches produce better results

---

## Phase 4: AST-Based Code Chunking

### Overview
Replace token-based chunking with AST-aware chunking to preserve code semantics (complete functions, classes, imports).

### Changes Required:

#### 1. Install Tree-sitter Dependencies
**File**: `packages/scraper/package.json`
**Changes**: Add tree-sitter

```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-javascript": "^0.21.0",
    "tree-sitter-rust": "^0.21.0",
    "tree-sitter-go": "^0.21.0"
  }
}
```

#### 2. Create AST Chunker Module
**File**: `packages/scraper/src/ast-chunker.ts` (NEW)

```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';

const MAX_CHUNK_CHARS = 4000;
const MIN_CHUNK_CHARS = 200;

export interface ASTChunk {
  content: string;
  type: 'function' | 'class' | 'import' | 'type' | 'other';
  name?: string;
  startLine: number;
  endLine: number;
}

/**
 * Chunk code using AST to preserve semantic boundaries
 */
export function chunkWithAST(
  code: string,
  language: 'typescript' | 'javascript' | 'rust' | 'go'
): ASTChunk[] {
  const parser = new Parser();

  // Set language
  switch (language) {
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    default:
      // Fallback to line-based for unsupported languages
      return chunkByLines(code);
  }

  const tree = parser.parse(code);
  const chunks: ASTChunk[] = [];

  // Extract top-level declarations
  const cursor = tree.walk();
  const declarations: Parser.SyntaxNode[] = [];

  cursor.gotoFirstChild();
  do {
    const node = cursor.currentNode;
    if (isChunkableNode(node)) {
      declarations.push(node);
    }
  } while (cursor.gotoNextSibling());

  // Group declarations into chunks
  let currentChunk: Parser.SyntaxNode[] = [];
  let currentSize = 0;

  for (const decl of declarations) {
    const declText = decl.text;
    const declSize = declText.length;

    // If this declaration alone is too big, split it
    if (declSize > MAX_CHUNK_CHARS) {
      // Flush current chunk
      if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, code));
        currentChunk = [];
        currentSize = 0;
      }
      // Add large declaration as its own chunk (may need further splitting)
      chunks.push(...splitLargeDeclaration(decl, code));
      continue;
    }

    // If adding this would exceed limit, flush current chunk
    if (currentSize + declSize > MAX_CHUNK_CHARS && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk, code));
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(decl);
    currentSize += declSize;
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk, code));
  }

  return chunks;
}

function isChunkableNode(node: Parser.SyntaxNode): boolean {
  const chunkableTypes = [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'import_statement',
    'export_statement',
    'variable_declaration',
    'method_definition'
  ];
  return chunkableTypes.includes(node.type);
}

function createChunk(nodes: Parser.SyntaxNode[], _fullCode: string): ASTChunk {
  const content = nodes.map(n => n.text).join('\n\n');
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];

  // Determine chunk type
  let type: ASTChunk['type'] = 'other';
  let name: string | undefined;

  if (nodes.length === 1) {
    if (firstNode.type.includes('function')) {
      type = 'function';
      name = findIdentifier(firstNode);
    } else if (firstNode.type.includes('class')) {
      type = 'class';
      name = findIdentifier(firstNode);
    } else if (firstNode.type.includes('import')) {
      type = 'import';
    } else if (firstNode.type.includes('type') || firstNode.type.includes('interface')) {
      type = 'type';
      name = findIdentifier(firstNode);
    }
  }

  return {
    content,
    type,
    name,
    startLine: firstNode.startPosition.row + 1,
    endLine: lastNode.endPosition.row + 1
  };
}

function findIdentifier(node: Parser.SyntaxNode): string | undefined {
  const identifierNode = node.children.find(c => c.type === 'identifier');
  return identifierNode?.text;
}

function splitLargeDeclaration(node: Parser.SyntaxNode, code: string): ASTChunk[] {
  // For very large classes/functions, split by methods/statements
  const text = node.text;

  // Simple fallback: split by double newlines
  const parts = text.split(/\n\n+/);
  const chunks: ASTChunk[] = [];
  let currentPart = '';

  for (const part of parts) {
    if (currentPart.length + part.length > MAX_CHUNK_CHARS && currentPart.length > 0) {
      chunks.push({
        content: currentPart,
        type: 'other',
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      });
      currentPart = '';
    }
    currentPart += (currentPart ? '\n\n' : '') + part;
  }

  if (currentPart.length > 0) {
    chunks.push({
      content: currentPart,
      type: 'other',
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    });
  }

  return chunks;
}

function chunkByLines(code: string): ASTChunk[] {
  // Fallback for unsupported languages
  const lines = code.split('\n');
  const chunks: ASTChunk[] = [];
  let currentChunk = '';
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (currentChunk.length + line.length > MAX_CHUNK_CHARS && currentChunk.length > MIN_CHUNK_CHARS) {
      chunks.push({
        content: currentChunk,
        type: 'other',
        startLine,
        endLine: i
      });
      currentChunk = '';
      startLine = i + 1;
    }

    currentChunk += (currentChunk ? '\n' : '') + line;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk,
      type: 'other',
      startLine,
      endLine: lines.length
    });
  }

  return chunks;
}
```

#### 3. Update Chunker to Use AST
**File**: `packages/scraper/src/chunker.ts`
**Changes**: Integrate AST chunking for code

```typescript
import { chunkWithAST } from './ast-chunker.js';

export function chunkContent(
  content: string,
  contentType: 'prose' | 'code' | 'api-reference',
  metadata: { codeLanguage?: string }
): string[] {
  if (contentType === 'code' && metadata.codeLanguage) {
    const lang = metadata.codeLanguage.toLowerCase();
    if (['typescript', 'javascript', 'ts', 'js'].includes(lang)) {
      const normalizedLang = lang.startsWith('t') ? 'typescript' : 'javascript';
      const astChunks = chunkWithAST(content, normalizedLang);
      return astChunks.map(c => c.content);
    }
  }

  // Fall back to token-based for prose and unsupported languages
  return tokenBasedChunk(content);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] AST chunker preserves complete functions
- [ ] Imports stay with their file context
- [ ] No mid-function breaks

#### Manual Verification:
- [ ] Generated code examples have complete functions
- [ ] Import statements are preserved

---

## Phase 5: Code Verification & Follow-up Intelligence

### Overview
Add syntax verification for generated code and intelligent follow-up suggestions.

### Changes Required:

#### 1. Create Code Verifier Module
**File**: `packages/server/src/utils/code-verifier.ts` (NEW)

```typescript
import { parse } from '@babel/parser';

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Verify TypeScript/JavaScript code for basic syntax
 */
export function verifyCode(code: string, language: string): VerificationResult {
  const result: VerificationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!['typescript', 'javascript', 'ts', 'js'].includes(language.toLowerCase())) {
    // Can't verify other languages
    return result;
  }

  try {
    parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties'
      ]
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      result.valid = false;
      result.errors.push(`Syntax error: ${error.message}`);
    }
  }

  // Check for common issues
  if (!code.includes('import') && (code.includes('async') || code.includes('await'))) {
    result.warnings.push('Code uses async/await but has no imports - may be incomplete');
  }

  if (code.includes('...') && !code.includes('import')) {
    result.warnings.push('Code contains placeholder (...) - may need completion');
  }

  return result;
}

/**
 * Extract code blocks from markdown response
 */
export function extractCodeBlocks(markdown: string): Array<{ code: string; language: string }> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ code: string; language: string }> = [];

  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'unknown',
      code: match[2].trim()
    });
  }

  return blocks;
}

/**
 * Verify all code blocks in a response
 */
export function verifyResponseCode(response: string): {
  allValid: boolean;
  results: Array<{ language: string; valid: boolean; errors: string[] }>;
} {
  const blocks = extractCodeBlocks(response);
  const results = blocks.map(block => {
    const verification = verifyCode(block.code, block.language);
    return {
      language: block.language,
      valid: verification.valid,
      errors: verification.errors
    };
  });

  return {
    allValid: results.every(r => r.valid),
    results
  };
}
```

#### 2. Create Related Query Generator
**File**: `packages/server/src/utils/related-queries.ts` (NEW)

```typescript
import type { QueryAnalysis } from '@mina-docs/shared';
import type { SearchResult } from '@mina-docs/shared';

/**
 * Generate related queries based on current query and results
 */
export function generateRelatedQueries(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  project: string
): string[] {
  const related: string[] = [];

  // Extract key concepts from results
  const resultConcepts = extractConcepts(results);

  // Generate type-specific related queries
  switch (analysis.type) {
    case 'howto':
      related.push(...[
        `Common errors when ${getVerb(query)} in ${project}`,
        `Best practices for ${getVerb(query)} in ${project}`,
        `Testing ${getVerb(query)} in ${project}`
      ]);
      break;

    case 'error':
      related.push(...[
        `How to debug ${analysis.keywords[0] || 'errors'} in ${project}`,
        `${analysis.keywords[0] || 'Error'} troubleshooting guide`,
        `Common causes of ${analysis.keywords[0] || 'errors'}`
      ]);
      break;

    case 'concept':
      related.push(...[
        `How to use ${analysis.keywords[0] || 'this'} in ${project}`,
        `${analysis.keywords[0] || 'Concept'} examples in ${project}`,
        `When to use ${analysis.keywords[0] || 'this'}`
      ]);
      break;

    case 'code_lookup':
      related.push(...[
        `${analysis.keywords[0] || 'API'} complete example`,
        `All methods of ${analysis.keywords[0] || 'class'}`,
        `${analysis.keywords[0] || 'Function'} parameters explained`
      ]);
      break;
  }

  // Add concept-based queries
  for (const concept of resultConcepts.slice(0, 2)) {
    related.push(`How does ${concept} work in ${project}?`);
  }

  // Deduplicate and limit
  return [...new Set(related)].slice(0, 5);
}

function extractConcepts(results: SearchResult[]): string[] {
  const concepts: string[] = [];

  for (const result of results.slice(0, 5)) {
    // Extract from metadata
    if (result.chunk.metadata.className) {
      concepts.push(result.chunk.metadata.className);
    }
    if (result.chunk.metadata.functionName) {
      concepts.push(result.chunk.metadata.functionName);
    }
  }

  return [...new Set(concepts)];
}

function getVerb(query: string): string {
  // Extract the main action verb from a how-to query
  const match = query.match(/(?:how\s+(?:to|do\s+I)|create|build|deploy|implement)\s+(.+)/i);
  if (match) {
    return match[1].split(' ').slice(0, 4).join(' ');
  }
  return query.split(' ').slice(0, 3).join(' ');
}
```

#### 3. Integrate Verification into Working Example Tool
**File**: `packages/server/src/tools/working-example.ts`
**Changes**: Add code verification

```typescript
import { verifyResponseCode } from '../utils/code-verifier.js';
import { generateRelatedQueries } from '../utils/related-queries.js';

export async function getWorkingExample(
  args: GetWorkingExampleArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // ... existing search and synthesis logic ...

  // Verify generated code
  const verification = verifyResponseCode(example);
  if (!verification.allValid) {
    for (const result of verification.results) {
      if (!result.valid) {
        builder.addWarning(`Code syntax issue (${result.language}): ${result.errors[0]}`);
      }
    }
    builder.addSuggestion(
      'ask_docs',
      'Code may have syntax issues - ask for clarification',
      { question: `Fix syntax error in ${args.task} code`, project: args.project }
    );
  }

  // Generate related queries
  const relatedQueries = generateRelatedQueries(args.task, analysis, allResults, args.project);
  relatedQueries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(example);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Code verifier catches syntax errors
- [ ] Related queries are contextually relevant

#### Manual Verification:
- [ ] Agents receive warnings about problematic code
- [ ] Follow-up queries help resolve issues

---

## Testing Strategy

### Unit Tests:
- Response builder creates valid JSON
- Confidence scorer calculates consistent scores
- AST chunker preserves function boundaries
- Code verifier catches syntax errors

### Integration Tests:
1. Full ask_docs flow returns structured response with metadata
2. Low confidence queries trigger corrective RAG
3. Working example includes verified code
4. Follow-up queries are actionable

### Manual Testing Steps:
1. Test with various query types (error, howto, concept, code)
2. Verify confidence correlates with answer quality
3. Test multi-turn conversations maintain context
4. Verify generated code is syntactically valid
5. Check suggestions lead to better outcomes

## Performance Considerations

- **Corrective RAG**: Adds 1-2 extra searches for low-quality results (acceptable)
- **AST Parsing**: ~10-50ms per file (negligible vs network)
- **Code Verification**: ~5-20ms per response (negligible)
- **Context Storage**: In-memory, TTL-based cleanup (minimal overhead)

## Migration Notes

- **Non-breaking**: All changes are additive to existing API
- **Response format**: Text responses now include JSON metadata block
- **Scraper changes**: Re-scrape required after AST chunking is enabled

## References

- Existing research: `thoughts/shared/research/2026-01-08-coding-agent-optimization.md`
- Existing LLM plan: `thoughts/shared/plans/2026-01-08-llm-synthesized-docs-server.md`
- cAST research: https://arxiv.org/html/2506.15655v1
- Anthropic Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
