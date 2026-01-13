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
- QUERY_MORE_DOCS: Need to search indexed documentation with different/better queries.
  Use when: answer is thin but docs probably exist, queries tried so far were too narrow/broad.
- SEARCH_WEB: Need external information not in indexed docs.
  Use when: topic seems newer/advanced, indexed docs clearly don't cover it, need official source.
- REFINE_ANSWER: Have enough information but answer needs improvement.
  Use when: info is there but answer is poorly structured, incomplete code, missing context.

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
      // For QUERY_MORE_DOCS: { "queries": ["query1", "query2"] }
      // For SEARCH_WEB: { "queries": ["search1", "search2"] }
      // For REFINE_ANSWER: { "focusAreas": ["area1", "area2"] }
      // For RETURN_ANSWER: {}
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
 */
function buildEvaluatorUserPrompt(context: EvaluatorContext): string {
  const parts: string[] = [];

  // Original question
  parts.push('## Original Question');
  parts.push(`Query: "${context.query.text}"`);
  parts.push(`Type: ${context.query.type}`);
  parts.push(`Intent: ${context.query.intent}`);
  if (context.query.technicalTerms.length > 0) {
    parts.push(`Key Terms: ${context.query.technicalTerms.join(', ')}`);
  }
  parts.push('');

  // Current answer
  parts.push('## Current Answer Being Evaluated');
  parts.push('```');
  // Truncate very long answers to stay within context
  const truncatedAnswer = context.currentAnswer.length > 4000
    ? context.currentAnswer.slice(0, 4000) + '\n... [truncated for evaluation]'
    : context.currentAnswer;
  parts.push(truncatedAnswer);
  parts.push('```');
  parts.push('');

  // Confidence scores
  parts.push('## Confidence Assessment');
  parts.push(`Overall Score: ${context.confidence.score}/100`);
  parts.push('Factor Breakdown:');
  parts.push(`- Retrieval Quality: ${context.confidence.factors.retrievalScore}/100`);
  parts.push(`- Query Coverage: ${context.confidence.factors.coverageScore}/100`);
  parts.push(`- Answer Quality: ${context.confidence.factors.answerQualityScore}/100`);
  parts.push(`- Source Consistency: ${context.confidence.factors.sourceConsistency}/100`);
  parts.push(`System Explanation: ${context.confidence.explanation}`);
  parts.push('');

  // Indexed results summary
  parts.push('## Indexed Documentation Results');
  parts.push(`Total results found: ${context.indexedResults.count}`);
  if (context.indexedResults.topTopics.length > 0) {
    parts.push(`Topics covered: ${context.indexedResults.topTopics.join(', ')}`);
  }
  if (context.indexedResults.coverageGaps.length > 0) {
    parts.push(`Coverage gaps (terms not found): ${context.indexedResults.coverageGaps.join(', ')}`);
  } else {
    parts.push('Coverage gaps: None detected');
  }
  parts.push('');

  // Previous context if exists
  if (context.previousContext) {
    parts.push('## Previous Evaluation Context');
    parts.push(`Summary: ${context.previousContext.summary}`);
    if (context.previousContext.structured.establishedFacts.length > 0) {
      parts.push(`Established facts: ${context.previousContext.structured.establishedFacts.join('; ')}`);
    }
    if (context.previousContext.structured.queriesTried.length > 0) {
      parts.push(`Doc queries tried: ${context.previousContext.structured.queriesTried.join(', ')}`);
    }
    if (context.previousContext.structured.webSearchesDone.length > 0) {
      parts.push(`Web searches done: ${context.previousContext.structured.webSearchesDone.join(', ')}`);
    }
    if (context.previousContext.stillNeeded.length > 0) {
      parts.push(`Still needed: ${context.previousContext.stillNeeded.join(', ')}`);
    }
    parts.push('');
  }

  // Web search results if any
  if (context.webResults && context.webResults.length > 0) {
    parts.push('## Web Search Results Available');
    for (const ws of context.webResults) {
      parts.push(`Query: "${ws.query}"`);
      for (const r of ws.results.slice(0, 3)) {
        parts.push(`- [${r.title}](${r.url})`);
        parts.push(`  ${r.content.slice(0, 300)}...`);
      }
    }
    parts.push('');
  }

  // Available actions
  parts.push('## Available Actions');
  parts.push(`Can query more docs: ${context.availableActions.canQueryMoreDocs ? 'Yes' : 'No'} (${context.availableActions.docQueriesRemaining} remaining)`);
  parts.push(`Can search web: ${context.availableActions.canSearchWeb ? 'Yes' : 'No'} (${context.availableActions.webSearchesRemaining} remaining)`);
  parts.push('');

  parts.push('Evaluate the answer critically and decide what action to take. Output valid JSON only.');

  return parts.join('\n');
}

/**
 * Parse the evaluator's JSON response, handling various formats
 */
function parseEvaluatorResponse(response: string): EvaluatorResponse {
  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Check for ```json ... ``` or ``` ... ``` blocks
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields exist
    if (!parsed.assessment || !parsed.decision || !parsed.contextCompression) {
      throw new Error('Missing required fields in evaluator response');
    }

    return {
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
  } catch (e) {
    // If JSON parsing fails, return a safe default
    console.error('Failed to parse evaluator response:', e);
    console.error('Raw response:', response.slice(0, 500));

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
  switch (parsed.decision.action) {
    case 'RETURN_ANSWER':
      return { type: 'RETURN_ANSWER', reason: parsed.decision.reason };

    case 'QUERY_MORE_DOCS':
      return {
        type: 'QUERY_MORE_DOCS',
        queries: Array.isArray(parsed.decision.actionDetails.queries)
          ? parsed.decision.actionDetails.queries
          : [],
        reason: parsed.decision.reason,
      };

    case 'SEARCH_WEB':
      return {
        type: 'SEARCH_WEB',
        queries: Array.isArray(parsed.decision.actionDetails.queries)
          ? parsed.decision.actionDetails.queries
          : [],
        reason: parsed.decision.reason,
      };

    case 'REFINE_ANSWER':
      return {
        type: 'REFINE_ANSWER',
        focusAreas: Array.isArray(parsed.decision.actionDetails.focusAreas)
          ? parsed.decision.actionDetails.focusAreas
          : [],
        reason: parsed.decision.reason,
      };

    default:
      return { type: 'RETURN_ANSWER', reason: 'Unknown action type, returning answer' };
  }
}

/**
 * Run a single evaluation step
 */
export async function runEvaluationStep(
  llmClient: LLMClient,
  context: EvaluatorContext,
  stepNumber: number
): Promise<EvaluationStepResult> {
  const startTime = Date.now();

  // Call the LLM for evaluation
  const response = await llmClient.synthesize(
    EVALUATOR_SYSTEM_PROMPT,
    buildEvaluatorUserPrompt(context),
    { temperature: 0.2, maxTokens: 2000 }
  );

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
    durationMs: Date.now() - startTime,
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
