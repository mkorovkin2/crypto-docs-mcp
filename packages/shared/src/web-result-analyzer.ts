/**
 * Web Result Analyzer
 *
 * Analyzes web search results in parallel using a fast LLM to:
 * 1. Determine relevance to the query
 * 2. Extract key information
 * 3. Filter out irrelevant results
 *
 * This runs before the refinement step to give the refiner
 * cleaner, more focused context.
 */

import type { LLMClient } from './llm.js';
import type { WebSearchResult } from './web-search.js';
import type { CompressedContext } from './evaluation-types.js';

/**
 * Context for the analyzer to understand what we're looking for
 */
export interface AnalyzerContext {
  /** Original user query */
  query: string;
  /** What the query is trying to accomplish */
  intent: string;
  /** Technical terms we're looking for */
  technicalTerms: string[];
  /** Knowledge gaps identified - what we're trying to fill */
  knowledgeGaps: string[];
  /** Facts already established - don't need to re-extract these */
  establishedFacts: string[];
  /** What the current answer is missing */
  stillNeeded: string[];
  /** Current answer summary (so analyzer knows what we have) */
  currentAnswerSummary?: string;
}

/**
 * Analysis result for a single web search result
 */
export interface WebResultAnalysis {
  /** Original web result */
  result: WebSearchResult;
  /** Relevance score 0-100 */
  relevanceScore: number;
  /** Is this result relevant enough to include? */
  isRelevant: boolean;
  /** Key facts extracted from this result (NEW facts only) */
  extractedFacts: string[];
  /** Which knowledge gaps this result fills */
  fillsGaps: string[];
  /** How this result helps answer the query */
  contribution: string;
  /** Any caveats or concerns about this source */
  caveats: string[];
}

/**
 * Output from analyzing all web results
 */
export interface WebAnalysisOutput {
  /** All analyzed results (including irrelevant ones for debugging) */
  allResults: WebResultAnalysis[];
  /** Only the relevant results, sorted by relevance */
  relevantResults: WebResultAnalysis[];
  /** Synthesized context from all relevant results */
  synthesizedContext: string;
  /** Analysis stats */
  stats: {
    totalResults: number;
    relevantCount: number;
    avgRelevanceScore: number;
    analysisTimeMs: number;
  };
}

const ANALYZER_SYSTEM_PROMPT = `You are a relevance analyzer for web search results. Your job is to determine if a search result fills specific knowledge gaps and extract NEW, USEFUL information.

You will receive:
1. The original query and intent
2. Knowledge gaps we're trying to fill
3. Facts we already have (don't re-extract these)
4. What's still needed in the answer
5. The web result to analyze

Your task: Determine if this result provides NEW information that fills the identified gaps.

Output valid JSON:
{
  "relevanceScore": number (0-100),
  "isRelevant": boolean (true if score >= 50),
  "extractedFacts": ["fact1", "fact2", ...] (NEW facts not in establishedFacts),
  "fillsGaps": ["gap1", "gap2", ...] (which knowledge gaps this result addresses),
  "contribution": "Specifically how this result helps fill the missing information",
  "caveats": ["caveat1", ...] (concerns about reliability, recency, etc.)
}

RELEVANCE SCORING - Score based on how well it fills IDENTIFIED GAPS:
- 90-100: Directly fills critical knowledge gaps with authoritative info
- 70-89: Fills some gaps, provides useful new information
- 50-69: Partially relevant, fills minor gaps or provides context
- 30-49: Marginally relevant, mostly redundant with what we have
- 0-29: Doesn't fill any identified gaps

CRITICAL:
- Score LOW if the result repeats information we already have
- Score HIGH if it provides the SPECIFIC missing information
- Only extract facts that are NEW (not in establishedFacts)
- Focus on whether this fills the "stillNeeded" items`;

/**
 * Build user prompt for analyzing a single result with full context
 * Uses XML-style tags for clear section delineation
 */
