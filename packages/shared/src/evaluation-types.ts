/**
 * Evaluation Loop Types
 *
 * Types for the iterative, self-improving answer evaluation system.
 * The evaluation loop uses multiple LLM calls that evaluate each other,
 * dynamically deciding whether to query more docs, search the web,
 * refine the answer, or return the final result.
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
  /** Confidence assessment at this step */
  confidence: {
    score: number;
    factors: string[];
    gaps: string[];
  };
  /** Compressed context to carry forward */
  compressedContext: CompressedContext;
  /** Time taken for this step in ms */
  durationMs: number;
}

/**
 * Compressed context passed between evaluation steps.
 * Contains both structured data AND LLM-generated summary.
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
    /** Queries already tried against indexed docs */
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
 * Complete trace of the evaluation loop for debugging/observability
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
  /** How the loop terminated */
  finalAction: 'returned' | 'max_iterations' | 'error';
  /** Total evaluation time in ms */
  totalDurationMs: number;
  /** Resources consumed */
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
  /** Maximum iterations before forcing return (default: 3) */
  maxIterations: number;
  /** Minimum confidence to auto-return without evaluation (default: 85) */
  autoReturnConfidenceThreshold: number;
  /** Whether to enable web search via Tavily (default: true if configured) */
  enableWebSearch: boolean;
  /** Maximum web searches per evaluation (default: 2) */
  maxWebSearches: number;
  /** Maximum additional doc queries per evaluation (default: 2) */
  maxDocQueries: number;
  /** Max tokens for evaluator LLM calls (default: 2000) */
  evaluatorMaxTokens: number;
  /** Max tokens for refiner LLM calls (default: 4000) */
  refinerMaxTokens: number;
  /** Max tokens for analyzer LLM calls (default: 1000) */
  analyzerMaxTokens: number;
}

/**
 * Default configuration for the evaluation loop
 */
export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  maxIterations: 3,
  autoReturnConfidenceThreshold: 85,
  enableWebSearch: false, // Disabled - use only indexed documentation
  maxWebSearches: 2,
  maxDocQueries: 2,
  evaluatorMaxTokens: 4000,
  refinerMaxTokens: 8000,
  analyzerMaxTokens: 4000,
};

/**
 * Input to the evaluation loop
 */
export interface EvaluationInput {
  /** The user's question */
  query: string;
  /** Project context (e.g., "mina", "solana") */
  project: string;
  /** Query analysis from query-analyzer */
  analysis: QueryAnalysis;
  /** Initial search results from indexed docs */
  initialResults: SearchResult[];
  /** Initial synthesized answer */
  initialAnswer: string;
  /** Initial confidence result */
  initialConfidence: ConfidenceResult;
  /** Configuration overrides */
  config: Partial<EvaluationConfig>;
}

/**
 * Output from the evaluation loop
 */
export interface EvaluationOutput {
  /** Final answer to return */
  answer: string;
  /** Final confidence score (0-100) */
  confidence: number;
  /** Complete evaluation trace for debugging */
  trace: EvaluationTrace;
  /** All sources used (indexed + web) */
  sources: Array<{
    type: 'indexed' | 'web';
    url: string;
    title: string;
  }>;
  /** Whether web search was used */
  usedWebSearch: boolean;
  /** Warnings or notes about the evaluation */
  warnings: string[];
  /** LLM-generated related queries for follow-up exploration */
  relatedQueries: string[];
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
  /** Context from previous evaluation steps (null on first step) */
  previousContext: CompressedContext | null;
  /** Available actions and remaining budget */
  availableActions: {
    canQueryMoreDocs: boolean;
    canSearchWeb: boolean;
    docQueriesRemaining: number;
    webSearchesRemaining: number;
  };
  /** Summary of indexed doc results */
  indexedResults: {
    count: number;
    topTopics: string[];
    coverageGaps: string[];
  };
  /** Web search results if any have been performed */
  webResults?: Array<{
    query: string;
    results: WebSearchResult[];
  }>;
}

/**
 * Assessment result from the evaluator
 */
export interface EvaluatorAssessment {
  /** Does the answer actually answer the question? */
  answersQuestion: boolean;
  /** How complete is the answer? */
  completeness: 'complete' | 'partial' | 'minimal' | 'wrong';
  /** Specific issues identified */
  specificIssues: string[];
  /** Evaluator's confidence in its own assessment */
  confidenceInAssessment: number;
}

/**
 * Decision made by the evaluator
 */
export interface EvaluatorDecision {
  /** The action to take */
  action: 'RETURN_ANSWER' | 'QUERY_MORE_DOCS' | 'SEARCH_WEB' | 'REFINE_ANSWER';
  /** Why this action was chosen */
  reason: string;
  /** Action-specific details */
  actionDetails: {
    queries?: string[];      // For QUERY_MORE_DOCS and SEARCH_WEB
    focusAreas?: string[];   // For REFINE_ANSWER
  };
}

/**
 * Context compression produced by the evaluator
 */
export interface EvaluatorContextCompression {
  /** Facts established from evaluation */
  establishedFacts: string[];
  /** Gaps identified */
  identifiedGaps: string[];
  /** What's still needed */
  stillNeeded: string[];
  /** Brief summary */
  summary: string;
}

/**
 * Complete response from the evaluator LLM
 */
export interface EvaluatorResponse {
  assessment: EvaluatorAssessment;
  decision: EvaluatorDecision;
  contextCompression: EvaluatorContextCompression;
}
