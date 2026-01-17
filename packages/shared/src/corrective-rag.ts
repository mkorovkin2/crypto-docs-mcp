/**
 * Corrective RAG Module
 *
 * Implements corrective retrieval-augmented generation:
 * - Evaluates initial retrieval quality
 * - Generates alternative queries when results are poor
 * - Retries with expanded/modified queries
 * - Merges results from multiple retrieval attempts
 *
 * Based on the CRAG paper: https://arxiv.org/abs/2401.15884
 */

import type { SearchResult } from './types.js';
import type { QueryAnalysis, OptimizedSearchOptions } from './query-analyzer.js';
import type { HybridSearch } from './search.js';
import { evaluateRetrievalQuality } from './confidence.js';

/**
 * Options for corrective RAG
 */
export interface CorrectiveRAGOptions {
  /** Minimum number of results before considering retry */
  minResultsThreshold: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Whether to merge results from retries with original */
  mergeResults: boolean;
  /** Search options from query analysis - will be used for all searches */
  searchOptions?: Partial<OptimizedSearchOptions>;
}

const DEFAULT_OPTIONS: CorrectiveRAGOptions = {
  minResultsThreshold: 3,
  maxRetries: 2,
  mergeResults: true
};

/**
 * Result of corrective search
 */
export interface CorrectiveSearchResult {
  /** Final results after correction */
  results: SearchResult[];
  /** Whether a retry was performed */
  wasRetried: boolean;
  /** Number of retries used */
  retriesUsed: number;
  /** Quality of the final results */
  quality: 'high' | 'medium' | 'low';
  /** Alternative queries that were tried */
  alternativeQueries: string[];
}

/**
 * Generate alternative queries for retry attempts
 */
export function generateAlternativeQueries(
  originalQuery: string,
  analysis: QueryAnalysis
): string[] {
  const alternatives: string[] = [];

  // 1. Broader query (fewer words)
  const words = originalQuery.split(' ').filter(w => w.length > 2);
  if (words.length > 3) {
    // Take first half of significant words
    alternatives.push(words.slice(0, Math.ceil(words.length / 2)).join(' '));
  }

  // 2. Query type specific expansions
  switch (analysis.type) {
    case 'howto':
      alternatives.push(`${originalQuery} tutorial example guide`);
      alternatives.push(`getting started ${analysis.keywords.slice(0, 2).join(' ')}`);
      break;

    case 'error':
      alternatives.push(`${originalQuery} fix solution troubleshoot`);
      if (analysis.keywords.length > 0) {
        alternatives.push(`${analysis.keywords[0]} error common issues`);
      }
      break;

    case 'code_lookup':
      alternatives.push(`${originalQuery} example implementation`);
      if (analysis.keywords.length > 0) {
        alternatives.push(`${analysis.keywords[0]} API usage`);
      }
      break;

    case 'concept':
      alternatives.push(`${originalQuery} overview introduction`);
      alternatives.push(`what is ${analysis.keywords.slice(0, 2).join(' ')}`);
      break;

    case 'api_reference':
      alternatives.push(`${originalQuery} documentation reference`);
      if (analysis.keywords.length > 0) {
        alternatives.push(`${analysis.keywords[0]} methods functions`);
      }
      break;

    default:
      // Generic expansions
      alternatives.push(`${originalQuery} documentation`);
      if (analysis.keywords.length > 0) {
        alternatives.push(analysis.keywords.slice(0, 3).join(' '));
      }
  }

  // 3. Keyword-only query
  if (analysis.keywords.length > 0) {
    alternatives.push(analysis.keywords.join(' '));
  }

  // Remove duplicates and empty queries
  return [...new Set(alternatives)]
    .filter(q => q.trim().length > 0)
    .filter(q => q.toLowerCase() !== originalQuery.toLowerCase());
}

/**
 * Merge results from multiple searches, removing duplicates
 */
