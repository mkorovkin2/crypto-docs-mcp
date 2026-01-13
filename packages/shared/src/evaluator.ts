/**
 * Evaluator Module
 *
 * Uses LLM to assess answer quality and decide whether to iterate,
 * search for more information, or return the answer. This is the
 * core decision-making component of the agentic evaluation loop.
 */

import type { LLMClient } from './llm.js';
import type { SearchResult } from './types.js';
import type {
  EvaluatorContext,
  EvaluationAction,
  CompressedContext,
  EvaluationStepResult,
  EvaluatorResponse,
} from './evaluation-types.js';

// Timestamped logger for evaluator
const getTimestamp = () => new Date().toISOString();
const evaluatorLog = {
  info: (msg: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [Evaluator]${elapsed} ${msg}`);
  },
  debug: (msg: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${getTimestamp()}] [Evaluator] ${msg}`);
    }
  },
  step: (stepName: string, durationMs: number) => {
    console.log(`[${getTimestamp()}] [Evaluator] ✓ ${stepName} completed in ${durationMs}ms`);
  },
  warn: (msg: string) => {
    console.log(`[${getTimestamp()}] [Evaluator] ⚠ ${msg}`);
  },
};

/**
 * System prompt for the evaluator LLM
 */
const EVALUATOR_SYSTEM_PROMPT = `You are an expert answer quality evaluator for a blockchain documentation system. Your job is to critically assess if an answer adequately addresses a user's question and decide what action to take.

You will receive:
1. The original question and its analysis (type, intent, key terms)
2. The current answer being evaluated
3. Confidence scores and their factors
4. Context from previous evaluation steps (if any)
5. Available actions you can take and remaining budget

Your task is to:
1. Assess if the answer ACTUALLY answers the question completely and correctly
2. Identify specific gaps, issues, or areas needing improvement
3. Decide the best action to take given the constraints
4. Compress the current context for the next step (if continuing)

CRITICAL EVALUATION RULES:
- Be genuinely critical. Don't accept vague, incomplete, or hedge-filled answers.
- Check if code examples are complete (all imports, types, etc.)
- Verify the answer addresses the SPECIFIC question, not a general topic
- Consider if prerequisites, gotchas, and important notes are included
- For how-to questions, ensure steps are actionable and complete

AVAILABLE ACTIONS:
- RETURN_ANSWER: Answer is sufficient and complete. Return it to the user.
  Use when: confidence score ≥85 AND answer fully addresses the question.
- QUERY_MORE_DOCS: Need to search indexed documentation with different/better queries.
  Use when: answer is thin but docs probably exist, queries tried so far were too narrow/broad.
- SEARCH_WEB: Need external information not in indexed docs.
  Use when: ANY of these conditions are met:
  * Confidence score < 70 (indicates indexed docs are insufficient)
  * Coverage gaps exist (key terms not found in indexed docs)
  * Topic seems newer/advanced and indexed docs clearly don't cover it
  * Need official/authoritative source for verification
  * Answer is incomplete and QUERY_MORE_DOCS has already been tried
  STRONGLY PREFER SEARCH_WEB when confidence is below 70!
- REFINE_ANSWER: Have enough information but answer needs improvement.
  Use when: info is there but answer is poorly structured, incomplete code, missing context.

IMPORTANT: If confidence is below 70 and web search is available, you should almost always choose SEARCH_WEB rather than RETURN_ANSWER or QUERY_MORE_DOCS.

OUTPUT FORMAT - Respond with valid JSON only:
{
  "assessment": {
    "answersQuestion": boolean,
    "completeness": "complete" | "partial" | "minimal" | "wrong",
    "specificIssues": ["issue1", "issue2"],
    "confidenceInAssessment": number (0-100)
  },
  "decision": {
    "action": "RETURN_ANSWER" | "QUERY_MORE_DOCS" | "SEARCH_WEB" | "REFINE_ANSWER",
    "reason": "why this action makes sense given the assessment",
    "actionDetails": {
      // IMPORTANT: Always include queries/focusAreas arrays with 1-2 items for the action!
      // For QUERY_MORE_DOCS: { "queries": ["query1", "query2"] } - REQUIRED
      // For SEARCH_WEB: { "queries": ["search query 1", "search query 2"] } - REQUIRED
      // For REFINE_ANSWER: { "focusAreas": ["area1", "area2"] } - REQUIRED
      // For RETURN_ANSWER: {} - no additional details needed
    }
  },
  "contextCompression": {
    "establishedFacts": ["fact1", "fact2"],
    "identifiedGaps": ["gap1", "gap2"],
    "stillNeeded": ["need1", "need2"],
    "summary": "Brief summary of what we know and what's missing"
  }
}`;