function buildAnalyzerPrompt(context: AnalyzerContext, result: WebSearchResult): string {
  const parts: string[] = [];

  // Query and intent
  parts.push(`<query>`);
  parts.push(`<question>${context.query}</question>`);
  parts.push(`<intent>${context.intent}</intent>`);
  if (context.technicalTerms.length > 0) {
    parts.push(`<technical_terms>${context.technicalTerms.join(', ')}</technical_terms>`);
  }
  parts.push(`</query>`);
  parts.push('');

  // Knowledge gaps - what we're looking for
  parts.push(`<knowledge_gaps>`);
  if (context.knowledgeGaps.length > 0) {
    for (const gap of context.knowledgeGaps) {
      parts.push(`<gap>${gap}</gap>`);
    }
  } else {
    parts.push('<gap>General information about the topic</gap>');
  }
  parts.push(`</knowledge_gaps>`);
  parts.push('');

  // What's still needed
  parts.push(`<still_needed>`);
  if (context.stillNeeded.length > 0) {
    for (const need of context.stillNeeded) {
      parts.push(`<need>${need}</need>`);
    }
  } else {
    parts.push('<need>Comprehensive information on the topic</need>');
  }
  parts.push(`</still_needed>`);
  parts.push('');

  // Established facts - don't re-extract
  if (context.establishedFacts.length > 0) {
    parts.push(`<established_facts>`);
    for (const fact of context.establishedFacts) {
      parts.push(`<fact>${fact}</fact>`);
    }
    parts.push(`</established_facts>`);
    parts.push('');
  }

  // Current answer - full context, never truncate
  if (context.currentAnswerSummary) {
    parts.push(`<current_answer>`);
    parts.push(context.currentAnswerSummary);
    parts.push(`</current_answer>`);
    parts.push('');
  }

  // The result to analyze - full content
  parts.push(`<web_result_to_analyze>`);
  parts.push(`<title>${result.title}</title>`);
  parts.push(`<url>${result.url}</url>`);
  parts.push(`<content>${result.content}</content>`);
  parts.push(`</web_result_to_analyze>`);
  parts.push('');

  parts.push('<instructions>Analyze: Does this result fill any of the knowledge gaps? Extract only NEW facts. Output valid JSON.</instructions>');

  return parts.join('\n');
}

/**
 * Parse analyzer response with fallback handling
 */
function parseAnalyzerResponse(response: string, result: WebSearchResult): WebResultAnalysis {
  try {
    // Extract JSON from potential markdown code blocks
    let jsonStr = response.trim();
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      result,
      relevanceScore: Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 0)),
      isRelevant: Boolean(parsed.isRelevant),
      extractedFacts: Array.isArray(parsed.extractedFacts) ? parsed.extractedFacts : [],
      fillsGaps: Array.isArray(parsed.fillsGaps) ? parsed.fillsGaps : [],
      contribution: String(parsed.contribution || ''),
      caveats: Array.isArray(parsed.caveats) ? parsed.caveats : [],
    };
  } catch {
    // Fallback for parse failures - assume moderately relevant
    return {
      result,
      relevanceScore: 40,
      isRelevant: false,
      extractedFacts: [],
      fillsGaps: [],
      contribution: 'Analysis failed - treating as low relevance',
      caveats: ['Failed to analyze this result'],
    };
  }
}

/**
 * Analyze a single web result with full context
 */
async function analyzeResult(
  llmClient: LLMClient,
  context: AnalyzerContext,
  result: WebSearchResult,
  maxTokens: number = 1000
): Promise<WebResultAnalysis> {
  const response = await llmClient.synthesize(
    ANALYZER_SYSTEM_PROMPT,
    buildAnalyzerPrompt(context, result),
    { maxTokens, temperature: 0.1 }
  );

  return parseAnalyzerResponse(response, result);
}

