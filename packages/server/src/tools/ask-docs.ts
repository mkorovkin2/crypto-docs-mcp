import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS, getQueryTypePromptSuffix } from '../prompts/index.js';
import {
  analyzeQuery,
  getOptimizedSearchOptions,
  correctiveSearch,
  shouldApplyCorrectiveRAG,
  extractQueryUnderstanding,
  shouldIncludeSearchGuidance,
  generateSearchGuidance,
  formatSearchGuidanceAsMarkdown,
  calculateConfidenceScore,
  // Agentic evaluation loop imports
  runEvaluationLoop,
  DEFAULT_EVALUATION_CONFIG,
  // Query variation imports
  generateQueryVariations,
  mergeQueryVariationResults,
  // Query decomposition for multi-hop retrieval
  decomposeQuery,
  shouldDecompose,
  // LLM-based related query generation
  generateRelatedQueriesWithLLM,
  extractTopicsForRelatedQueries,
  extractCoverageGapsForRelatedQueries,
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence, getFullConfidenceResult } from '../utils/response-builder.js';
import { generateSuggestions } from '../utils/suggestion-generator.js';
import { conversationContext } from '../context/conversation-context.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export const AskDocsSchema = z.object({
  question: z.string().describe('Your question about the documentation'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)'),
  // Option to enable/disable agentic evaluation (uses config default)
  useAgenticEvaluation: z.boolean().optional().describe('Use iterative evaluation loop for improved answers')
});