/**
 * Build the user prompt for evaluation
 * Uses XML-style tags for clear section delineation
 */
function buildEvaluatorUserPrompt(context: EvaluatorContext): string {
  const parts: string[] = [];

  // Original question
  parts.push('<original_question>');
  parts.push(`<query>${context.query.text}</query>`);
  parts.push(`<type>${context.query.type}</type>`);
  parts.push(`<intent>${context.query.intent}</intent>`);
  if (context.query.technicalTerms.length > 0) {
    parts.push(`<technical_terms>${context.query.technicalTerms.join(', ')}</technical_terms>`);
  }
  parts.push('</original_question>');
  parts.push('');

  // Current answer - full context, never truncate
  parts.push('<current_answer>');
  parts.push(context.currentAnswer);
  parts.push('</current_answer>');
  parts.push('');

  // Confidence scores
  parts.push('<confidence_assessment>');
  parts.push(`<overall_score>${context.confidence.score}</overall_score>`);
  parts.push('<factors>');
  parts.push(`<retrieval_quality>${context.confidence.factors.retrievalScore}</retrieval_quality>`);
  parts.push(`<query_coverage>${context.confidence.factors.coverageScore}</query_coverage>`);
  parts.push(`<answer_quality>${context.confidence.factors.answerQualityScore}</answer_quality>`);
  parts.push(`<source_consistency>${context.confidence.factors.sourceConsistency}</source_consistency>`);
  parts.push('</factors>');
  parts.push(`<explanation>${context.confidence.explanation}</explanation>`);
  parts.push('</confidence_assessment>');
  parts.push('');

  // Indexed results summary
  parts.push('<indexed_documentation_results>');
  parts.push(`<total_results>${context.indexedResults.count}</total_results>`);
  if (context.indexedResults.topTopics.length > 0) {
    parts.push(`<topics_covered>${context.indexedResults.topTopics.join(', ')}</topics_covered>`);
  }
  if (context.indexedResults.coverageGaps.length > 0) {
    parts.push(`<coverage_gaps>${context.indexedResults.coverageGaps.join(', ')}</coverage_gaps>`);
  } else {
    parts.push('<coverage_gaps>None detected</coverage_gaps>');
  }
  parts.push('</indexed_documentation_results>');
  parts.push('');

  // Previous context if exists
  if (context.previousContext) {
    parts.push('<previous_evaluation_context>');
    parts.push(`<summary>${context.previousContext.summary}</summary>`);
    if (context.previousContext.structured.establishedFacts.length > 0) {
      parts.push(`<established_facts>${context.previousContext.structured.establishedFacts.join('; ')}</established_facts>`);
    }
    if (context.previousContext.structured.queriesTried.length > 0) {
      parts.push(`<doc_queries_tried>${context.previousContext.structured.queriesTried.join(', ')}</doc_queries_tried>`);
    }
    if (context.previousContext.structured.webSearchesDone.length > 0) {
      parts.push(`<web_searches_done>${context.previousContext.structured.webSearchesDone.join(', ')}</web_searches_done>`);
    }
    if (context.previousContext.stillNeeded.length > 0) {
      parts.push(`<still_needed>${context.previousContext.stillNeeded.join(', ')}</still_needed>`);
    }
    parts.push('</previous_evaluation_context>');
    parts.push('');
  }

  // Web search results if any
  if (context.webResults && context.webResults.length > 0) {
    parts.push('<web_search_results>');
    for (const ws of context.webResults) {
      parts.push(`<search query="${ws.query}">`);
      for (const r of ws.results) {
        parts.push(`<result>`);
        parts.push(`<title>${r.title}</title>`);
        parts.push(`<url>${r.url}</url>`);
        parts.push(`<content>${r.content}</content>`);
        parts.push(`</result>`);
      }
      parts.push(`</search>`);
    }
    parts.push('</web_search_results>');
    parts.push('');
  }

  // Available actions
  parts.push('<available_actions>');
  parts.push(`<can_query_more_docs>${context.availableActions.canQueryMoreDocs}</can_query_more_docs>`);
  parts.push(`<doc_queries_remaining>${context.availableActions.docQueriesRemaining}</doc_queries_remaining>`);
  parts.push(`<can_search_web>${context.availableActions.canSearchWeb}</can_search_web>`);
  parts.push(`<web_searches_remaining>${context.availableActions.webSearchesRemaining}</web_searches_remaining>`);
  parts.push('</available_actions>');
  parts.push('');

  parts.push('<instructions>Evaluate the answer critically and decide what action to take. Output valid JSON only.</instructions>');

  return parts.join('\n');
}

