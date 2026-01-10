/**
 * Confidence Scoring Module
 *
 * Calculates robust confidence scores based on multiple factors:
 * - Retrieval quality (number and relevance of results)
 * - Query coverage (how well results cover the query)
 * - Answer quality (structure, completeness indicators)
 * - Source consistency (agreement between sources)
 */

import type { SearchResult } from './types.js';
import type { QueryAnalysis } from './query-analyzer.js';

/**
 * Individual scoring factors for transparency
 */
export interface ConfidenceFactors {
  /** 0-100: Quality of retrieved documents */
  retrievalScore: number;
  /** 0-100: How well docs cover the query keywords */
  coverageScore: number;
  /** 0-100: Indicators of answer completeness */
  answerQualityScore: number;
  /** 0-100: Consistency between different sources */
  sourceConsistency: number;
}

/**
 * Complete confidence result with explanation
 */
export interface ConfidenceResult {
  /** Overall confidence score 0-100 */
  score: number;
  /** Individual factor breakdown */
  factors: ConfidenceFactors;
  /** Human-readable explanation of the score */
  explanation: string;
  /** Suggested actions if confidence is low */
  suggestedActions: string[];
}

/**
 * Weights for combining confidence factors
 */
const FACTOR_WEIGHTS = {
  retrievalScore: 0.30,
  coverageScore: 0.25,
  answerQualityScore: 0.30,
  sourceConsistency: 0.15
};

/**
 * Calculate comprehensive confidence score
 */
export function calculateConfidenceScore(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  answer: string
): ConfidenceResult {
  const factors: ConfidenceFactors = {
    retrievalScore: calculateRetrievalScore(results),
    coverageScore: calculateCoverageScore(query, analysis, results),
    answerQualityScore: calculateAnswerQuality(answer, analysis),
    sourceConsistency: calculateSourceConsistency(results)
  };

  // Weighted average
  const score = Math.round(
    factors.retrievalScore * FACTOR_WEIGHTS.retrievalScore +
    factors.coverageScore * FACTOR_WEIGHTS.coverageScore +
    factors.answerQualityScore * FACTOR_WEIGHTS.answerQualityScore +
    factors.sourceConsistency * FACTOR_WEIGHTS.sourceConsistency
  );

  return {
    score,
    factors,
    explanation: generateExplanation(score, factors),
    suggestedActions: generateSuggestedActions(score, factors, analysis)
  };
}

/**
 * Calculate retrieval quality score based on:
 * - Number of results
 * - Average relevance scores
 * - Distribution of content types
 */
function calculateRetrievalScore(results: SearchResult[]): number {
  if (results.length === 0) return 0;

  // Factor in number of results (up to 50 points)
  const countScore = Math.min(results.length / 10 * 50, 50);

  // Factor in average relevance score (up to 40 points)
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  const relevanceScore = avgScore * 40;

  // Bonus for diverse content types (up to 10 points)
  const contentTypes = new Set(results.map(r => r.chunk.contentType));
  const diversityBonus = Math.min(contentTypes.size * 3, 10);

  return Math.round(Math.min(100, countScore + relevanceScore + diversityBonus));
}

/**
 * Calculate how well the results cover the query keywords
 */
function calculateCoverageScore(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[]
): number {
  if (results.length === 0) return 0;

  // Extract significant words from query (length > 3)
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w));

  // Combine all result content
  const resultText = results
    .map(r => r.chunk.content.toLowerCase())
    .join(' ');

  // Calculate keyword coverage
  const coveredWords = queryWords.filter(w => resultText.includes(w));
  const keywordCoverage = queryWords.length > 0
    ? (coveredWords.length / queryWords.length) * 100
    : 50;

  // Check if analysis keywords are covered (these are more important)
  const analysisKeywords = analysis.keywords.map(k => k.toLowerCase());
  const coveredAnalysisKeywords = analysisKeywords.filter(k =>
    resultText.includes(k)
  );
  const analysisCoverage = analysisKeywords.length > 0
    ? (coveredAnalysisKeywords.length / analysisKeywords.length) * 100
    : 50;

  // Weight analysis keywords more heavily (they're usually technical terms)
  return Math.round(keywordCoverage * 0.4 + analysisCoverage * 0.6);
}

/**
 * Calculate answer quality score based on structural indicators
 */
function calculateAnswerQuality(answer: string, analysis: QueryAnalysis): number {
  let score = 40; // Base score

  // Length indicates comprehensiveness (up to +15)
  if (answer.length > 200) score += 5;
  if (answer.length > 500) score += 5;
  if (answer.length > 1000) score += 5;

  // Code presence for code-related queries (up to +20)
  const isCodeQuery = analysis.type === 'code_lookup' ||
                      analysis.type === 'howto' ||
                      analysis.type === 'api_reference';
  if (isCodeQuery) {
    if (answer.includes('```')) score += 10;
    if (answer.includes('import ') || answer.includes('from ')) score += 5;
    if (answer.includes('function') || answer.includes('class') || answer.includes('const')) score += 5;
  }

  // Structure indicators (up to +15)
  if (answer.includes('##') || answer.includes('###')) score += 5; // Has sections
  if (answer.includes('[Source')) score += 5; // Has citations
  if (answer.includes('```') && answer.includes('##')) score += 5; // Has both code and sections

  // Completeness indicators (up to +10)
  if (answer.includes('import') && answer.includes('export')) score += 3; // Full module context
  if (answer.includes('Prerequisites') || answer.includes('requirements')) score += 3;
  if (answer.includes('example') || answer.includes('Example')) score += 4;

  return Math.min(100, score);
}

