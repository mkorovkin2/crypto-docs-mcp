/**
 * Evaluation Orchestrator
 *
 * Orchestrates the iterative evaluation loop, executing actions
 * and managing state between evaluation steps. This is the main
 * entry point for the agentic evaluation system.
 */

import type { LLMClient } from './llm.js';
import type { HybridSearch } from './search.js';
import type { WebSearchClient, WebSearchResult } from './web-search.js';
import type { SearchResult } from './types.js';
import {
  DEFAULT_EVALUATION_CONFIG,
  type EvaluationInput,
  type EvaluationOutput,
  type EvaluationTrace,
  type CompressedContext,
  type EvaluatorContext,
  type EvaluationConfig,
} from './evaluation-types.js';
import {
  runEvaluationStep,
  extractTopicsFromResults,
  identifyCoverageGaps,
} from './evaluator.js';
import { refineAnswer, synthesizeFromWebResults } from './answer-refiner.js';
import { extractQueryUnderstanding } from './understanding-extractor.js';
import { calculateConfidenceScore } from './confidence.js';

/**
 * Dependencies for the orchestrator
 */
export interface OrchestratorDependencies {
  llmClient: LLMClient;
  search: HybridSearch;
  webSearch?: WebSearchClient;
}

/**
 * Run the full evaluation loop
 *
 * This is the main entry point. It:
 * 1. Checks if we can quick-return due to high confidence
 * 2. Runs evaluation steps until RETURN_ANSWER or max iterations
 * 3. Executes actions (more doc queries, web search, refinement)
 * 4. Tracks all state and resources used
 */
