/**
 * Query Analyzer - Classifies queries to enable specialized handling
 *
 * Detects query intent to:
 * - Route to appropriate search strategies
 * - Expand queries with relevant keywords
 * - Adjust RRF weights for different query types
 */

import type { AdjacentChunkConfig } from './adjacent-chunks.js';

export type QueryType = 'error' | 'howto' | 'concept' | 'code_lookup' | 'api_reference' | 'general';

export interface QueryAnalysis {
  type: QueryType;
  expandedQuery: string;
  suggestedContentType?: 'prose' | 'code' | 'api-reference';
  suggestedLimit: number;
  keywords: string[];
}

/**
 * Error patterns - stack traces, error messages, exception names
 */
const ERROR_PATTERNS = [
  /error/i,
  /failed/i,
  /exception/i,
  /at line \d+/i,
  /cannot\s+(find|read|import|resolve)/i,
  /undefined is not/i,
  /null\s+reference/i,
  /type.*mismatch/i,
  /not\s+a\s+function/i,
  /is not defined/i,
  /stack\s*trace/i,
  /threw/i,
  /crash/i,
  /bug/i,
  /fix/i
];

/**
 * How-to patterns - imperative, tutorial-seeking queries
 */
const HOWTO_PATTERNS = [
  /^how\s+(do|to|can|should)/i,
  /^create/i,
  /^deploy/i,
  /^setup/i,
  /^set\s+up/i,
  /^build/i,
  /^implement/i,
  /^configure/i,
  /^install/i,
  /^integrate/i,
  /^connect/i,
  /^migrate/i,
  /^upgrade/i,
  /^add\s+/i,
  /^make\s+/i,
  /step\s*by\s*step/i,
  /tutorial/i,
  /guide/i,
  /walkthrough/i
];

/**
 * Concept patterns - seeking understanding
 */
const CONCEPT_PATTERNS = [
  /^what\s+(is|are|does)/i,
  /^explain/i,
  /^why\s+(is|does|do|are)/i,
  /^difference\s+between/i,
  /^compare/i,
  /^when\s+should/i,
  /^overview/i,
  /architecture/i,
  /^understand/i,
  /^describe/i,
  /concept/i,
  /^definition\s+of/i
];

/**
 * Code lookup patterns - seeking specific code/API
 */