/**
 * Calculate source consistency - do sources agree or contradict?
 */
function calculateSourceConsistency(results: SearchResult[]): number {
  if (results.length < 2) return 70; // Can't measure with one result

  // Check if sources are from similar sections/topics
  const sections = results.map(r => r.chunk.section.toLowerCase());
  const uniqueSections = new Set(sections);

  // More similar sections = higher consistency
  const sectionSimilarity = 1 - (uniqueSections.size / results.length);

  // Check content type consistency
  const contentTypes = results.map(r => r.chunk.contentType);
  const uniqueTypes = new Set(contentTypes);

  // For consistent answers, some diversity in content types is good
  // (e.g., code + prose explaining it)
  const typeBalance = uniqueTypes.size >= 2 && uniqueTypes.size <= 3 ? 1 : 0.8;

  // Check if URLs are from same section of docs
  const urlPaths = results.map(r => {
    try {
      return new URL(r.chunk.url).pathname.split('/').slice(0, 3).join('/');
    } catch {
      return '';
    }
  });
  const uniquePaths = new Set(urlPaths.filter(p => p));
  const pathConsistency = uniquePaths.size > 0
    ? 1 - Math.min(uniquePaths.size / results.length, 0.5)
    : 0.5;

  const score = (sectionSimilarity * 40) + (typeBalance * 30) + (pathConsistency * 30);
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Generate human-readable explanation of the confidence score
 */
function generateExplanation(score: number, factors: ConfidenceFactors): string {
  const issues: string[] = [];

  if (factors.retrievalScore < 40) {
    issues.push('limited relevant documentation found');
  }
  if (factors.coverageScore < 40) {
    issues.push('query keywords not well covered in results');
  }
  if (factors.answerQualityScore < 40) {
    issues.push('answer may be incomplete');
  }
  if (factors.sourceConsistency < 40) {
    issues.push('sources may be inconsistent');
  }

  if (issues.length === 0) {
    if (score >= 80) return 'High confidence - comprehensive retrieval and well-structured answer';
    if (score >= 60) return 'Moderate confidence - reasonable documentation coverage';
    return 'Acceptable confidence - basic information found';
  }

  return `Lower confidence due to: ${issues.join('; ')}`;
}

/**
 * Generate suggested actions when confidence is low
 */
function generateSuggestedActions(
  score: number,
  factors: ConfidenceFactors,
  analysis: QueryAnalysis
): string[] {
  const actions: string[] = [];

  if (score >= 70) return actions; // No suggestions needed for high confidence

  if (factors.retrievalScore < 50) {
    actions.push('Try rephrasing the query with more specific terms');
    actions.push('Search with broader keywords');
  }

  if (factors.coverageScore < 50) {
    if (analysis.keywords.length > 0) {
      actions.push(`Search specifically for "${analysis.keywords[0]}"`);
    }
    actions.push('Try breaking the question into smaller parts');
  }

  if (factors.answerQualityScore < 50 && analysis.type === 'howto') {
    actions.push('Use crypto_get_working_example for complete code');
  }

  if (factors.answerQualityScore < 50 && analysis.type === 'error') {
    actions.push('Provide more context about what you were doing');
    actions.push('Include the code snippet that caused the error');
  }

  return actions.slice(0, 3); // Limit to 3 suggestions
}

/**
 * Quick confidence estimation without full analysis
 * Use for simple checks before full scoring
 */
export function quickConfidenceEstimate(results: SearchResult[]): number {
  if (results.length === 0) return 0;

  const countScore = Math.min(results.length * 8, 50);
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  const scoreBonus = avgScore * 50;

  return Math.round(Math.min(100, countScore + scoreBonus));
}

/**
 * Evaluate retrieval quality for corrective RAG decisions
 */
export function evaluateRetrievalQuality(
  query: string,
  results: SearchResult[]
): 'high' | 'medium' | 'low' {
  if (results.length === 0) return 'low';
  if (results.length < 3) return 'low';

  // Check average score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0.5), 0) / results.length;
  if (avgScore < 0.35) return 'low';

  // Check keyword coverage in top results
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w));

  const topResultText = results
    .slice(0, 3)
    .map(r => r.chunk.content.toLowerCase())
    .join(' ');

  const coveredWords = queryWords.filter(w => topResultText.includes(w));
  const coverage = queryWords.length > 0 ? coveredWords.length / queryWords.length : 0.5;

  if (coverage < 0.3) return 'low';
  if (coverage < 0.6 || avgScore < 0.55) return 'medium';

  return 'high';
}

/**
 * Common stop words to ignore in coverage calculation
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
    'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has',
    'have', 'been', 'were', 'being', 'there', 'their', 'this',
    'that', 'with', 'they', 'from', 'what', 'which', 'when',
    'where', 'will', 'would', 'could', 'should', 'about', 'into',
    'than', 'then', 'them', 'these', 'those', 'some', 'such'
  ]);
  return stopWords.has(word);
}