function mergeSearchResults(
  primary: SearchResult[],
  secondary: SearchResult[]
): SearchResult[] {
  const seenIds = new Set(primary.map(r => r.chunk.id));
  const uniqueSecondary = secondary.filter(r => !seenIds.has(r.chunk.id));

  // Combine and sort by score
  return [...primary, ...uniqueSecondary]
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Perform corrective search with automatic retry on poor results
 */
export async function correctiveSearch(
  search: HybridSearch,
  query: string,
  analysis: QueryAnalysis,
  project: string,
  options: Partial<CorrectiveRAGOptions> = {}
): Promise<CorrectiveSearchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const alternativeQueries: string[] = [];
  const searchOpts = opts.searchOptions || {};

  // Initial search with query-aware options
  const initialResults = await search.search(query, {
    limit: searchOpts.limit ?? 15,
    project,
    contentType: searchOpts.contentType,
    rerank: searchOpts.rerank ?? true,
    rerankTopK: searchOpts.rerankTopK ?? 10,
    expandAdjacent: searchOpts.expandAdjacent ?? false,
    adjacentConfig: searchOpts.adjacentConfig,
    queryType: searchOpts.queryType
  });

  // Evaluate initial quality
  const initialQuality = evaluateRetrievalQuality(query, initialResults);

  // If quality is high, return immediately
  if (initialQuality === 'high') {
    return {
      results: initialResults,
      wasRetried: false,
      retriesUsed: 0,
      quality: 'high',
      alternativeQueries: []
    };
  }

  // If quality is medium and we have enough results, might be acceptable
  if (initialQuality === 'medium' && initialResults.length >= opts.minResultsThreshold) {
    return {
      results: initialResults,
      wasRetried: false,
      retriesUsed: 0,
      quality: 'medium',
      alternativeQueries: []
    };
  }

  // Quality is low - try alternative queries
  const alternatives = generateAlternativeQueries(query, analysis);
  let bestResults = initialResults;
  let bestQuality: 'high' | 'medium' | 'low' = initialQuality;
  let retriesUsed = 0;

  for (const altQuery of alternatives.slice(0, opts.maxRetries)) {
    retriesUsed++;
    alternativeQueries.push(altQuery);

    const altResults = await search.search(altQuery, {
      limit: searchOpts.limit ?? 15,
      project,
      contentType: searchOpts.contentType,
      rerank: searchOpts.rerank ?? true,
      rerankTopK: searchOpts.rerankTopK ?? 10,
      expandAdjacent: searchOpts.expandAdjacent ?? false,
      adjacentConfig: searchOpts.adjacentConfig,
      queryType: searchOpts.queryType
    });

    // Evaluate alternative results
    const altQuality = evaluateRetrievalQuality(query, altResults);

    if (opts.mergeResults) {
      // Merge with existing results
      bestResults = mergeSearchResults(bestResults, altResults);
    } else if (altResults.length > bestResults.length ||
               qualityRank(altQuality) > qualityRank(bestQuality)) {
      // Replace if better
      bestResults = altResults;
      bestQuality = altQuality;
    }

    // Re-evaluate merged results
    const mergedQuality = evaluateRetrievalQuality(query, bestResults);

    // Stop if we've reached acceptable quality
    if (mergedQuality === 'high' ||
        (mergedQuality === 'medium' && bestResults.length >= opts.minResultsThreshold * 2)) {
      bestQuality = mergedQuality;
      break;
    }

    // Update best quality
    if (qualityRank(mergedQuality) > qualityRank(bestQuality)) {
      bestQuality = mergedQuality;
    }
  }

  // Limit final results
  const finalResults = bestResults.slice(0, 15);

  return {
    results: finalResults,
    wasRetried: retriesUsed > 0,
    retriesUsed,
    quality: bestQuality,
    alternativeQueries
  };
}

/**
 * Convert quality to numeric rank for comparison
 */
function qualityRank(quality: 'high' | 'medium' | 'low'): number {
  switch (quality) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

/**
 * Check if corrective RAG should be applied
 * Use this for quick decisions before running full corrective search
 */
export function shouldApplyCorrectiveRAG(
  results: SearchResult[],
  minThreshold: number = 3
): boolean {
  if (results.length === 0) return true;
  if (results.length < minThreshold) return true;

  // Check average score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  if (avgScore < 0.4) return true;

  return false;
}