const CODE_PATTERNS = [
  /`[^`]+`/,                          // Backtick code
  /\w+\([^)]*\)/,                     // Function call syntax
  /\w+\.\w+/,                         // Method access
  /^(show|find|get)\s+(me\s+)?(the\s+)?(code|function|method|class)/i,
  /source\s*code/i,
  /implementation\s+of/i,
  /example\s+of/i,
  /syntax\s+(for|of)/i,
  /import.*from/i,
  /type\s+definition/i,
  /interface\s+for/i
];

/**
 * API reference patterns - seeking API documentation
 */
const API_PATTERNS = [
  /api\s+(for|of|reference)/i,
  /method\s+(signature|parameters)/i,
  /return\s+type/i,
  /parameters?\s+(for|of)/i,
  /options?\s+(for|of)/i,
  /^list\s+(all\s+)?(the\s+)?methods/i,
  /available\s+methods/i,
  /function\s+signature/i,
  /class\s+reference/i
];

/**
 * Keywords to append for different query types
 */
const EXPANSION_KEYWORDS: Record<QueryType, string[]> = {
  error: ['error', 'fix', 'troubleshoot', 'solution', 'resolve', 'debug'],
  howto: ['tutorial', 'guide', 'example', 'how to', 'step by step'],
  concept: ['overview', 'explanation', 'introduction', 'what is'],
  code_lookup: ['example', 'code', 'implementation', 'snippet'],
  api_reference: ['api', 'reference', 'method', 'function', 'signature'],
  general: []
};

/**
 * Classify a query by intent type
 */
export function classifyQuery(query: string): QueryType {
  const normalizedQuery = query.trim();

  // Check patterns in order of specificity
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(normalizedQuery)) return 'error';
  }

  for (const pattern of API_PATTERNS) {
    if (pattern.test(normalizedQuery)) return 'api_reference';
  }

  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(normalizedQuery)) return 'code_lookup';
  }

  for (const pattern of HOWTO_PATTERNS) {
    if (pattern.test(normalizedQuery)) return 'howto';
  }

  for (const pattern of CONCEPT_PATTERNS) {
    if (pattern.test(normalizedQuery)) return 'concept';
  }

  return 'general';
}

/**
 * Expand a query with relevant keywords based on type
 */
export function expandQuery(query: string, type: QueryType): string {
  const keywords = EXPANSION_KEYWORDS[type];
  if (keywords.length === 0) return query;

  // Don't add keywords that are already present
  const lowerQuery = query.toLowerCase();
  const newKeywords = keywords.filter(k => !lowerQuery.includes(k.toLowerCase()));

  if (newKeywords.length === 0) return query;

  // Add up to 2 expansion keywords
  return `${query} ${newKeywords.slice(0, 2).join(' ')}`;
}

/**
 * Get suggested content type for a query type
 */
function getSuggestedContentType(type: QueryType): 'prose' | 'code' | 'api-reference' | undefined {
  switch (type) {
    case 'code_lookup':
      return 'code';
    case 'api_reference':
      return 'api-reference';
    case 'concept':
      return 'prose';
    default:
      return undefined; // Search all types
  }
}

/**
 * Get suggested result limit for a query type
 */
function getSuggestedLimit(type: QueryType): number {
  switch (type) {
    case 'error':
      return 15; // Errors need broad context
    case 'howto':
      return 12; // Tutorials need multiple sources
    case 'code_lookup':
      return 10;
    case 'api_reference':
      return 8;
    case 'concept':
      return 8;
    default:
      return 10;
  }
}

/**
 * Extract key technical terms from a query
 */
export function extractKeywords(query: string): string[] {
  const keywords: string[] = [];

  // Extract backticked terms
  const backtickMatches = query.match(/`([^`]+)`/g);
  if (backtickMatches) {
    keywords.push(...backtickMatches.map(m => m.replace(/`/g, '')));
  }

  // Extract CamelCase or PascalCase terms (likely class/type names)
  const camelCaseMatches = query.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (camelCaseMatches) {
    keywords.push(...camelCaseMatches);
  }

  // Extract function-like patterns
  const functionMatches = query.match(/\b(\w+)\s*\(/g);
  if (functionMatches) {
    keywords.push(...functionMatches.map(m => m.replace(/\s*\(/, '')));
  }

  return [...new Set(keywords)]; // Deduplicate
}

/**
 * Perform full query analysis
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const type = classifyQuery(query);
  const expandedQuery = expandQuery(query, type);
  const keywords = extractKeywords(query);

  return {
    type,
    expandedQuery,
    suggestedContentType: getSuggestedContentType(type),
    suggestedLimit: getSuggestedLimit(type),
    keywords
  };
}

/**
 * Search options optimized for a query type
 */
export interface OptimizedSearchOptions {
  query: string;
  contentType?: 'prose' | 'code' | 'api-reference';
  limit: number;
  rerank: boolean;
  rerankTopK: number;
  expandAdjacent: boolean;
  adjacentConfig?: Partial<AdjacentChunkConfig>;
  queryType: QueryType;
}

/**
 * Get search options optimized for a query type
 */
export function getOptimizedSearchOptions(analysis: QueryAnalysis): OptimizedSearchOptions {
  const type = analysis.type;

  switch (type) {
    case 'concept':
      // Concepts need more context and comprehensive explanations
      return {
        query: analysis.expandedQuery,
        contentType: 'prose',
        limit: 15,
        rerank: true,
        rerankTopK: 12,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 3,
          code: 2,
          'api-reference': 1
        },
        queryType: type
      };

    case 'howto':
      // How-to queries need a mix of prose and code
      return {
        query: analysis.expandedQuery,
        contentType: undefined,
        limit: 12,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 3,
          'api-reference': 1
        },
        queryType: type
      };

    case 'error':
      // Error queries need broad context to find solutions
      return {
        query: analysis.expandedQuery,
        contentType: undefined,
        limit: 15,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 3,
          'api-reference': 2
        },
        queryType: type
      };

    case 'code_lookup':
      // Code lookups are specific - less expansion needed
      return {
        query: analysis.expandedQuery,
        contentType: 'code',
        limit: 10,
        rerank: true,
        rerankTopK: 8,
        expandAdjacent: false,
        queryType: type
      };

    case 'api_reference':
      // API reference lookups are specific
      return {
        query: analysis.expandedQuery,
        contentType: 'api-reference',
        limit: 8,
        rerank: true,
        rerankTopK: 6,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 1,
          code: 1,
          'api-reference': 2
        },
        queryType: type
      };

    case 'general':
    default:
      // General queries use balanced defaults
      return {
        query: analysis.expandedQuery,
        contentType: undefined,
        limit: 10,
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentConfig: {
          prose: 2,
          code: 2,
          'api-reference': 1
        },
        queryType: type
      };
  }
}
