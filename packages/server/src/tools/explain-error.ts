import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import {
  analyzeQuery,
  getOptimizedSearchOptions,
  generateRelatedQueriesWithLLM,
  extractTopicsForRelatedQueries,
  extractCoverageGapsForRelatedQueries,
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence } from '../utils/response-builder.js';
import { logger } from '../utils/logger.js';

export const ExplainErrorSchema = z.object({
  error: z.string().describe('The error message or description'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  context: z.string().optional().describe('What you were trying to do when the error occurred'),
  codeSnippet: z.string().optional().describe('The code that caused the error'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type ExplainErrorArgs = z.infer<typeof ExplainErrorSchema>;

export async function explainError(
  args: ExplainErrorArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();
  builder.setQueryType('error');

  // 1. Build comprehensive search query
  logger.debug('Building error search query...');
  const queryParts = [args.error];
  if (args.context) {
    queryParts.push(args.context);
    logger.debug(`Context provided: "${args.context.slice(0, 50)}..."`);
  }
  queryParts.push('error fix troubleshoot solution');

  // Extract potential identifiers from error message
  const identifiers = args.error.match(/`[^`]+`|'[^']+'|"[^"]+"/g);
  if (identifiers) {
    queryParts.push(...identifiers.map(s => s.replace(/[`'"]/g, '')));
    logger.debug(`Extracted identifiers: ${identifiers.join(', ')}`);
  }

  const searchQuery = queryParts.join(' ');

  // Analyze the error query
  const analysis = analyzeQuery(searchQuery);
  logger.queryAnalysis(analysis);

  // Get query-type-optimized search options
  const searchOptions = getOptimizedSearchOptions(analysis);

  // Search for error documentation with optimized options
  logger.info('Searching for error documentation...');
  const searchStart = Date.now();
  const results = await context.search.search(searchOptions.query, {
    limit: searchOptions.limit,
    project: args.project,
    contentType: searchOptions.contentType,
    rerank: searchOptions.rerank,
    rerankTopK: searchOptions.rerankTopK,
    expandAdjacent: searchOptions.expandAdjacent,
    adjacentConfig: searchOptions.adjacentConfig,
    queryType: searchOptions.queryType
  });
  logger.search(searchQuery, results.length, Date.now() - searchStart);

  // Set retrieval quality and sources
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // Handle no results case
  if (results.length === 0) {
    logger.warn('No documentation found for this error');
    builder.setConfidence(10);
    builder.addWarning('No documentation found for this error');
    builder.addSuggestion(
      'search_docs',
      'Try searching for related concepts',
      {
        query: identifiers?.[0]?.replace(/[`'"]/g, '') || args.error.split(' ').slice(0, 3).join(' '),
        project: args.project
      }
    );
    builder.addSuggestion(
      'ask_docs',
      'Ask about the component that caused the error',
      { project: args.project }
    );

    return builder.buildMCPResponse(
      `No documentation found for this error in ${args.project}. The error might be:
1. A runtime environment issue (check your setup)
2. A version mismatch (check package versions)
3. Not documented yet

Try searching the project's GitHub issues or community forums.`
    );
  }

  // 2. Format context with metadata
  logger.debug(`Formatting ${results.length} results for LLM context`);
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  // 3. Build enhanced error context
  let errorContext = args.context || 'Not provided';
  if (args.codeSnippet) {
    errorContext += `\n\nCode that caused the error:\n\`\`\`\n${args.codeSnippet}\n\`\`\``;
    logger.debug('Code snippet included in context');
  }

  // 4. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 5. Synthesize error explanation
  logger.info('Synthesizing error explanation with LLM...');
  const llmStart = Date.now();
  const explanation = await context.llmClient.synthesize(
    PROMPTS.explainError.system + projectContext,
    PROMPTS.explainError.user(args.error, errorContext, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );
  logger.llmSynthesis(contextChunks.length, explanation.length, Date.now() - llmStart);

  // 6. Calculate confidence
  const confidence = calculateConfidence(args.error, analysis, results, explanation);
  builder.setConfidence(confidence);
  logger.confidence(confidence);

  // 7. Add warnings
  if (confidence < 40) {
    logger.warn(`Low confidence for error explanation: ${confidence}`);
    builder.addWarning('Low confidence - error may not be directly documented');
  }
  if (!args.context && !args.codeSnippet) {
    logger.debug('No context or code snippet provided - explanation may be less accurate');
    builder.addWarning('More context would help provide a better explanation');
  }

  // 8. Add suggestions
  builder.addSuggestion(
    'get_working_example',
    'Get a working example to compare against',
    { task: identifiers?.[0]?.replace(/[`'"]/g, '') || 'the feature you are implementing', project: args.project }
  );
  builder.addSuggestion(
    'ask_docs',
    'Learn more about the API that caused the error',
    { project: args.project }
  );

  // 9. Generate related queries using LLM
  const relatedQueryLLM = context.llmEvaluator || context.llmClient;
  const topicsCovered = extractTopicsForRelatedQueries(results);
  const coverageGaps = extractCoverageGapsForRelatedQueries(analysis.keywords, results);

  const relatedQueriesResult = await generateRelatedQueriesWithLLM(
    relatedQueryLLM,
    {
      originalQuestion: `Error: ${args.error}`,
      currentAnswer: explanation,
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

  return builder.buildMCPResponse(explanation);
}
