/**
 * LLM-as-Judge Semantic Validator
 *
 * Uses GPT-4o to objectively evaluate whether responses are helpful,
 * relevant, and accurate for the question asked.
 */

import OpenAI from 'openai';
import type { ValidationResult } from '../types.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable required for LLM judge');
    }
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface SemanticJudgment {
  score: number;  // 0-100
  passed: boolean;
  reasoning: string;
  helpfulness: number;      // 0-100: Does this answer help the user accomplish their goal?
  relevance: number;        // 0-100: Is the answer on-topic for the question?
  accuracy: number;         // 0-100: Is the information factually correct?
  completeness: number;     // 0-100: Does it cover what the user needs to know?
  issues: string[];         // Specific problems found
}

/**
 * Objectively evaluate whether a response is helpful and relevant
 */
export async function judgeResponseQuality(
  question: string,
  response: string,
  project: string,
  context?: {
    expectedFacts?: string[];
    forbiddenClaims?: string[];
    isComparison?: boolean;  // If true, cross-project mentions are expected
  }
): Promise<SemanticJudgment> {
  const client = getClient();

  // Detect if the question is asking for a comparison
  const comparisonIndicators = ['compare', 'vs', 'versus', 'difference', 'similar', 'unlike', 'between'];
  const isComparisonQuestion = context?.isComparison ||
    comparisonIndicators.some(ind => question.toLowerCase().includes(ind));

  const prompt = `You are an objective evaluator assessing documentation assistant responses.

TASK: Evaluate if this response actually helps answer the user's question.

PROJECT CONTEXT: The user is working with ${project} blockchain.
${isComparisonQuestion ? 'NOTE: This appears to be a comparison question, so mentioning other projects is appropriate and expected.' : ''}

USER QUESTION:
${question}

ASSISTANT RESPONSE:
${response.slice(0, 5000)}

${context?.expectedFacts ? `REFERENCE FACTS (use to check accuracy, not as a checklist):
${context.expectedFacts.map((f, i) => `- ${f}`).join('\n')}` : ''}

EVALUATE OBJECTIVELY on these criteria (0-100 each):

1. HELPFULNESS: Does this response help the user accomplish what they're trying to do?
   - Would a developer reading this know what to do next?
   - Does it provide actionable information?
   - Is it practical and usable?

2. RELEVANCE: Does the response actually address the question asked?
   - Is it on-topic or does it go off on tangents?
   - Does it answer what was asked, not something else?
   ${!isComparisonQuestion ? `- If it mentions other projects (not ${project}), is that mention relevant to answering the question, or is it irrelevant noise?` : ''}

3. ACCURACY: Is the technical information correct?
   - Are the APIs, functions, and concepts described correctly?
   - Would following this advice work?
   - Are there factual errors?

4. COMPLETENESS: Does it cover what the user needs to know?
   - Are important details missing?
   - Would the user need to ask follow-up questions to actually use this?

IMPORTANT: Be objective. A response that is simple but correct and helpful should score well. A response that is verbose but misses the point should score poorly.

Respond in JSON:
{
  "helpfulness": <0-100>,
  "relevance": <0-100>,
  "accuracy": <0-100>,
  "completeness": <0-100>,
  "overallScore": <0-100>,
  "issues": [<specific problems, if any>],
  "reasoning": "<2-3 sentence objective assessment>"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return createFailedJudgment('Failed to parse LLM judge response');
    }

    const result = JSON.parse(jsonMatch[0]) as {
      helpfulness: number;
      relevance: number;
      accuracy: number;
      completeness: number;
      overallScore: number;
      issues: string[];
      reasoning: string;
    };

    // Pass if overall score >= 70 and no critical dimensions below 50
    const criticalFailure = result.helpfulness < 50 || result.relevance < 50 || result.accuracy < 50;
    const passed = result.overallScore >= 70 && !criticalFailure;

    return {
      score: result.overallScore,
      passed,
      reasoning: result.reasoning,
      helpfulness: result.helpfulness,
      relevance: result.relevance,
      accuracy: result.accuracy,
      completeness: result.completeness,
      issues: result.issues || []
    };

  } catch (error) {
    return createFailedJudgment(`LLM judge error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Judge code example quality
 */
export async function judgeCodeQuality(
  task: string,
  codeResponse: string,
  project: string,
  requirements?: {
    mustInclude?: string[];
    mustNotInclude?: string[];
    expectedStructure?: string;
  }
): Promise<SemanticJudgment> {
  const client = getClient();

  const prompt = `You are an objective evaluator assessing code examples from a documentation assistant.

TASK: Evaluate if this code example actually helps the user accomplish their goal.

PROJECT: ${project}
USER'S GOAL: ${task}

CODE RESPONSE:
${codeResponse.slice(0, 6000)}

${requirements?.expectedStructure ? `EXPECTED APPROACH: ${requirements.expectedStructure}` : ''}

EVALUATE OBJECTIVELY:

1. HELPFULNESS: Can a developer actually use this code?
   - Is it copy-paste ready (or close to it)?
   - Does it show the key parts needed?
   - Would someone know how to integrate this?

2. RELEVANCE: Does this code accomplish the stated task?
   - Does it do what was asked?
   - Is it the right approach for ${project}?

3. ACCURACY: Is the code correct?
   - Would this code run without errors?
   - Are the APIs used correctly?
   - Are imports/dependencies correct?

4. COMPLETENESS: Does it show enough to be useful?
   - Are critical steps missing?
   - Is error handling shown where important?
   - Would a developer need significant additional code?

IMPORTANT: Working, practical code that accomplishes the task should score highly even if not perfect. Broken or irrelevant code should score poorly regardless of length.

Respond in JSON:
{
  "helpfulness": <0-100>,
  "relevance": <0-100>,
  "accuracy": <0-100>,
  "completeness": <0-100>,
  "overallScore": <0-100>,
  "wouldRun": <true/false>,
  "issues": [<specific problems>],
  "reasoning": "<2-3 sentence assessment>"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return createFailedJudgment('Failed to parse LLM judge response');
    }

    const result = JSON.parse(jsonMatch[0]) as {
      helpfulness: number;
      relevance: number;
      accuracy: number;
      completeness: number;
      overallScore: number;
      wouldRun: boolean;
      issues: string[];
      reasoning: string;
    };

    // For code, accuracy matters more - code that won't run is a critical failure
    const passed = result.overallScore >= 70 && result.accuracy >= 60 && result.wouldRun !== false;

    return {
      score: result.overallScore,
      passed,
      reasoning: result.reasoning,
      helpfulness: result.helpfulness,
      relevance: result.relevance,
      accuracy: result.accuracy,
      completeness: result.completeness,
      issues: result.issues || []
    };

  } catch (error) {
    return createFailedJudgment(`LLM judge error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Judge error explanation quality
 */
export async function judgeErrorExplanation(
  error: string,
  errorContext: string,
  response: string,
  project: string
): Promise<SemanticJudgment> {
  const client = getClient();

  const prompt = `You are an objective evaluator assessing error explanation responses.

TASK: Evaluate if this error explanation actually helps the user fix their problem.

PROJECT: ${project}
ERROR MESSAGE: ${error}
CONTEXT: ${errorContext}

ASSISTANT RESPONSE:
${response.slice(0, 4000)}

EVALUATE OBJECTIVELY:

1. HELPFULNESS: Does this help the user fix the error?
   - Does it explain what went wrong?
   - Does it tell the user what to do to fix it?
   - Are the suggested fixes actionable?

2. RELEVANCE: Is this explanation about the right error?
   - Does it address this specific error, not some other problem?
   - Is it relevant to ${project}?

3. ACCURACY: Is the explanation correct?
   - Is the diagnosis accurate?
   - Would the suggested fixes actually work?

4. COMPLETENESS: Does it cover common causes?
   - Are likely causes mentioned?
   - Are edge cases addressed if relevant?

Respond in JSON:
{
  "helpfulness": <0-100>,
  "relevance": <0-100>,
  "accuracy": <0-100>,
  "completeness": <0-100>,
  "overallScore": <0-100>,
  "issues": [<problems with the explanation>],
  "reasoning": "<2-3 sentence assessment>"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return createFailedJudgment('Failed to parse LLM judge response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const passed = result.overallScore >= 70 && result.helpfulness >= 60;

    return {
      score: result.overallScore,
      passed,
      reasoning: result.reasoning,
      helpfulness: result.helpfulness,
      relevance: result.relevance,
      accuracy: result.accuracy,
      completeness: result.completeness,
      issues: result.issues || []
    };

  } catch (error) {
    return createFailedJudgment(`LLM judge error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

function createFailedJudgment(reason: string): SemanticJudgment {
  return {
    score: 0,
    passed: false,
    reasoning: reason,
    helpfulness: 0,
    relevance: 0,
    accuracy: 0,
    completeness: 0,
    issues: [reason]
  };
}

/**
 * Convert SemanticJudgment to ValidationResult
 */
export function judgmentToValidation(judgment: SemanticJudgment, ruleName: string): ValidationResult {
  const dimensions = `H:${judgment.helpfulness} R:${judgment.relevance} A:${judgment.accuracy} C:${judgment.completeness}`;
  let message = `LLM Judge: ${judgment.score}/100 [${dimensions}] - ${judgment.reasoning}`;

  if (judgment.issues.length > 0) {
    message += ` Issues: ${judgment.issues.slice(0, 2).join('; ')}`;
  }

  return {
    rule: { type: 'matches_regex', pattern: ruleName },
    passed: judgment.passed,
    message,
    details: {
      score: judgment.score,
      helpfulness: judgment.helpfulness,
      relevance: judgment.relevance,
      accuracy: judgment.accuracy,
      completeness: judgment.completeness,
      issues: judgment.issues
    }
  };
}

// Keep old function names for backwards compatibility but use new implementation
export async function judgeSemanticCorrectness(
  question: string,
  response: string,
  groundTruth: {
    expectedFacts: string[];
    forbiddenClaims?: string[];
    acceptableVariations?: string[];
  },
  project: string
): Promise<SemanticJudgment> {
  return judgeResponseQuality(question, response, project, {
    expectedFacts: groundTruth.expectedFacts,
    forbiddenClaims: groundTruth.forbiddenClaims
  });
}

export async function judgeCodeCorrectness(
  task: string,
  codeResponse: string,
  expectedPatterns: {
    mustInclude: string[];
    mustNotInclude?: string[];
    expectedStructure?: string;
  },
  project: string
): Promise<SemanticJudgment> {
  return judgeCodeQuality(task, codeResponse, project, expectedPatterns);
}
