/**
 * LLM-based Related Query Generator
 *
 * Uses an LLM to analyze the current answer and generate targeted
 * related queries for specific parts that need more information.
 * Designed to run in parallel during evaluation iterations.
 */

import type { LLMClient } from './llm.js';
import type { QueryAnalysis } from './query-analyzer.js';
import type { SearchResult } from './types.js';
import type { CompressedContext } from './evaluation-types.js';

export interface RelatedQueryContext {
  /** Original user question */
  originalQuestion: string;
  /** Current answer being evaluated */
  currentAnswer: string;
  /** Project context */
  project: string;
  /** Query analysis */
  analysis: QueryAnalysis;
  /** Topics covered in search results */
  topicsCovered: string[];
  /** Identified coverage gaps */
  coverageGaps: string[];
  /** Previous evaluation context (if any) */
  previousContext?: CompressedContext | null;
}

export interface RelatedQueryResult {
  /** Generated related queries */
  queries: string[];
  /** Brief explanation of what each query targets */
  queryReasons: string[];
  /** Topics from the question that were addressed in the answer */
  topicsAddressed: string[];
  /** Topics from the question that were NOT addressed (gaps) */
  topicsMissing: string[];
  /** Time taken in ms */
  durationMs: number;
}

const RELATED_QUERY_SYSTEM_PROMPT = `You are a gap-analysis assistant. Your PRIMARY job is to identify what the user asked about that was NOT adequately addressed in the answer, then generate queries to fill those gaps.

CRITICAL PROCESS - Follow these steps:
1. PARSE THE QUESTION: Break down the original question into distinct topics/aspects the user is asking about
2. CHECK THE ANSWER: For each topic, determine if it was actually addressed in the answer
3. IDENTIFY GAPS: List topics that were NOT addressed or only partially addressed
4. GENERATE QUERIES: Create queries that would retrieve information for the UNADDRESSED topics

PRIORITY ORDER for queries (most important first):
1. Topics from the question that are completely missing from the answer
2. Topics that were mentioned but not explained adequately
3. Prerequisites or concepts needed to understand the answer
4. Only if all above are covered: natural follow-up questions

EXAMPLES:
- Question asks about "deployment AND testing" but answer only covers deployment
  → Generate query about testing
- Question asks "how to X with Y and Z" but answer only explains X with Y
  → Generate query about "how to X with Z"
- Question asks about error handling but answer has no error handling section
  → Generate query about error handling for that specific operation

ANTI-PATTERNS (do NOT do these):
- DO NOT generate generic queries like "best practices for X"
- DO NOT generate queries for topics already well-covered in the answer
- DO NOT generate queries that just rephrase what was already explained

Respond with ONLY a JSON object:
{
  "analysisOfQuestion": "List the distinct topics/aspects the user asked about",
  "topicsAddressed": ["topic1", "topic2"],
  "topicsMissing": ["topic3", "topic4"],
  "queries": ["specific query for missing topic3", "specific query for missing topic4", ...],
  "reasons": ["fills gap: topic3 not addressed", "fills gap: topic4 not explained", ...]
}`;

/**
 * Build the user prompt for related query generation
 */
function buildRelatedQueryPrompt(context: RelatedQueryContext): string {
  const parts: string[] = [];

  // Primary focus: the question and what needs to be analyzed
  parts.push('<task>');
  parts.push('Analyze what the user asked about vs. what the answer actually covers.');
  parts.push('Generate queries to fill in the gaps - topics asked about but not addressed.');
  parts.push('</task>');
  parts.push('');

  parts.push(`<original_question>${context.originalQuestion}</original_question>`);
  parts.push('');
  parts.push(`<project>${context.project}</project>`);
  parts.push('');

  // Include the full answer for analysis (up to 3000 chars for better gap detection)
  parts.push('<current_answer>');
  const truncatedAnswer = context.currentAnswer.length > 3000
    ? context.currentAnswer.slice(0, 3000) + '\n[...truncated...]'
    : context.currentAnswer;
  parts.push(truncatedAnswer);
  parts.push('</current_answer>');
  parts.push('');

  // Provide hints about known gaps
  const knownGaps: string[] = [];

  if (context.coverageGaps.length > 0) {
    knownGaps.push(...context.coverageGaps);
  }

  if (context.previousContext) {
    if (context.previousContext.structured.identifiedGaps.length > 0) {
      knownGaps.push(...context.previousContext.structured.identifiedGaps);
    }
    if (context.previousContext.stillNeeded.length > 0) {
      knownGaps.push(...context.previousContext.stillNeeded);
    }
  }

  if (knownGaps.length > 0) {
    const uniqueGaps = [...new Set(knownGaps)];
    parts.push(`<known_gaps_hint>These terms/topics from the question may not be well covered: ${uniqueGaps.join(', ')}</known_gaps_hint>`);
    parts.push('');
  }

  parts.push('<instructions>');
  parts.push('1. First, identify ALL distinct topics/aspects in the original question');
  parts.push('2. Check which topics are actually addressed in the answer');
  parts.push('3. Generate 3-5 queries targeting the UNADDRESSED or PARTIALLY addressed topics');
  parts.push('4. Each query should be specific enough to retrieve focused documentation');
  parts.push('</instructions>');

  return parts.join('\n');
}

