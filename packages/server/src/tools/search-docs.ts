import { z } from 'zod';
import type { ToolContext } from './index.js';
import { analyzeQuery, getOptimizedSearchOptions } from '@mina-docs/shared';
import { ResponseBuilder } from '../utils/response-builder.js';
import { logger } from '../utils/logger.js';

export const SearchDocsSchema = z.object({
  query: z.string().describe('Search query'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional().describe('Filter by content type'),
  limit: z.number().optional().default(10).describe('Maximum results (default: 10)')
});

type SearchDocsArgs = z.infer<typeof SearchDocsSchema>;

export async function searchDocs(
  args: SearchDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // Analyze the query
  logger.debug('Analyzing search query...');
  const analysis = analyzeQuery(args.query);
  builder.setQueryType(analysis.type);
  logger.queryAnalysis(analysis);

  // Get query-type-optimized search options
  const searchOptions = getOptimizedSearchOptions(analysis);

  // Execute search with optimized options (user overrides take precedence)
  logger.info(`Searching for: "${args.query}" in ${args.project}${args.contentType ? ` (${args.contentType})` : ''}`);
  const searchStart = Date.now();
  const results = await context.search.search(searchOptions.query, {
    limit: args.limit ?? searchOptions.limit,
    project: args.project,
    contentType: args.contentType ?? searchOptions.contentType,
    rerank: searchOptions.rerank,
    rerankTopK: searchOptions.rerankTopK,
    expandAdjacent: searchOptions.expandAdjacent,
    adjacentConfig: searchOptions.adjacentConfig,
    queryType: searchOptions.queryType
  });
  logger.search(args.query, results.length, Date.now() - searchStart);

  // Set retrieval quality and sources
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // Handle no results case
  if (results.length === 0) {
    logger.warn('No results found for search query');
    builder.setConfidence(0);
    builder.addWarning('No results found');
    builder.addSuggestion(
      'search_docs',
      'Try with different keywords',
      { query: args.query.split(' ').slice(0, 2).join(' '), project: args.project }
    );
    builder.addSuggestion(
      'list_projects',
      'Verify the project name is correct',
      {}
    );

    return builder.buildMCPResponse(
      `No results found for "${args.query}" in ${args.project}.`
    );
  }

  // Format results
  logger.debug(`Formatting ${results.length} results for output`);
  const formatted = results.map((r, i) => {
    const content = r.chunk.contentType === 'code'
      ? '```' + (r.chunk.metadata.codeLanguage || '') + '\n' + r.chunk.content + '\n```'
      : r.chunk.content;

    // Include metadata for code chunks
    let metadataLine = '';
    if (r.chunk.contentType === 'code') {
      const parts: string[] = [];
      if (r.chunk.metadata.className) parts.push(`Class: ${r.chunk.metadata.className}`);
      if (r.chunk.metadata.functionName) parts.push(`Function: ${r.chunk.metadata.functionName}`);
      if (r.chunk.metadata.methodName) parts.push(`Method: ${r.chunk.metadata.methodName}`);
      if (parts.length > 0) metadataLine = `**Metadata:** ${parts.join(' | ')}\n`;
    }

    return `## ${i + 1}. ${r.chunk.title} - ${r.chunk.section}
**Type:** ${r.chunk.contentType} | **URL:** ${r.chunk.url}
${metadataLine}
${content}`;
  }).join('\n\n---\n\n');

  // Calculate confidence based on result count and scores
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const confidence = Math.min(100, Math.round(40 + results.length * 3 + avgScore * 30));
  builder.setConfidence(confidence);
  logger.confidence(confidence);
  logger.debug(`Average relevance score: ${avgScore.toFixed(3)}`);

  // Add suggestions based on query type
  if (analysis.type === 'howto' || analysis.type === 'code_lookup') {
    builder.addSuggestion(
      'get_working_example',
      'Get a complete runnable example',
      { task: args.query, project: args.project }
    );
  }
  if (analysis.type === 'concept') {
    builder.addSuggestion(
      'ask_docs',
      'Get a synthesized explanation',
      { question: args.query, project: args.project }
    );
  }
  builder.addSuggestion(
    'ask_docs',
    'Get an AI-synthesized answer from these results',
    { question: args.query, project: args.project }
  );

  // Add related queries
  if (analysis.keywords.length > 0) {
    builder.addRelatedQuery(`${analysis.keywords[0]} tutorial ${args.project}`);
    builder.addRelatedQuery(`How to use ${analysis.keywords[0]} in ${args.project}`);
    logger.debug(`Generated related queries for keyword: ${analysis.keywords[0]}`);
  }

  const searchHeader = `# Search Results: "${args.query}" (${args.project})\n\n${formatted}`;
  logger.info(`Returning ${results.length} formatted search results`);

  return builder.buildMCPResponse(searchHeader);
}
