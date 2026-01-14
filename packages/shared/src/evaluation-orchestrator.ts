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
  type EvaluationStepResult,
} from './evaluation-types.js';
import {
  runEvaluationStep,
  extractTopicsFromResults,
  identifyCoverageGaps,
} from './evaluator.js';
import { refineAnswer, synthesizeFromWebResults } from './answer-refiner.js';
import { analyzeWebResults, type WebAnalysisOutput, type AnalyzerContext } from './web-result-analyzer.js';
import { extractQueryUnderstanding } from './understanding-extractor.js';
import { calculateConfidenceScore } from './confidence.js';
import {
  generateRelatedQueriesWithLLM,
  extractTopicsForRelatedQueries,
  extractCoverageGapsForRelatedQueries,
  type RelatedQueryResult,
} from './related-query-generator.js';

// Timestamped logger for evaluation loop
const getTimestamp = () => new Date().toISOString();
const evalLog = {
  info: (msg: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [EvalLoop]${elapsed} ${msg}`);
  },
  debug: (msg: string, startTime?: number) => {
    if (process.env.LOG_LEVEL === 'debug') {
      const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
      console.log(`[${getTimestamp()}] [EvalLoop]${elapsed} ${msg}`);
    }
  },
  action: (action: string, detail: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [EvalLoop]${elapsed} → ${action}: ${detail}`);
  },
  step: (stepName: string, durationMs: number) => {
    console.log(`[${getTimestamp()}] [EvalLoop] ✓ ${stepName} completed in ${durationMs}ms`);
  },
};

/**
 * Dependencies for the orchestrator
 */
export interface OrchestratorDependencies {
  /** Main LLM client for synthesis */
  llmClient: LLMClient;
  /** LLM client for evaluation (defaults to llmClient if not provided) */
  llmEvaluator?: LLMClient;
  /** LLM client for refinement (defaults to llmClient if not provided) */
  llmRefiner?: LLMClient;
  /** LLM client for web result analysis (defaults to llmEvaluator if not provided) */
  llmAnalyzer?: LLMClient;
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
  const loopStartTime = Date.now();

  evalLog.info('=== EVALUATION LOOP STARTED ===');
  evalLog.info(`Query: "${input.query}"`);
  evalLog.info(`Project: ${input.project}`);

  // Merge config with defaults
  const config: EvaluationConfig = {
    ...DEFAULT_EVALUATION_CONFIG,
    ...input.config,
    enableWebSearch: false, // Web search disabled - answers only from indexed docs
  };

  evalLog.info(`Config: maxIterations=${config.maxIterations}, threshold=${config.autoReturnConfidenceThreshold}%, webSearch=${config.enableWebSearch}`);
  evalLog.info(`MaxTokens: evaluator=${config.evaluatorMaxTokens}, refiner=${config.refinerMaxTokens}, analyzer=${config.analyzerMaxTokens}`);

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
    evalLog.info(`HIGH CONFIDENCE (${input.initialConfidence.score}%) >= threshold (${config.autoReturnConfidenceThreshold}%) - returning immediately`, loopStartTime);

    // Still generate related queries even for quick return (use fast LLM)
    const relatedQueryLLM = deps.llmEvaluator || deps.llmClient;
    const topicsCovered = extractTopicsForRelatedQueries(input.initialResults);
    const coverageGaps = extractCoverageGapsForRelatedQueries(
      input.analysis.keywords,
      input.initialResults
    );

    const relatedQueriesResult = await generateRelatedQueriesWithLLM(
      relatedQueryLLM,
      {
        originalQuestion: input.query,
        currentAnswer: input.initialAnswer,
        project: input.project,
        analysis: input.analysis,
        topicsCovered,
        coverageGaps,
        previousContext: null,
      },
      { maxTokens: 1000 }
    );
    evalLog.info(`Generated ${relatedQueriesResult.queries.length} related queries`);