/**
 * Parse the evaluator's JSON response, handling various formats
 */
function parseEvaluatorResponse(response: string): EvaluatorResponse {
  const parseStart = Date.now();
  evaluatorLog.debug('Parsing evaluator response...');

  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Check for ```json ... ``` or ``` ... ``` blocks
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    evaluatorLog.debug('Extracted JSON from markdown code block');
    jsonStr = jsonBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields exist
    if (!parsed.assessment || !parsed.decision || !parsed.contextCompression) {
      throw new Error('Missing required fields in evaluator response');
    }

    const result: EvaluatorResponse = {
      assessment: {
        answersQuestion: Boolean(parsed.assessment.answersQuestion),
        completeness: parsed.assessment.completeness || 'partial',
        specificIssues: Array.isArray(parsed.assessment.specificIssues)
          ? parsed.assessment.specificIssues
          : [],
        confidenceInAssessment: Number(parsed.assessment.confidenceInAssessment) || 50,
      },
      decision: {
        action: parsed.decision.action || 'RETURN_ANSWER',
        reason: parsed.decision.reason || 'No reason provided',
        actionDetails: parsed.decision.actionDetails || {},
      },
      contextCompression: {
        establishedFacts: Array.isArray(parsed.contextCompression.establishedFacts)
          ? parsed.contextCompression.establishedFacts
          : [],
        identifiedGaps: Array.isArray(parsed.contextCompression.identifiedGaps)
          ? parsed.contextCompression.identifiedGaps
          : [],
        stillNeeded: Array.isArray(parsed.contextCompression.stillNeeded)
          ? parsed.contextCompression.stillNeeded
          : [],
        summary: parsed.contextCompression.summary || 'No summary provided',
      },
    };

    evaluatorLog.debug(`Parsed response: action=${result.decision.action}, completeness=${result.assessment.completeness}, issues=${result.assessment.specificIssues.length}`);
    evaluatorLog.debug(`Response parsing completed in ${Date.now() - parseStart}ms`);

    return result;
  } catch (e) {
    // If JSON parsing fails, return a safe default
    evaluatorLog.warn(`Failed to parse evaluator response: ${e instanceof Error ? e.message : String(e)}`);
    evaluatorLog.debug(`Raw response (first 500 chars): ${response.slice(0, 500)}`);

    return {
      assessment: {
        answersQuestion: false,
        completeness: 'partial',
        specificIssues: ['Failed to parse evaluation response'],
        confidenceInAssessment: 0,
      },
      decision: {
        action: 'RETURN_ANSWER',
        reason: 'Evaluation parsing failed, returning current answer as fallback',
        actionDetails: {},
      },
      contextCompression: {
        establishedFacts: [],
        identifiedGaps: ['Evaluation failed'],
        stillNeeded: [],
        summary: 'Evaluation could not be completed due to parsing error',
      },
    };
  }
}

/**
 * Convert parsed response to our action type
 */
function responseToAction(parsed: EvaluatorResponse): EvaluationAction {
  evaluatorLog.debug(`Converting response action: ${parsed.decision.action}`);

  switch (parsed.decision.action) {
    case 'RETURN_ANSWER':
      evaluatorLog.debug(`Action: RETURN_ANSWER - ${parsed.decision.reason}`);
      return { type: 'RETURN_ANSWER', reason: parsed.decision.reason };

    case 'QUERY_MORE_DOCS': {
      const queries = Array.isArray(parsed.decision.actionDetails.queries)
        ? parsed.decision.actionDetails.queries
        : [];
      evaluatorLog.debug(`Action: QUERY_MORE_DOCS - ${queries.length} queries: [${queries.join(', ')}]`);
      return {
        type: 'QUERY_MORE_DOCS',
        queries,
        reason: parsed.decision.reason,
      };
    }

    case 'SEARCH_WEB': {
      const queries = Array.isArray(parsed.decision.actionDetails.queries)
        ? parsed.decision.actionDetails.queries
        : [];
      evaluatorLog.debug(`Action: SEARCH_WEB - ${queries.length} queries: [${queries.join(', ')}]`);
      return {
        type: 'SEARCH_WEB',
        queries,
        reason: parsed.decision.reason,
      };
    }

    case 'REFINE_ANSWER': {
      const focusAreas = Array.isArray(parsed.decision.actionDetails.focusAreas)
        ? parsed.decision.actionDetails.focusAreas
        : [];
      evaluatorLog.debug(`Action: REFINE_ANSWER - ${focusAreas.length} focus areas: [${focusAreas.join(', ')}]`);
      return {
        type: 'REFINE_ANSWER',
        focusAreas,
        reason: parsed.decision.reason,
      };
    }

    default:
      evaluatorLog.debug(`Unknown action type: ${parsed.decision.action}, falling back to RETURN_ANSWER`);
      return { type: 'RETURN_ANSWER', reason: 'Unknown action type, returning answer' };
  }
}

