/**
 * Answer Refiner Module
 *
 * Refines an answer based on evaluation feedback and additional context.
 * Used when the evaluator decides REFINE_ANSWER - we have enough info
 * but the answer needs improvement.
 */

import type { LLMClient } from './llm.js';
import type { CompressedContext } from './evaluation-types.js';
import type { SearchResult } from './types.js';
import type { WebSearchResult } from './web-search.js';

/**
 * Input for answer refinement
 */
export interface RefineInput {
  /** Original user query */
  originalQuery: string;
  /** Current answer to improve */
  currentAnswer: string;
  /** Specific areas to focus on improving */
  focusAreas: string[];
  /** Additional context gathered */
  additionalContext: {
    newDocResults?: SearchResult[];
    webResults?: WebSearchResult[];
  };
  /** Context from previous evaluation steps */
  previousContext: CompressedContext;
  /** Project being queried */
  project: string;
}

/**
 * System prompt for the refiner LLM
 */
const REFINER_SYSTEM_PROMPT = `You are an expert at improving blockchain documentation answers. Your job is to refine an answer based on evaluation feedback and any additional context provided.

REFINEMENT RULES:
1. Preserve accurate information from the original answer
2. Incorporate new information from additional context (if provided)
3. Focus specifically on the identified improvement areas
4. Maintain proper citations using [Source N] format
5. Ensure code examples are complete with ALL imports and types
6. Add any missing prerequisites, gotchas, or important notes
7. Be concise - improve substance, don't add fluff

OUTPUT: Return ONLY the improved answer. No meta-commentary, no explanations of what you changed. Just the refined answer ready for the user.`;

/**
 * Build the user prompt for refinement
 */
function buildRefinerUserPrompt(input: RefineInput): string {
  const parts: string[] = [];

  // Original question
  parts.push(`## Original Question`);
  parts.push(input.originalQuery);
  parts.push('');

  // Current answer
  parts.push(`## Current Answer to Improve`);
  parts.push(input.currentAnswer);
  parts.push('');

  // Focus areas
  parts.push(`## Areas to Focus On`);
  for (const area of input.focusAreas) {
    parts.push(`- ${area}`);
  }
  parts.push('');

  // What we know
  parts.push(`## Context From Evaluation`);
  parts.push(`Summary: ${input.previousContext.summary}`);
  if (input.previousContext.structured.establishedFacts.length > 0) {
    parts.push(`Established facts: ${input.previousContext.structured.establishedFacts.join('; ')}`);
  }
  if (input.previousContext.stillNeeded.length > 0) {
    parts.push(`Still needed: ${input.previousContext.stillNeeded.join(', ')}`);
  }
  parts.push('');

  // Additional doc results if any
  if (input.additionalContext.newDocResults && input.additionalContext.newDocResults.length > 0) {
    parts.push('## Additional Documentation Found');
    for (const r of input.additionalContext.newDocResults.slice(0, 5)) {
      parts.push(`### ${r.chunk.title} - ${r.chunk.section}`);
      parts.push(`URL: ${r.chunk.url}`);
      // Include first 1500 chars of content
      parts.push(r.chunk.content.slice(0, 1500));
      if (r.chunk.content.length > 1500) {
        parts.push('...');
      }
      parts.push('');
    }
  }

  // Web results if any
  if (input.additionalContext.webResults && input.additionalContext.webResults.length > 0) {
    parts.push('## Web Search Results');
    for (const r of input.additionalContext.webResults.slice(0, 3)) {
      parts.push(`### ${r.title}`);
      parts.push(`URL: ${r.url}`);
      // Include first 1000 chars of content
      parts.push(r.content.slice(0, 1000));
      if (r.content.length > 1000) {
        parts.push('...');
      }
      parts.push('');
    }
  }

  parts.push('---');
  parts.push('Improve the answer by addressing the focus areas and incorporating any new information. Return only the improved answer.');

  return parts.join('\n');
}

/**
 * Refine an answer based on evaluation feedback
 */
export async function refineAnswer(
  llmClient: LLMClient,
  input: RefineInput
): Promise<string> {
  const refined = await llmClient.synthesize(
    REFINER_SYSTEM_PROMPT,
    buildRefinerUserPrompt(input),
    { maxTokens: 4000, temperature: 0.3 }
  );

  return refined;
}

/**
 * Create a synthesized answer from web search results
 * Used when indexed docs don't have the answer but web search found info
 */
export async function synthesizeFromWebResults(
  llmClient: LLMClient,
  query: string,
  project: string,
  webResults: WebSearchResult[],
  existingContext?: CompressedContext
): Promise<string> {
  const systemPrompt = `You are an expert blockchain documentation assistant. Synthesize an answer from web search results.

RULES:
1. Only use information from the provided web results
2. Cite sources with [Web: Title] format
3. For code, include complete examples with imports
4. Note any caveats about the information (e.g., version-specific)
5. If results are insufficient, say what's missing

Output a complete, helpful answer.`;

  const parts: string[] = [];
  parts.push(`## Question`);
  parts.push(query);
  parts.push(`Project: ${project}`);
  parts.push('');

  if (existingContext) {
    parts.push(`## What We Already Know`);
    parts.push(existingContext.summary);
    parts.push('');
  }

  parts.push('## Web Search Results');
  for (const r of webResults.slice(0, 5)) {
    parts.push(`### ${r.title}`);
    parts.push(`URL: ${r.url}`);
    if (r.publishedDate) {
      parts.push(`Published: ${r.publishedDate}`);
    }
    parts.push(r.content.slice(0, 1500));
    parts.push('');
  }

  parts.push('---');
  parts.push('Synthesize a comprehensive answer from these web results.');

  const answer = await llmClient.synthesize(
    systemPrompt,
    parts.join('\n'),
    { maxTokens: 4000, temperature: 0.3 }
  );

  return answer;
}