export async function runEvaluationLoop(
  input: EvaluationInput,
  deps: OrchestratorDependencies
): Promise<EvaluationOutput> {
  const startTime = Date.now();

  // Merge config with defaults
  const config: EvaluationConfig = {
    ...DEFAULT_EVALUATION_CONFIG,
    ...input.config,
  };

  // Initialize trace for observability
  const trace: EvaluationTrace = {
    query: input.query,
    project: input.project,
    analysis: input.analysis,
    steps: [],
    finalAction: 'returned',
    totalDurationMs: 0,
    resourcesUsed: {
      llmCalls: 1, // Count initial synthesis
      docQueries: 1, // Count initial search
      webSearches: 0,
    },
  };

  // Track all sources
  const allSources: EvaluationOutput['sources'] = input.initialResults.map(r => ({
    type: 'indexed' as const,
    url: r.chunk.url,
    title: r.chunk.title,
  }));

  // Warnings to collect
  const warnings: string[] = [];

  // Quick return for very high confidence
  if (input.initialConfidence.score >= config.autoReturnConfidenceThreshold) {
    trace.totalDurationMs = Date.now() - startTime;
    return {
      answer: input.initialAnswer,
      confidence: input.initialConfidence.score,
      trace,
      sources: deduplicateSources(allSources),
      usedWebSearch: false,
      warnings: [],
    };
  }

  // State for the loop
  let currentAnswer = input.initialAnswer;
  let currentResults = [...input.initialResults];
  let allWebResults: WebSearchResult[] = [];
  let previousContext: CompressedContext | null = null;
  let docQueriesRemaining = config.maxDocQueries;
  let webSearchesRemaining = config.maxWebSearches;

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

    // Recalculate confidence if answer was refined
    let currentConfidence = input.initialConfidence;
    if (step > 1) {
      currentConfidence = calculateConfidenceScore(
        input.query,
        input.analysis,
        currentResults,
        currentAnswer
      );
    }

    const evaluatorContext: EvaluatorContext = {
      query: {
        text: input.query,
        type: input.analysis.type,
        intent: understanding.intent,
        technicalTerms: understanding.technicalTerms,
      },
      currentAnswer,
      confidence: currentConfidence,
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
      webResults: allWebResults.length > 0 ? [{
        query: previousContext?.structured.webSearchesDone.slice(-1)[0] || '',
        results: allWebResults.slice(-5), // Last 5 web results
      }] : undefined,
    };

    // Run evaluation step
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
          sources: deduplicateSources(allSources),
          usedWebSearch: allWebResults.length > 0,
          warnings,
        };

      case 'QUERY_MORE_DOCS':
        if (docQueriesRemaining > 0 && stepResult.action.queries.length > 0) {
          const newResults = await executeDocQueries(
            deps.search,
            stepResult.action.queries,
            input.project,
            currentResults
          );

          trace.resourcesUsed.docQueries += stepResult.action.queries.length;
          docQueriesRemaining -= stepResult.action.queries.length;

          // Track new sources
          for (const r of newResults.added) {
            allSources.push({
              type: 'indexed',
              url: r.chunk.url,
              title: r.chunk.title,
            });
          }

          // Update results
          currentResults = newResults.merged;

          // Update context with tried queries
          if (previousContext) {
            previousContext.structured.queriesTried.push(...stepResult.action.queries);
          }
        }
        break;

      case 'SEARCH_WEB':
        if (config.enableWebSearch && deps.webSearch && webSearchesRemaining > 0 && stepResult.action.queries.length > 0) {
          const webResults = await executeWebSearches(
            deps.webSearch,
            stepResult.action.queries,
            input.project
          );

          trace.resourcesUsed.webSearches += webResults.searchesPerformed;
          webSearchesRemaining -= webResults.searchesPerformed;

          // Track web sources
          for (const r of webResults.results) {
            allSources.push({
              type: 'web',
              url: r.url,
              title: r.title,
            });
          }

          allWebResults = [...allWebResults, ...webResults.results];

          // Update context with web searches done
          if (previousContext) {
            previousContext.structured.webSearchesDone.push(...webResults.queriesUsed);
          }

          // If this is the first web search and we have significant results,
          // synthesize an improved answer
          if (allWebResults.length > 0 && currentResults.length < 3) {
            const webSynthesized = await synthesizeFromWebResults(
              deps.llmClient,
              input.query,
              input.project,
              allWebResults,
              previousContext || undefined
            );
            trace.resourcesUsed.llmCalls++;
            currentAnswer = webSynthesized;
          }

          for (const err of webResults.errors) {
            warnings.push(`Web search issue: ${err}`);
          }
        } else if (!deps.webSearch) {
          warnings.push('Web search requested but not configured (no TAVILY_API_KEY)');
        }
        break;

      case 'REFINE_ANSWER':
        if (stepResult.action.focusAreas.length > 0) {
          // Get any new results since initial
          const newDocResults = currentResults.filter(
            r => !input.initialResults.some(ir => ir.chunk.url === r.chunk.url)
          );

          currentAnswer = await refineAnswer(deps.llmClient, {
            originalQuery: input.query,
            currentAnswer,
            focusAreas: stepResult.action.focusAreas,
            additionalContext: {
              newDocResults: newDocResults.length > 0 ? newDocResults : undefined,
              webResults: allWebResults.length > 0 ? allWebResults : undefined,
            },
            previousContext: previousContext!,
            project: input.project,
          });
          trace.resourcesUsed.llmCalls++;
        }
        break;
    }
  }

  // Max iterations reached
  trace.finalAction = 'max_iterations';
  trace.totalDurationMs = Date.now() - startTime;
  warnings.push(`Reached maximum ${config.maxIterations} evaluation iterations`);

  // Return best answer we have
  const finalConfidence = trace.steps.length > 0
    ? trace.steps[trace.steps.length - 1].confidence.score
    : input.initialConfidence.score;

  return {
    answer: currentAnswer,
    confidence: finalConfidence,
    trace,
    sources: deduplicateSources(allSources),
    usedWebSearch: allWebResults.length > 0,
    warnings,
  };
}

/**
 * Execute additional document queries
 */
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

/**
 * Execute web searches
 */
async function executeWebSearches(
  webSearch: WebSearchClient,
  queries: string[],
  project: string
): Promise<{
  results: WebSearchResult[];
  searchesPerformed: number;
  queriesUsed: string[];
  errors: string[];
}> {
  const results: WebSearchResult[] = [];
  const queriesUsed: string[] = [];
  const errors: string[] = [];
  let searchesPerformed = 0;

  for (const query of queries.slice(0, 2)) { // Limit to 2 searches
    try {
      const response = await webSearch.search(query, {
        includeAnswer: false,
        maxResults: 5,
      });

      searchesPerformed++;
      queriesUsed.push(query);
      results.push(...response.results);
    } catch (e) {
      errors.push(`Search for "${query}" failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    results,
    searchesPerformed,
    queriesUsed,
    errors,
  };
}

/**
 * Deduplicate sources by URL
 */
function deduplicateSources(
  sources: EvaluationOutput['sources']
): EvaluationOutput['sources'] {
  const seen = new Set<string>();
  return sources.filter(s => {
    if (seen.has(s.url)) {
      return false;
    }
    seen.add(s.url);
    return true;
  });
}
