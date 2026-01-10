/**
 * Suggestion Generator - Creates contextual follow-up suggestions for AI agents
 *
 * Analyzes the current query, results, and response to suggest
 * helpful next actions the agent might take.
 */

import type { QueryAnalysis, SearchResult } from '@mina-docs/shared';

export interface Suggestion {
  action: string;
  reason: string;
  params?: Record<string, string>;
}

/**
 * Generate contextual suggestions based on query analysis and results
 */
export function generateSuggestions(
  analysis: QueryAnalysis,
  results: SearchResult[],
  project: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Suggest based on query type
  addQueryTypeSuggestions(suggestions, analysis, project);

  // Suggest based on result quality
  addResultQualitySuggestions(suggestions, results, analysis, project);

  // Suggest based on extracted keywords
  addKeywordSuggestions(suggestions, analysis, project);

  // Deduplicate by action
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = `${s.action}:${s.params?.query || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4); // Limit to 4 suggestions
}

function addQueryTypeSuggestions(
  suggestions: Suggestion[],
  analysis: QueryAnalysis,
  project: string
): void {
  switch (analysis.type) {
    case 'howto':
      suggestions.push({
        action: 'crypto_get_working_example',
        reason: 'Get a complete, runnable code example for this task',
        params: {
          task: extractTask(analysis),
          project
        }
      });
      break;

    case 'error':
      suggestions.push({
        action: 'crypto_explain_error',
        reason: 'Get detailed error analysis with fix instructions',
        params: {
          error: analysis.keywords[0] || '',
          project
        }
      });
      break;

    case 'concept':
      suggestions.push({
        action: 'crypto_search_docs',
        reason: 'Browse related documentation for deeper understanding',
        params: {
          query: `${analysis.keywords[0] || ''} guide overview`,
          project
        }
      });
      break;

    case 'code_lookup':
      suggestions.push({
        action: 'crypto_get_working_example',
        reason: 'See this code in a complete working example',
        params: {
          task: `use ${analysis.keywords[0] || 'this API'}`,
          project
        }
      });
      break;

    case 'api_reference':
      suggestions.push({
        action: 'crypto_search_docs',
        reason: 'Find related API methods and types',
        params: {
          query: `${analysis.keywords[0] || ''} methods API`,
          project,
          contentType: 'api-reference'
        }
      });
      break;
  }
}

function addResultQualitySuggestions(
  suggestions: Suggestion[],
  results: SearchResult[],
  analysis: QueryAnalysis,
  project: string
): void {
  // Low result count - suggest broader search
  if (results.length < 3) {
    suggestions.push({
      action: 'crypto_search_docs',
      reason: 'Limited results found - try a broader search',
      params: {
        query: analysis.keywords.slice(0, 2).join(' ') || analysis.expandedQuery.split(' ').slice(0, 3).join(' '),
        project
      }
    });
  }

  // No code results for code-related query
  if (
    (analysis.type === 'code_lookup' || analysis.type === 'howto') &&
    !results.some(r => r.chunk.contentType === 'code')
  ) {
    suggestions.push({
      action: 'crypto_search_docs',
      reason: 'No code examples found - search specifically for code',
      params: {
        query: analysis.expandedQuery,
        project,
        contentType: 'code'
      }
    });
  }

  // No prose for concept queries
  if (
    analysis.type === 'concept' &&
    !results.some(r => r.chunk.contentType === 'prose')
  ) {
    suggestions.push({
      action: 'crypto_search_docs',
      reason: 'No explanatory content found - search documentation',
      params: {
        query: analysis.expandedQuery,
        project,
        contentType: 'prose'
      }
    });
  }
}

function addKeywordSuggestions(
  suggestions: Suggestion[],
  analysis: QueryAnalysis,
  project: string
): void {
  // If we have class/function names, suggest API lookup
  const technicalKeywords = analysis.keywords.filter(k =>
    /^[A-Z][a-zA-Z]+$/.test(k) || // PascalCase (likely class)
    /^[a-z]+[A-Z][a-zA-Z]*$/.test(k) // camelCase (likely function)
  );

  if (technicalKeywords.length > 0 && analysis.type !== 'api_reference') {
    suggestions.push({
      action: 'crypto_search_docs',
      reason: `Look up API reference for ${technicalKeywords[0]}`,
      params: {
        query: `${technicalKeywords[0]} API reference`,
        project,
        contentType: 'api-reference'
      }
    });
  }
}

function extractTask(analysis: QueryAnalysis): string {
  // Try to extract the main task from keywords or expanded query
  if (analysis.keywords.length > 0) {
    return analysis.keywords.slice(0, 3).join(' ');
  }

  // Fall back to first few words of expanded query
  return analysis.expandedQuery.split(' ').slice(0, 4).join(' ');
}

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

  // Extract concepts from results
  const concepts = extractConceptsFromResults(results);

  // Generate type-specific related queries
  switch (analysis.type) {
    case 'howto':
      related.push(`Common errors when ${getActionPhrase(query)} in ${project}`);
      related.push(`Best practices for ${getActionPhrase(query)}`);
      if (concepts.length > 0) {
        related.push(`How does ${concepts[0]} work?`);
      }
      break;

    case 'error':
      related.push(`How to debug ${analysis.keywords[0] || 'errors'} in ${project}`);
      related.push(`Troubleshooting guide for ${project}`);
      break;

    case 'concept':
      related.push(`How to use ${analysis.keywords[0] || 'this'} in practice`);
      related.push(`${analysis.keywords[0] || 'This'} examples and tutorials`);
      break;

    case 'code_lookup':
      related.push(`Complete example using ${analysis.keywords[0] || 'this API'}`);
      related.push(`All methods of ${analysis.keywords[0] || 'this class'}`);
      break;

    case 'api_reference':
      related.push(`How to use ${analysis.keywords[0] || 'this API'}`);
      related.push(`${analysis.keywords[0] || 'API'} code examples`);
      break;

    default:
      if (concepts.length > 0) {
        related.push(`What is ${concepts[0]} in ${project}?`);
        related.push(`How to use ${concepts[0]}`);
      }
  }

  // Add concept-based queries from results
  for (const concept of concepts.slice(0, 2)) {
    const conceptQuery = `${concept} in ${project}`;
    if (!related.some(q => q.toLowerCase().includes(concept.toLowerCase()))) {
      related.push(conceptQuery);
    }
  }

  // Deduplicate and limit
  return [...new Set(related)].slice(0, 5);
}

function extractConceptsFromResults(results: SearchResult[]): string[] {
  const concepts: string[] = [];

  for (const result of results.slice(0, 5)) {
    const { metadata } = result.chunk;
    if (metadata.className) concepts.push(metadata.className);
    if (metadata.functionName) concepts.push(metadata.functionName);
    if (metadata.typeName) concepts.push(metadata.typeName);
  }

  return [...new Set(concepts)];
}

function getActionPhrase(query: string): string {
  // Extract the main action from a query
  const match = query.match(/(?:how\s+(?:to|do\s+I)|create|build|deploy|implement|configure|setup)\s+(.+)/i);
  if (match) {
    return match[1].split(/[.?!]/).map(s => s.trim()).filter(Boolean)[0] || query;
  }
  return query.split(' ').slice(0, 4).join(' ');
}