    trace.totalDurationMs = Date.now() - loopStartTime;
    trace.resourcesUsed.llmCalls++; // Count the related query LLM call
    evalLog.step('Quick return (high confidence)', trace.totalDurationMs);
    return {
      answer: input.initialAnswer,
      confidence: input.initialConfidence.score,
      trace,
      sources: deduplicateSources(allSources),
      usedWebSearch: false,
      warnings: [],
      relatedQueries: relatedQueriesResult.queries,
    };
  }

  evalLog.info(`Initial confidence: ${input.initialConfidence.score}% (below threshold ${config.autoReturnConfidenceThreshold}%)`);
  evalLog.info(`Starting evaluation loop (max ${config.maxIterations} iterations)`, loopStartTime);

  // State for the loop
  let currentAnswer = input.initialAnswer;
  let currentResults = [...input.initialResults];
  let allWebResults: WebSearchResult[] = [];
  let previousContext: CompressedContext | null = null;
  let docQueriesRemaining = config.maxDocQueries;
  let webSearchesRemaining = config.maxWebSearches;
  let latestRelatedQueries: string[] = [];

  // Main evaluation loop
  for (let step = 1; step <= config.maxIterations; step++) {
    const stepStartTime = Date.now();
    evalLog.info(`--- STEP ${step}/${config.maxIterations} STARTED ---`, loopStartTime);

    // On final iteration, skip evaluator - just do final synthesis and return
    if (step === config.maxIterations) {
      evalLog.info(`Final iteration - skipping evaluator, doing final synthesis only`, loopStartTime);

      // Get any new results since initial
      const newDocResults = currentResults.filter(
        r => !input.initialResults.some(ir => ir.chunk.url === r.chunk.url)
      );

      // Prepare context for related query generation
      const topicsCovered = extractTopicsForRelatedQueries(currentResults);
      const coverageGaps = extractCoverageGapsForRelatedQueries(
        input.analysis.keywords,
        currentResults
      );

      // If we have new context (docs or web), do a final refinement in parallel with related query gen
      if (newDocResults.length > 0 || allWebResults.length > 0) {
        evalLog.info(`Final synthesis with ${newDocResults.length} new docs, ${allWebResults.length} web results`);
        const refinerLLM = deps.llmRefiner || deps.llmClient;
        const relatedQueryLLM = deps.llmEvaluator || deps.llmClient;

        const [refinedAnswer, relatedQueriesResult] = await Promise.all([
          refineAnswer(refinerLLM, {
            originalQuery: input.query,
            currentAnswer,
            focusAreas: ['completeness', 'accuracy'],
            additionalContext: {
              newDocResults: newDocResults.length > 0 ? newDocResults : undefined,
              webResults: allWebResults.length > 0 ? allWebResults : undefined,
            },
            previousContext: previousContext!,
            project: input.project,
          }),
          generateRelatedQueriesWithLLM(
            relatedQueryLLM,
            {
              originalQuestion: input.query,
              currentAnswer,
              project: input.project,
              analysis: input.analysis,
              topicsCovered,
              coverageGaps,
              previousContext,
            },
            { maxTokens: 1000 }
          ),
        ]);

        currentAnswer = refinedAnswer;
        latestRelatedQueries = relatedQueriesResult.queries;
        trace.resourcesUsed.llmCalls += 2;
        evalLog.info('Final answer synthesized with related queries');
      } else {
        // No new context, just generate related queries
        const relatedQueryLLM = deps.llmEvaluator || deps.llmClient;
        const relatedQueriesResult = await generateRelatedQueriesWithLLM(
          relatedQueryLLM,
          {
            originalQuestion: input.query,
            currentAnswer,
            project: input.project,
            analysis: input.analysis,
            topicsCovered,
            coverageGaps,
            previousContext,
          },
          { maxTokens: 1000 }
        );
        latestRelatedQueries = relatedQueriesResult.queries;
        trace.resourcesUsed.llmCalls++;
        evalLog.info('Generated related queries (no new context to synthesize)');
      }

      // Break out to return at end
      break;
    }

    // Build context for evaluator
    const understandingStart = Date.now();
    const understanding = extractQueryUnderstanding(
      input.query,
      input.project,
      input.analysis,
      currentResults,
      input.initialConfidence
    );
    evalLog.step('Extract query understanding', Date.now() - understandingStart);

    // Recalculate confidence if answer was refined
    let currentConfidence = input.initialConfidence;
    if (step > 1) {
      const confidenceStart = Date.now();
      currentConfidence = calculateConfidenceScore(
        input.query,
        input.analysis,
        currentResults,
        currentAnswer
      );
      evalLog.step('Recalculate confidence', Date.now() - confidenceStart);
      evalLog.info(`Recalculated confidence: ${currentConfidence.score}%`);
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
        canSearchWeb: false, // Web search disabled
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
        results: allWebResults,
      }] : undefined,
    };

    // Run evaluation step AND related query generation in PARALLEL
    evalLog.info(`Running evaluator LLM + related query generation in parallel (maxTokens=${config.evaluatorMaxTokens})...`, loopStartTime);
    const evaluatorStart = Date.now();
    const evaluatorLLM = deps.llmEvaluator || deps.llmClient;

    // Prepare context for related query generation
    const topicsCovered = extractTopicsForRelatedQueries(currentResults);
    const coverageGaps = extractCoverageGapsForRelatedQueries(
      evaluatorContext.query.technicalTerms,
      currentResults
    );

    // Run both LLM calls in parallel
    const [stepResult, relatedQueriesResult]: [EvaluationStepResult, RelatedQueryResult] = await Promise.all([
      runEvaluationStep(evaluatorLLM, evaluatorContext, step, config.evaluatorMaxTokens),
      generateRelatedQueriesWithLLM(
        evaluatorLLM,
        {
          originalQuestion: input.query,
          currentAnswer,
          project: input.project,
          analysis: input.analysis,
          topicsCovered,
          coverageGaps,
          previousContext,
        },
        { maxTokens: 1000 }
      ),
    ]);

    evalLog.step('Evaluator LLM call + related query generation (parallel)', Date.now() - evaluatorStart);
    evalLog.info(`Generated ${relatedQueriesResult.queries.length} related queries in parallel`);

    // Update latest related queries
    latestRelatedQueries = relatedQueriesResult.queries;

    trace.steps.push(stepResult);
    trace.resourcesUsed.llmCalls += 2; // Count both LLM calls

    evalLog.info(`DECISION: ${stepResult.action.type}`, loopStartTime);
    evalLog.info(`  Confidence: ${stepResult.confidence.score}%`);
    evalLog.info(`  Reason: ${stepResult.action.reason || 'No reason provided'}`);
    evalLog.info(`  Doc queries available: ${evaluatorContext.availableActions.canQueryMoreDocs} (${docQueriesRemaining} remaining)`);

    // Update previous context
    previousContext = stepResult.compressedContext;

    // Execute the decided action
    switch (stepResult.action.type) {
      case 'RETURN_ANSWER':
        // Done - return the answer
        evalLog.action('RETURN_ANSWER', `Final confidence: ${stepResult.confidence.score}%`, loopStartTime);
        trace.finalAction = 'returned';
        trace.totalDurationMs = Date.now() - loopStartTime;
        evalLog.info(`=== EVALUATION LOOP COMPLETED === Total time: ${trace.totalDurationMs}ms`);
        return {
          answer: currentAnswer,
          confidence: stepResult.confidence.score,
          trace,
          sources: deduplicateSources(allSources),
          usedWebSearch: allWebResults.length > 0,
          warnings,
          relatedQueries: latestRelatedQueries,
        };

      case 'QUERY_MORE_DOCS':
        if (docQueriesRemaining > 0 && stepResult.action.queries.length > 0) {
          evalLog.action('QUERY_MORE_DOCS', `Queries: ${stepResult.action.queries.join(', ')}`, loopStartTime);
          const docQueryStart = Date.now();
          const newResults = await executeDocQueries(
            deps.search,
            stepResult.action.queries,
            input.project,
            currentResults
          );
          evalLog.step('Execute doc queries', Date.now() - docQueryStart);

          trace.resourcesUsed.docQueries += stepResult.action.queries.length;
          docQueriesRemaining -= stepResult.action.queries.length;

          evalLog.info(`Found ${newResults.added.length} new results (total: ${newResults.merged.length})`, loopStartTime);

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
        // Log when SEARCH_WEB is chosen
        evalLog.info(`SEARCH_WEB action received with ${stepResult.action.queries?.length || 0} queries`, loopStartTime);
        if (config.enableWebSearch && deps.webSearch && webSearchesRemaining > 0 && stepResult.action.queries.length > 0) {
          evalLog.action('SEARCH_WEB', `Queries: ${stepResult.action.queries.join(', ')}`, loopStartTime);

          const webSearchStart = Date.now();
          const webResults = await executeWebSearches(
            deps.webSearch,
            stepResult.action.queries,
            input.project
          );
          evalLog.step('Execute web searches', Date.now() - webSearchStart);

          trace.resourcesUsed.webSearches += webResults.searchesPerformed;
          webSearchesRemaining -= webResults.searchesPerformed;

          evalLog.info(`Web search returned ${webResults.results.length} results`, loopStartTime);

          // Update context with web searches done
          if (previousContext) {
            previousContext.structured.webSearchesDone.push(...webResults.queriesUsed);
          }

          // Analyze web results in parallel to filter for relevance
          if (webResults.results.length > 0) {
            evalLog.info(`Analyzing ${webResults.results.length} web results in parallel (maxTokens=${config.analyzerMaxTokens})...`, loopStartTime);
            const analyzerStart = Date.now();
            const analyzerLLM = deps.llmAnalyzer || deps.llmEvaluator || deps.llmClient;

            // Build full context for the analyzer - NO TRUNCATION
            const analyzerContext: AnalyzerContext = {
              query: input.query,
              intent: evaluatorContext.query.intent,
              technicalTerms: evaluatorContext.query.technicalTerms,
              knowledgeGaps: previousContext?.structured.identifiedGaps || evaluatorContext.indexedResults.coverageGaps,
              establishedFacts: previousContext?.structured.establishedFacts || [],
              stillNeeded: previousContext?.stillNeeded || [],
              currentAnswerSummary: currentAnswer, // Full answer, never truncate
            };

            const analysis = await analyzeWebResults(
              analyzerLLM,
              analyzerContext,
              webResults.results,
              { minRelevanceScore: 50, maxRelevant: 5, maxTokens: config.analyzerMaxTokens }
            );
            evalLog.step(`Parallel web result analysis (${webResults.results.length} results)`, Date.now() - analyzerStart);

            // Track LLM calls for analysis (one per result analyzed)
            trace.resourcesUsed.llmCalls += analysis.stats.totalResults;

            evalLog.info(
              `Analysis complete: ${analysis.stats.relevantCount}/${analysis.stats.totalResults} relevant ` +
              `(avg score: ${analysis.stats.avgRelevanceScore.toFixed(1)}, took ${analysis.stats.analysisTimeMs}ms)`,
              loopStartTime
            );

            // Only track relevant sources
            for (const analyzed of analysis.relevantResults) {
              allSources.push({
                type: 'web',
                url: analyzed.result.url,
                title: analyzed.result.title,
              });
            }

            // Store relevant results for refinement
            const relevantWebResults = analysis.relevantResults.map(a => a.result);
            allWebResults = [...allWebResults, ...relevantWebResults];

            // If we have relevant results and indexed docs are thin,
            // synthesize an improved answer using the pre-analyzed context
            if (analysis.relevantResults.length > 0 && currentResults.length < 3) {
              evalLog.info(`Synthesizing answer from ${analysis.relevantResults.length} analyzed web results (maxTokens=${config.refinerMaxTokens})...`, loopStartTime);
              const synthesisStart = Date.now();
              const refinerLLM = deps.llmRefiner || deps.llmClient;

              // Use the synthesized context from analysis for more focused refinement
              const webSynthesized = await synthesizeFromWebResults(
                refinerLLM,
                input.query,
                input.project,
                relevantWebResults,
                previousContext || undefined,
                analysis.synthesizedContext, // Pass pre-analyzed context
                config.refinerMaxTokens
              );
              evalLog.step('Synthesize from web results', Date.now() - synthesisStart);
              trace.resourcesUsed.llmCalls++;
              currentAnswer = webSynthesized;
            }
          }

          for (const err of webResults.errors) {
            evalLog.info(`Web search warning: ${err}`);
            warnings.push(`Web search issue: ${err}`);
          }
        } else if (!deps.webSearch) {
          evalLog.info('Web search requested but not configured (no TAVILY_API_KEY)');
          warnings.push('Web search requested but not configured (no TAVILY_API_KEY)');
        }
        break;

      case 'REFINE_ANSWER':
        if (stepResult.action.focusAreas.length > 0) {
          evalLog.action('REFINE_ANSWER', `Focus: ${stepResult.action.focusAreas.join(', ')}`);
          // Get any new results since initial
          const newDocResults = currentResults.filter(
            r => !input.initialResults.some(ir => ir.chunk.url === r.chunk.url)
          );

          evalLog.info(`Refining with ${newDocResults.length} new docs, ${allWebResults.length} web results`);

          // Use dedicated refiner LLM if available
          const refinerLLMForAnswer = deps.llmRefiner || deps.llmClient;
          currentAnswer = await refineAnswer(refinerLLMForAnswer, {
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
          evalLog.info('Answer refined');
        }
        break;
    }
  }

  // Max iterations reached
  evalLog.info(`Max iterations (${config.maxIterations}) reached - returning best answer`);
  trace.finalAction = 'max_iterations';
  trace.totalDurationMs = Date.now() - loopStartTime;
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
    relatedQueries: latestRelatedQueries,
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