// Timestamped logger for web analyzer
const getTimestamp = () => new Date().toISOString();
const analyzerLog = {
  info: (msg: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [WebAnalyzer]${elapsed} ${msg}`);
  },
  step: (stepName: string, durationMs: number) => {
    console.log(`[${getTimestamp()}] [WebAnalyzer] ✓ ${stepName} completed in ${durationMs}ms`);
  },
};

/**
 * Analyze web search results in parallel with full context
 *
 * @param llmClient - LLM client configured for fast analysis (e.g., gpt-4.1-mini, claude-haiku)
 * @param context - Full context including query, knowledge gaps, established facts
 * @param results - Web search results to analyze
 * @param options - Analysis options
 */
export async function analyzeWebResults(
  llmClient: LLMClient,
  context: AnalyzerContext,
  results: WebSearchResult[],
  options: {
    /** Minimum relevance score to include (default: 50) */
    minRelevanceScore?: number;
    /** Maximum results to analyze (default: 10) */
    maxToAnalyze?: number;
    /** Maximum relevant results to return (default: 5) */
    maxRelevant?: number;
    /** Max tokens per analyzer call (default: 1000) */
    maxTokens?: number;
  } = {}
): Promise<WebAnalysisOutput> {
  const analysisStartTime = Date.now();
  const minScore = options.minRelevanceScore ?? 50;
  const maxAnalyze = options.maxToAnalyze ?? 10;
  const maxRelevant = options.maxRelevant ?? 5;
  const maxTokens = options.maxTokens ?? 1000;

  analyzerLog.info(`=== WEB RESULT ANALYSIS STARTED ===`);
  analyzerLog.info(`Query: "${context.query}"`);
  analyzerLog.info(`Config: minScore=${minScore}, maxAnalyze=${maxAnalyze}, maxRelevant=${maxRelevant}, maxTokens=${maxTokens}`);

  // Limit results to analyze
  const toAnalyze = results.slice(0, maxAnalyze);

  if (toAnalyze.length === 0) {
    analyzerLog.info('No results to analyze');
    return {
      allResults: [],
      relevantResults: [],
      synthesizedContext: '',
      stats: {
        totalResults: 0,
        relevantCount: 0,
        avgRelevanceScore: 0,
        analysisTimeMs: Date.now() - analysisStartTime,
      },
    };
  }

  // Log what we're looking for
  analyzerLog.info(`Analyzing ${toAnalyze.length} results in parallel...`, analysisStartTime);
  analyzerLog.info(`Knowledge gaps to fill: ${context.knowledgeGaps.join(', ') || 'general info'}`);
  analyzerLog.info(`Still needed: ${context.stillNeeded.join(', ') || 'comprehensive info'}`);

  // Analyze all results in parallel
  const parallelStart = Date.now();
  const analysisPromises = toAnalyze.map((result, idx) => {
    analyzerLog.info(`  [${idx + 1}/${toAnalyze.length}] Starting analysis of: ${result.title.slice(0, 50)}...`);
    return analyzeResult(llmClient, context, result, maxTokens).catch(err => {
      analyzerLog.info(`  [${idx + 1}/${toAnalyze.length}] FAILED: ${err.message}`);
      return {
        result,
        relevanceScore: 0,
        isRelevant: false,
        extractedFacts: [],
        fillsGaps: [],
        contribution: '',
        caveats: [`Analysis error: ${err.message}`],
      } as WebResultAnalysis;
    });
  });

  const allResults = await Promise.all(analysisPromises);
  analyzerLog.step(`Parallel analysis of ${toAnalyze.length} results`, Date.now() - parallelStart);

  // Log individual results
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    analyzerLog.info(`  [${i + 1}/${allResults.length}] Score: ${r.relevanceScore}, Relevant: ${r.isRelevant}, Fills: ${r.fillsGaps.join(', ') || 'none'}`);
  }

  // Filter and sort by relevance
  const relevantResults = allResults
    .filter(r => r.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxRelevant);

  // Synthesize context from relevant results
  const synthesizedContext = synthesizeContext(context.query, relevantResults);

  // Calculate stats
  const totalScore = allResults.reduce((sum, r) => sum + r.relevanceScore, 0);
  const avgScore = allResults.length > 0 ? totalScore / allResults.length : 0;

  // Log which gaps were filled
  const filledGaps = new Set(relevantResults.flatMap(r => r.fillsGaps));
  analyzerLog.info(`=== ANALYSIS COMPLETE ===`, analysisStartTime);
  analyzerLog.info(`Results: ${relevantResults.length}/${allResults.length} relevant (avg score: ${avgScore.toFixed(1)})`);
  if (filledGaps.size > 0) {
    analyzerLog.info(`Gaps filled: ${Array.from(filledGaps).join(', ')}`);
  } else {
    analyzerLog.info(`Gaps filled: NONE`);
  }
  analyzerLog.info(`Total analysis time: ${Date.now() - analysisStartTime}ms`);

  return {
    allResults,
    relevantResults,
    synthesizedContext,
    stats: {
      totalResults: allResults.length,
      relevantCount: relevantResults.length,
      avgRelevanceScore: avgScore,
      analysisTimeMs: Date.now() - analysisStartTime,
    },
  };
}

/**
 * Synthesize a combined context from relevant results
 */
function synthesizeContext(query: string, relevantResults: WebResultAnalysis[]): string {
  if (relevantResults.length === 0) {
    return '';
  }

  const parts: string[] = [];

  parts.push(`## Web Search Analysis for: "${query}"\n`);
  parts.push(`Found ${relevantResults.length} relevant sources:\n`);

  for (const analysis of relevantResults) {
    parts.push(`### ${analysis.result.title}`);
    parts.push(`Source: ${analysis.result.url}`);
    parts.push(`Relevance: ${analysis.relevanceScore}/100`);

    if (analysis.fillsGaps.length > 0) {
      parts.push(`Fills gaps: ${analysis.fillsGaps.join(', ')}`);
    }

    if (analysis.extractedFacts.length > 0) {
      parts.push('New facts extracted:');
      for (const fact of analysis.extractedFacts) {
        parts.push(`- ${fact}`);
      }
    }

    if (analysis.contribution) {
      parts.push(`Contribution: ${analysis.contribution}`);
    }

    if (analysis.caveats.length > 0) {
      parts.push(`Caveats: ${analysis.caveats.join('; ')}`);
    }

    parts.push('');
  }

  return parts.join('\n');
}