/**
 * Parse the LLM response into related queries with gap analysis
 */
function parseRelatedQueryResponse(response: string): {
  queries: string[];
  reasons: string[];
  topicsAddressed: string[];
  topicsMissing: string[];
} {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    // Also try to find just the JSON object if no code block
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      jsonStr = jsonObjMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q: unknown): q is string => typeof q === 'string' && q.length > 0)
      : [];

    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    const topicsAddressed = Array.isArray(parsed.topicsAddressed)
      ? parsed.topicsAddressed.filter((t: unknown): t is string => typeof t === 'string')
      : [];

    const topicsMissing = Array.isArray(parsed.topicsMissing)
      ? parsed.topicsMissing.filter((t: unknown): t is string => typeof t === 'string')
      : [];

    return {
      queries: queries.slice(0, 5),
      reasons: reasons.slice(0, 5),
      topicsAddressed,
      topicsMissing,
    };
  } catch (error) {
    console.warn('[RelatedQueryGenerator] Failed to parse response:', error);
    return { queries: [], reasons: [], topicsAddressed: [], topicsMissing: [] };
  }
}

/**
 * Generate related queries using an LLM
 *
 * This function analyzes the question vs answer to identify gaps,
 * then generates queries targeting the unaddressed topics.
 * Designed to run in parallel with other evaluation operations.
 */
export async function generateRelatedQueriesWithLLM(
  llmClient: LLMClient,
  context: RelatedQueryContext,
  options: { maxTokens?: number } = {}
): Promise<RelatedQueryResult> {
  const startTime = Date.now();

  const userPrompt = buildRelatedQueryPrompt(context);

  try {
    const response = await llmClient.synthesize(
      RELATED_QUERY_SYSTEM_PROMPT,
      userPrompt,
      {
        maxTokens: options.maxTokens ?? 1000,
        temperature: 0.3 // Lower temp for more consistent gap analysis
      }
    );

    const { queries, reasons, topicsAddressed, topicsMissing } = parseRelatedQueryResponse(response);

    // Log gap analysis for debugging
    if (topicsMissing.length > 0) {
      console.log(`[RelatedQueryGenerator] Gap analysis - Missing topics: ${topicsMissing.join(', ')}`);
    }

    return {
      queries,
      queryReasons: reasons,
      topicsAddressed,
      topicsMissing,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    console.warn('[RelatedQueryGenerator] LLM call failed:', error);
    return {
      queries: [],
      queryReasons: [],
      topicsAddressed: [],
      topicsMissing: [],
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Extract topics from search results for context
 */
export function extractTopicsForRelatedQueries(results: SearchResult[]): string[] {
  const topics = new Set<string>();

  for (const r of results.slice(0, 10)) {
    if (r.chunk.section) {
      topics.add(r.chunk.section);
    }
    if (r.chunk.title) {
      topics.add(r.chunk.title);
    }
    // Extract class/function names from metadata
    const { metadata } = r.chunk;
    if (metadata.className) topics.add(metadata.className);
    if (metadata.functionName) topics.add(metadata.functionName);
  }

  return Array.from(topics).slice(0, 8);
}

/**
 * Extract coverage gaps by comparing query terms to result content
 */
export function extractCoverageGapsForRelatedQueries(
  queryTerms: string[],
  results: SearchResult[]
): string[] {
  if (results.length === 0) {
    return queryTerms;
  }

  const resultContent = results
    .map(r => r.chunk.content.toLowerCase())
    .join(' ');

  return queryTerms.filter(term =>
    !resultContent.includes(term.toLowerCase())
  );
}
