/**
 * Understanding Extractor Module
 *
 * Analyzes a query and search results to extract what was understood
 * vs what's missing. Used to generate helpful fallback guidance when
 * the server can't fully answer a question.
 */

import type { QueryAnalysis } from './query-analyzer.js';
import type { SearchResult } from './types.js';
import type { ConfidenceResult } from './confidence.js';

/**
 * Represents what the system understood from a query
 */
export interface QueryUnderstanding {
  /** The blockchain/project being asked about */
  project: string;
  /** Query type classification */
  queryType: string;
  /** Technical terms extracted from the query */
  technicalTerms: string[];
  /** Concepts that WERE found in documentation (partial matches) */
  coveredConcepts: string[];
  /** Concepts that were NOT found in documentation */
  uncoveredConcepts: string[];
  /** The core intent/action the user is trying to accomplish */
  intent: string;
  /** Confidence that we understood the query correctly (not answer confidence) */
  understandingConfidence: number;
}

/**
 * Extract understanding from query and search results
 */
export function extractQueryUnderstanding(
  query: string,
  project: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  confidenceResult: ConfidenceResult
): QueryUnderstanding {
  // Extract technical terms from query
  const technicalTerms = analysis.keywords;

  // Check which terms appear in results
  const resultContent = results
    .map(r => r.chunk.content.toLowerCase())
    .join(' ');

  const coveredConcepts = technicalTerms.filter(term =>
    resultContent.includes(term.toLowerCase())
  );

  const uncoveredConcepts = technicalTerms.filter(term =>
    !resultContent.includes(term.toLowerCase())
  );

  // Extract intent based on query type
  const intent = extractIntent(query, analysis.type);

  // Calculate understanding confidence (separate from answer confidence)
  const understandingConfidence = calculateUnderstandingConfidence(
    query,
    analysis,
    technicalTerms
  );

  return {
    project,
    queryType: analysis.type,
    technicalTerms,
    coveredConcepts,
    uncoveredConcepts,
    intent,
    understandingConfidence
  };
}

/**
 * Extract the user's intent from the query
 */
function extractIntent(query: string, queryType: string): string {
  switch (queryType) {
    case 'error':
      // Extract what operation was failing
      const errorMatch = query.match(/(?:when|while|trying to|cannot)\s+(\w+(?:\s+\w+){0,3})/i);
      return errorMatch
        ? `fix error when ${errorMatch[1]}`
        : 'fix error or exception';

    case 'howto':
      // Extract the action they want to accomplish
      const howtoMatch = query.match(/(?:how to|how do i|how can i)\s+(.+?)(?:\?|$)/i);
      return howtoMatch
        ? howtoMatch[1].trim()
        : query.replace(/^how\s+(do|to|can|should)\s+(i\s+)?/i, '').split('?')[0].trim();

    case 'concept':
      // Extract what they want to understand
      const conceptMatch = query.match(/(?:what is|explain|what does)\s+(.+?)(?:\?|$)/i);
      return conceptMatch
        ? `understand ${conceptMatch[1].trim()}`
        : 'understand concept';

    case 'code_lookup':
      // Extract what code/API they're looking for
      return `find code for ${query.replace(/`/g, '').slice(0, 50)}`;

    case 'api_reference':
      return `find API documentation for ${query.slice(0, 50)}`;

    default:
      return query.slice(0, 100);
  }
}

/**
 * Calculate how well we understood the query itself (not the answer)
 */
function calculateUnderstandingConfidence(
  query: string,
  analysis: QueryAnalysis,
  technicalTerms: string[]
): number {
  let confidence = 50; // Base confidence

  // Bonus if we identified query type (not 'general')
  if (analysis.type !== 'general') {
    confidence += 20;
  }

  // Bonus if we extracted technical terms
  if (technicalTerms.length > 0) {
    confidence += Math.min(technicalTerms.length * 10, 30);
  }

  // Penalty for very short queries
  if (query.split(' ').length < 3) {
    confidence -= 15;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Determine if the answer quality is low enough to warrant search guidance
 * This should be called AFTER we've tried to answer, not before
 */
export function shouldIncludeSearchGuidance(
  results: SearchResult[],
  answerConfidence: number,
  understanding: QueryUnderstanding
): boolean {
  // No results at all - definitely include guidance
  if (results.length === 0) {
    return true;
  }

  // Very low confidence with results - results are probably irrelevant
  if (answerConfidence < 30) {
    return true;
  }

  // Low confidence and most concepts weren't covered
  const coverageRatio = understanding.coveredConcepts.length /
    Math.max(understanding.technicalTerms.length, 1);

  if (answerConfidence < 45 && coverageRatio < 0.5 && understanding.technicalTerms.length > 0) {
    return true;
  }

  // Moderate confidence but poor coverage of key terms
  if (answerConfidence < 55 && coverageRatio < 0.3 && understanding.technicalTerms.length >= 2) {
    return true;
  }

  return false;
}