/**
 * Run a single evaluation step
 */
export async function runEvaluationStep(
  llmClient: LLMClient,
  context: EvaluatorContext,
  stepNumber: number,
  maxTokens: number = 2000
): Promise<EvaluationStepResult> {
  const startTime = Date.now();

  evaluatorLog.debug(`=== EVALUATION STEP ${stepNumber} ===`);
  evaluatorLog.debug(`Query: "${context.query.text}" (type: ${context.query.type})`);
  evaluatorLog.debug(`Current confidence: ${context.confidence.score}%`);
  evaluatorLog.debug(`Available actions: docs=${context.availableActions.canQueryMoreDocs} (${context.availableActions.docQueriesRemaining} left), web=${context.availableActions.canSearchWeb} (${context.availableActions.webSearchesRemaining} left)`);

  // Build prompt
  const promptBuildStart = Date.now();
  const userPrompt = buildEvaluatorUserPrompt(context);
  evaluatorLog.debug(`Prompt built in ${Date.now() - promptBuildStart}ms (${userPrompt.length} chars)`);

  // Call the LLM for evaluation
  evaluatorLog.debug(`Calling LLM for evaluation (maxTokens=${maxTokens})...`);
  const llmCallStart = Date.now();
  const response = await llmClient.synthesize(
    EVALUATOR_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.2, maxTokens }
  );
  evaluatorLog.debug(`LLM evaluation call completed in ${Date.now() - llmCallStart}ms`);
  evaluatorLog.debug(`Response length: ${response.length} chars`);

  // Parse the response
  const parsed = parseEvaluatorResponse(response);

  // Convert to action
  const action = responseToAction(parsed);

  // Build compressed context for next iteration
  const compressedContext: CompressedContext = {
    structured: {
      establishedFacts: parsed.contextCompression.establishedFacts,
      identifiedGaps: parsed.contextCompression.identifiedGaps,
      sourcesUsed: [], // Will be populated by orchestrator
      queriesTried: context.previousContext?.structured.queriesTried || [],
      webSearchesDone: context.previousContext?.structured.webSearchesDone || [],
    },
    summary: parsed.contextCompression.summary,
    stillNeeded: parsed.contextCompression.stillNeeded,
  };

  const totalDuration = Date.now() - startTime;
  evaluatorLog.debug(`Assessment: answersQuestion=${parsed.assessment.answersQuestion}, completeness=${parsed.assessment.completeness}`);
  evaluatorLog.debug(`Context: ${parsed.contextCompression.establishedFacts.length} facts, ${parsed.contextCompression.identifiedGaps.length} gaps, ${parsed.contextCompression.stillNeeded.length} still needed`);
  evaluatorLog.debug(`Evaluation step ${stepNumber} completed in ${totalDuration}ms`);

  return {
    step: stepNumber,
    action,
    currentAnswer: context.currentAnswer,
    confidence: {
      score: context.confidence.score,
      factors: Object.entries(context.confidence.factors)
        .map(([k, v]) => `${k}: ${v}`),
      gaps: parsed.assessment.specificIssues,
    },
    compressedContext,
    durationMs: totalDuration,
  };
}

/**
 * Extract topics from search results for context summary
 */
export function extractTopicsFromResults(
  results: SearchResult[]
): string[] {
  const topics = new Set<string>();

  for (const r of results.slice(0, 10)) {
    // Add section and title as topics
    if (r.chunk.section) {
      topics.add(r.chunk.section);
    }
    if (r.chunk.title) {
      topics.add(r.chunk.title);
    }
  }

  return Array.from(topics).slice(0, 5);
}

/**
 * Identify coverage gaps by comparing query terms to result content
 */
export function identifyCoverageGaps(
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