type AskDocsArgs = z.infer<typeof AskDocsSchema>;

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // Determine if we should use agentic evaluation
  // Default to config setting, can be overridden per-call
  const useAgentic = args.useAgenticEvaluation ?? config.agenticEvaluation.enabled;

  // 1. Analyze query to optimize search
  logger.debug('Analyzing query...');
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);
  logger.queryAnalysis(analysis);

  // 2. Check for follow-up context
  const isFollowUp = conversationContext.isLikelyFollowUp(args.project, args.question);
  if (isFollowUp) {
    logger.info('Detected follow-up query, using conversation context');
  }

  // 3. Generate query variations using fast LLM
  logger.info('Generating query variations with LLM...');
  const variationStart = Date.now();

  // Use llmEvaluator (fast model) for query variations, fall back to llmClient
  const variationLLM = context.llmEvaluator || context.llmClient;
  const queryVariations = await generateQueryVariations(args.question, variationLLM, {
    count: config.queryVariations.count,
    maxTokens: config.queryVariations.maxTokens,
    project: args.project,
    analysis
  });
  logger.debug(`Generated ${queryVariations.variations.length} query variations in ${queryVariations.durationMs}ms`);
  logger.debug(`Variations: ${JSON.stringify(queryVariations.variations)}`);

  // Add conversation context keywords to each variation if follow-up
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

    if (decomposition.wasDecomposed) {
      wasDecomposed = true;
      logger.debug(`Decomposed into ${decomposition.subQueries.length} sub-queries: ${JSON.stringify(decomposition.subQueries)}`);

      // Combine decomposed queries with variations, removing duplicates
      const allQueries = new Set<string>([
        ...decomposition.subQueries,
        ...enhancedVariations
      ]);
      searchQueries = [...allQueries].slice(0, 8); // Max 8 queries to limit latency
      logger.debug(`Combined ${searchQueries.length} unique search queries`);
    }
  }

  // 4. Search with each query variation in parallel (including decomposed sub-queries)
  logger.info(`Performing parallel searches with ${searchQueries.length} queries${wasDecomposed ? ' (including decomposed sub-queries)' : ''}...`);
  const searchStart = Date.now();

  const searchPromises = searchQueries.map((query: string) =>
    context.search.search(query, {
      limit: analysis.suggestedLimit,
      project: args.project,
      contentType: analysis.suggestedContentType,
      rerank: false, // Don't rerank individual results, we'll rerank merged results
      expandAdjacent: true,
      adjacentConfig: {
        prose: 2,
        code: 3,
        'api-reference': 1
      }
    })
  );

  const resultSets = await Promise.all(searchPromises);
  const totalResultsBeforeMerge = resultSets.reduce((sum: number, r) => sum + r.length, 0);

  // 5. Merge results from all variations using RRF
  const mergedResults = mergeQueryVariationResults(resultSets, analysis.suggestedLimit * 2);
  logger.debug(`Merged ${totalResultsBeforeMerge} results into ${mergedResults.length} unique chunks`);

  // 6. Rerank the merged results
  let initialResults = mergedResults;
  if (context.reranker && mergedResults.length > 0) {
    logger.debug('Reranking merged results...');
    initialResults = await context.reranker.rerank(
      args.question,
      mergedResults,
      { topK: Math.min(analysis.suggestedLimit, 10) }
    );
  }

  logger.search(args.question, initialResults.length, Date.now() - searchStart);

  // 4. Apply corrective RAG if initial results are poor
  let results = initialResults;
  let wasRetried = false;
  let alternativeQueries: string[] = [];

  if (shouldApplyCorrectiveRAG(initialResults)) {
    logger.info('Initial results poor, applying corrective RAG...');
    const correctiveStart = Date.now();
    const searchOptions = getOptimizedSearchOptions(analysis);
    const corrective = await correctiveSearch(
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
          adjacentConfig: searchOptions.adjacentConfig,
          queryType: searchOptions.queryType
        }
      }
    );
    results = corrective.results;
    wasRetried = corrective.wasRetried;
    alternativeQueries = corrective.alternativeQueries;

    logger.correctiveRAG(wasRetried, corrective.retriesUsed, alternativeQueries);
    logger.info(`Corrective RAG completed in ${Date.now() - correctiveStart}ms, now have ${results.length} results`);

    if (wasRetried) {
      const quotedQueries = alternativeQueries.map(q => `"${q}"`).join(', ');
      builder.addWarning(`Initial search had low relevance; retried with alternative queries: ${quotedQueries}`);
    }
  }

  // 5. Store in conversation context for future follow-ups
  conversationContext.addTurn(args.project, args.question, analysis.type, analysis.keywords);
  logger.debug('Stored query in conversation context');

  // 6. Set retrieval quality and sources
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // 7. Handle no results case - still provide search guidance
  if (results.length === 0) {
    return handleNoResults(args, analysis, builder);
  }

  // 8. Format chunks with rich metadata for better code generation
  // For concept queries, use document grouping to show relationships
  logger.debug(`Formatting ${results.length} chunks for LLM context (query type: ${analysis.type})`);
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true,
    queryType: analysis.type
  });

  // 9. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 10. Synthesize initial answer with query-type-specific prompt
  logger.info(`Synthesizing initial answer with LLM (query type: ${analysis.type})...`);
  const llmStart = Date.now();

  // Select prompt based on query type for better answer quality
  let systemPrompt: string;
  let userPrompt: string;

  switch (analysis.type) {
    case 'concept':
      // Use concept-specific prompt with structured explanation format
      systemPrompt = PROMPTS.askDocsConcept.system + projectContext;
      userPrompt = PROMPTS.askDocsConcept.user(args.question, contextChunks, args.project);
      break;
    case 'howto':
      // Use how-to prompt with step-by-step format
      systemPrompt = PROMPTS.askDocsHowTo.system + projectContext;
      userPrompt = PROMPTS.askDocsHowTo.user(args.question, contextChunks, args.project);
      break;
    case 'error':
      // Use error explanation prompt
      systemPrompt = PROMPTS.explainError.system + projectContext;
      userPrompt = PROMPTS.explainError.user(args.question, '', contextChunks, args.project);
      break;
    default:
      // General, code_lookup, api_reference use standard prompt with type-specific suffix
      systemPrompt = PROMPTS.askDocs.system + projectContext + getQueryTypePromptSuffix(analysis.type);
      userPrompt = PROMPTS.askDocs.user(args.question, contextChunks, args.project);
  }

  const initialAnswer = await context.llmClient.synthesize(
    systemPrompt,
    userPrompt,
    { maxTokens: args.maxTokens }
  );
  logger.llmSynthesis(contextChunks.length, initialAnswer.length, Date.now() - llmStart);

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

  // 13. Fallback to original (non-agentic) flow
  return runOriginalFlow(
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

/**
 * Run the agentic evaluation loop for improved answers
 */
async function runAgenticEvaluation(
  args: AskDocsArgs,
  context: ToolContext,
  builder: ResponseBuilder,
  analysis: ReturnType<typeof analyzeQuery>,
  results: Awaited<ReturnType<typeof context.search.search>>,
  initialAnswer: string,
  initialConfidence: ReturnType<typeof getFullConfidenceResult>,
  isFollowUp: boolean
): Promise<{ content: Array<{ type: string; text: string }> }> {
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
        maxIterations: config.agenticEvaluation.maxIterations,
        autoReturnConfidenceThreshold: config.agenticEvaluation.autoReturnConfidenceThreshold,
        enableWebSearch: !!context.webSearch && !!config.tavily.apiKey,
        maxWebSearches: config.agenticEvaluation.maxWebSearches,
        maxDocQueries: config.agenticEvaluation.maxDocQueries,
      },
    },
    {
      llmClient: context.llmClient,
      llmEvaluator: context.llmEvaluator,
      llmRefiner: context.llmRefiner,
      llmAnalyzer: context.llmAnalyzer,
      search: context.search,
      webSearch: context.webSearch,
    }
  );

  // Set response metadata from evaluation output
  builder.setConfidence(evaluationOutput.confidence);

  // Add web sources if any
  for (const source of evaluationOutput.sources.filter((s: { type: string }) => s.type === 'web')) {
    builder.addWebSource(source.url, source.title);
  }

  // Add warnings
  for (const warning of evaluationOutput.warnings) {
    builder.addWarning(warning);
  }

  // Log evaluation stats
  const trace = evaluationOutput.trace;
  logger.info(
    `Agentic evaluation completed: ${trace.steps.length} steps, ` +
    `${trace.resourcesUsed.llmCalls} LLM calls, ` +
    `${trace.resourcesUsed.webSearches} web searches, ` +
    `${trace.totalDurationMs}ms total`
  );

  // Add evaluation trace to metadata if in debug mode
  if (process.env.DEBUG_EVALUATION === 'true') {
    builder.setEvaluationTrace(trace);
  }

  // Note if web search was used
  if (evaluationOutput.usedWebSearch) {
    builder.addWarning('Answer supplemented with web search results');
  }

  // Add follow-up warning if applicable
  if (isFollowUp) {
    builder.addWarning('This appears to be a follow-up question - context from previous queries was considered');
  }

  // Generate suggestions based on final state
  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));

  // Use LLM-generated related queries from evaluation output
  // (generated in parallel during evaluation loop)
  evaluationOutput.relatedQueries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(evaluationOutput.answer);
}

