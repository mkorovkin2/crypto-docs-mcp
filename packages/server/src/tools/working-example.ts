import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import {
  analyzeQuery,
  getOptimizedSearchOptions,
  shouldApplyCorrectiveRAG,
  correctiveSearch,
  generateRelatedQueriesWithLLM,
  extractTopicsForRelatedQueries,
  extractCoverageGapsForRelatedQueries,
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence } from '../utils/response-builder.js';
import { conversationContext } from '../context/conversation-context.js';
import { getVerificationSummary } from '../utils/code-verifier.js';
import { logger } from '../utils/logger.js';

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
  const builder = new ResponseBuilder();

  // Analyze the task as a howto query
  logger.debug('Analyzing task query...');
  const analysis = analyzeQuery(`how to ${args.task}`);
  builder.setQueryType('howto');
  logger.queryAnalysis(analysis);

  // 1. Search for code examples and related prose in parallel (with adjacent chunk expansion)
  logger.info('Searching for code, prose, and API reference in parallel with adjacent expansion...');
  const searchStart = Date.now();
  const [codeResults, proseResults, apiResults] = await Promise.all([
    context.search.search(args.task, {
      limit: 15,
      project: args.project,
      contentType: 'code',
      rerank: true,
      rerankTopK: 8,
      expandAdjacent: true,
      adjacentConfig: { code: 4 }  // More context for code examples
    }),
    context.search.search(`${args.task} tutorial guide how to`, {
      limit: 10,
      project: args.project,
      contentType: 'prose',
      rerank: true,
      rerankTopK: 5,
      expandAdjacent: true,
      adjacentConfig: { prose: 2 }
    }),
    // Also search API reference for complete type info
    context.search.search(`${args.task} interface type`, {
      limit: 5,
      project: args.project,
      contentType: 'api-reference',
      rerank: true,
      rerankTopK: 3,
      expandAdjacent: true,
      adjacentConfig: { 'api-reference': 1 }
    })
  ]);
  logger.info(`Parallel search completed in ${Date.now() - searchStart}ms`);
  logger.debug(`Results: ${codeResults.length} code, ${proseResults.length} prose, ${apiResults.length} API`);

  let allResults = [...codeResults, ...proseResults, ...apiResults];

  // Apply corrective RAG if code results are poor (most important for working examples)
  if (shouldApplyCorrectiveRAG(codeResults, 2)) {
    logger.info('Code results insufficient, applying corrective RAG...');
    const correctiveStart = Date.now();
    const searchOptions = getOptimizedSearchOptions(analysis);
    const corrective = await correctiveSearch(
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
          adjacentConfig: { code: 4, prose: 2, 'api-reference': 1 },
          queryType: searchOptions.queryType
        }
      }
    );

    if (corrective.wasRetried && corrective.results.length > codeResults.length) {
      // Merge corrective code results
      const existingIds = new Set(allResults.map(r => r.chunk.id));
      const newResults = corrective.results.filter(r => !existingIds.has(r.chunk.id));
      allResults = [...allResults, ...newResults];
      logger.correctiveRAG(true, corrective.retriesUsed, corrective.alternativeQueries);
      logger.info(`Corrective RAG added ${newResults.length} new results in ${Date.now() - correctiveStart}ms`);
      builder.addWarning('Applied corrective retrieval to find more code examples');
    }
  }

  // Store in conversation context
  conversationContext.addTurn(args.project, args.task, 'howto', analysis.keywords);

  // Set retrieval quality and sources
  builder.setRetrievalQuality(allResults);
  builder.setSources(allResults);

  // Handle no results case
  if (allResults.length === 0) {
    logger.warn('No results found for working example');
    builder.setConfidence(0);
    builder.addWarning('No code examples found for this task');
    builder.addSuggestion(
      'search_docs',
      'Try searching with different keywords',
      { query: args.task, project: args.project }
    );
    builder.addSuggestion(
      'ask_docs',
      'Ask a general question about this topic',
      { question: `How do I ${args.task}?`, project: args.project }
    );

    return builder.buildMCPResponse(
      `No code examples found for "${args.task}" in ${args.project}. Try different keywords or check the project name.`
    );
  }

  // 2. Format context with rich metadata for better code generation
  logger.debug(`Formatting ${allResults.length} results for LLM context`);
  const contextChunks = formatSearchResultsAsContext(allResults, {
    includeMetadata: true,
    labelType: true
  });

  // 3. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 4. Synthesize complete example with project context
  logger.info('Synthesizing complete code example with LLM...');
  const llmStart = Date.now();
  const example = await context.llmClient.synthesize(
    PROMPTS.workingExample.system + projectContext,
    PROMPTS.workingExample.user(args.task, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );
  logger.llmSynthesis(contextChunks.length, example.length, Date.now() - llmStart);

  // 5. Calculate confidence
  const confidence = calculateConfidence(args.task, analysis, allResults, example);
  builder.setConfidence(confidence);
  logger.confidence(confidence);

  // 6. Verify generated code for common issues
  logger.debug('Verifying generated code...');
  const verification = getVerificationSummary(example);
  if (verification.hasIssues) {
    logger.warn(`Code verification warning: ${verification.message}`);
    builder.addWarning(verification.message);
  } else {
    logger.debug('Code verification passed');
  }

  // 7. Add warnings based on result composition
  if (codeResults.length === 0) {
    logger.warn('No direct code examples found in docs');
    builder.addWarning('No direct code examples found - example synthesized from documentation');
  }
  if (apiResults.length === 0) {
    builder.addWarning('No API reference found - type signatures may be incomplete');
  }
  if (confidence < 50) {
    builder.addWarning('Moderate confidence - verify code before using');
  }

  // 8. Add contextual suggestions
  builder.addSuggestion(
    'explain_error',
    'Get help if you encounter errors running this code',
    { project: args.project }
  );
  builder.addSuggestion(
    'ask_docs',
    'Ask follow-up questions about this implementation',
    { question: `What are best practices for ${args.task}?`, project: args.project }
  );

  // 9. Generate related queries using LLM
  const relatedQueryLLM = context.llmEvaluator || context.llmClient;
  const topicsCovered = extractTopicsForRelatedQueries(allResults);
  const coverageGaps = extractCoverageGapsForRelatedQueries(analysis.keywords, allResults);

  const relatedQueriesResult = await generateRelatedQueriesWithLLM(
    relatedQueryLLM,
    {
      originalQuestion: `How to ${args.task}`,
      currentAnswer: example,
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

  return builder.buildMCPResponse(example);
}
