import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import {
  analyzeQuery,
  correctiveSearch,
  shouldApplyCorrectiveRAG
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence } from '../utils/response-builder.js';
import { generateSuggestions, generateRelatedQueries } from '../utils/suggestion-generator.js';
import { conversationContext } from '../context/conversation-context.js';
import { logger } from '../utils/logger.js';

export const AskDocsSchema = z.object({
  question: z.string().describe('Your question about the documentation'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type AskDocsArgs = z.infer<typeof AskDocsSchema>;

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // 1. Analyze query to optimize search
  logger.debug('Analyzing query...');
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);
  logger.queryAnalysis(analysis);

  // 2. Enhance query with conversation context (for follow-ups)
  const enhancedQuery = conversationContext.enhanceQuery(args.project, analysis.expandedQuery);
  const isFollowUp = conversationContext.isLikelyFollowUp(args.project, args.question);
  if (isFollowUp) {
    logger.info('Detected follow-up query, using conversation context');
  }
  if (enhancedQuery !== analysis.expandedQuery) {
    logger.debug(`Enhanced query: "${enhancedQuery}"`);
  }

  // 3. Initial retrieval
  logger.info('Performing initial search...');
  const searchStart = Date.now();
  const initialResults = await context.search.search(enhancedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });
  logger.search(enhancedQuery, initialResults.length, Date.now() - searchStart);

  // 4. Apply corrective RAG if initial results are poor
  let results = initialResults;
  let wasRetried = false;
  let alternativeQueries: string[] = [];

  if (shouldApplyCorrectiveRAG(initialResults)) {
    logger.info('Initial results poor, applying corrective RAG...');
    const correctiveStart = Date.now();
    const corrective = await correctiveSearch(
      context.search,
      args.question,
      analysis,
      args.project,
      { maxRetries: 2, mergeResults: true }
    );
    results = corrective.results;
    wasRetried = corrective.wasRetried;
    alternativeQueries = corrective.alternativeQueries;

    logger.correctiveRAG(wasRetried, corrective.retriesUsed, alternativeQueries);
    logger.info(`Corrective RAG completed in ${Date.now() - correctiveStart}ms, now have ${results.length} results`);

    if (wasRetried) {
      builder.addWarning(`Initial search had low relevance; retried with: ${alternativeQueries.join(', ')}`);
    }
  }

  // 5. Store in conversation context for future follow-ups
  conversationContext.addTurn(args.project, args.question, analysis.type, analysis.keywords);
  logger.debug('Stored query in conversation context');

  // 6. Set retrieval quality and sources
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // 7. Handle no results case
  if (results.length === 0) {
    logger.warn('No results found for query');
    builder.setConfidence(0);
    builder.addWarning('No documentation found for this query');
    builder.addSuggestion(
      'search_docs',
      'Try a broader keyword search',
      {
        query: analysis.keywords[0] || args.question.split(' ')[0],
        project: args.project
      }
    );
    builder.addSuggestion(
      'list_projects',
      'Verify the project name is correct',
      {}
    );

    return builder.buildMCPResponse(
      `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
    );
  }

  // 8. Format chunks with rich metadata for better code generation
  logger.debug(`Formatting ${results.length} chunks for LLM context`);
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  // 9. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 10. Synthesize answer with project context
  logger.info('Synthesizing answer with LLM...');
  const llmStart = Date.now();
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system + projectContext,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );
  logger.llmSynthesis(contextChunks.length, answer.length, Date.now() - llmStart);

  // 11. Calculate confidence score
  const confidence = calculateConfidence(args.question, analysis, results, answer);
  builder.setConfidence(confidence);
  logger.confidence(confidence);

  // 12. Add warnings based on confidence and context
  if (confidence < 40) {
    logger.warn(`Low confidence score: ${confidence}`);
    builder.addWarning('Low confidence - results may not fully address your question');
  }
  if (isFollowUp) {
    builder.addWarning('This appears to be a follow-up question - context from previous queries was considered');
  }

  // 13. Generate contextual suggestions
  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));
  logger.debug(`Generated ${suggestions.length} follow-up suggestions`);

  // 14. Generate related queries
  const relatedQueries = generateRelatedQueries(args.question, analysis, results, args.project);
  relatedQueries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(answer);
}