/**
 * Original (non-agentic) flow for backward compatibility
 */
async function runOriginalFlow(
  args: AskDocsArgs,
  context: ToolContext,
  builder: ResponseBuilder,
  analysis: ReturnType<typeof analyzeQuery>,
  results: Awaited<ReturnType<typeof context.search.search>>,
  initialAnswer: string,
  initialConfidence: ReturnType<typeof getFullConfidenceResult>,
  isFollowUp: boolean
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Calculate simple confidence
  const confidence = calculateConfidence(args.question, analysis, results, initialAnswer);
  builder.setConfidence(confidence);
  logger.confidence(confidence);

  // Extract understanding and check if we need search guidance
  const understanding = extractQueryUnderstanding(
    args.question,
    args.project,
    analysis,
    results,
    initialConfidence
  );

  // Determine if answer is insufficient and we should add search guidance
  let finalAnswer = initialAnswer;
  const needsSearchGuidance = shouldIncludeSearchGuidance(results, confidence, understanding);

  if (needsSearchGuidance) {
    logger.info('Answer confidence low - adding search guidance');
    const searchGuidance = generateSearchGuidance(understanding, args.question);
    builder.setSearchGuidance(searchGuidance);

    // Append search guidance to the answer
    const guidanceText = formatSearchGuidanceAsMarkdown(searchGuidance);
    finalAnswer = `${initialAnswer}\n${guidanceText}`;

    builder.addWarning('The answer above may be incomplete based on indexed documentation');
  }

  // Add other warnings based on confidence and context
  if (confidence < 40 && !needsSearchGuidance) {
    logger.warn(`Low confidence score: ${confidence}`);
    builder.addWarning('Low confidence - results may not fully address your question');
  }
  if (isFollowUp) {
    builder.addWarning('This appears to be a follow-up question - context from previous queries was considered');
  }

  // Generate contextual suggestions
  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));
  logger.debug(`Generated ${suggestions.length} follow-up suggestions`);

  // Generate related queries using LLM (use fast evaluator model if available)
  const relatedQueryLLM = context.llmEvaluator || context.llmClient;
  const topicsCovered = extractTopicsForRelatedQueries(results);
  const coverageGaps = extractCoverageGapsForRelatedQueries(analysis.keywords, results);

  const relatedQueriesResult = await generateRelatedQueriesWithLLM(
    relatedQueryLLM,
    {
      originalQuestion: args.question,
      currentAnswer: finalAnswer,
      project: args.project,
      analysis,
      topicsCovered,
      coverageGaps,
      previousContext: null,
    },
    { maxTokens: 1000 }
  );
  logger.debug(`Generated ${relatedQueriesResult.queries.length} related queries with LLM`);
  relatedQueriesResult.queries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(finalAnswer);
}

/**
 * Handle the case when no results are found
 */
function handleNoResults(
  args: AskDocsArgs,
  analysis: ReturnType<typeof analyzeQuery>,
  builder: ResponseBuilder
): { content: Array<{ type: string; text: string }> } {
  logger.warn('No results found for query');
  builder.setConfidence(0);
  builder.addWarning('No documentation found for this query');

  // Generate search guidance even with no results
  const noResultsConfidence = calculateConfidenceScore(args.question, analysis, [], '');
  const understanding = extractQueryUnderstanding(
    args.question,
    args.project,
    analysis,
    [],
    noResultsConfidence
  );
  const searchGuidance = generateSearchGuidance(understanding, args.question);
  builder.setSearchGuidance(searchGuidance);

  const guidanceText = formatSearchGuidanceAsMarkdown(searchGuidance);
  return builder.buildMCPResponse(
    `I couldn't find documentation for your question in ${args.project}.\n${guidanceText}`
  );
}
