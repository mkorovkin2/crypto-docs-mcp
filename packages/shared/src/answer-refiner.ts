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

// Timestamped logger for answer refiner
const getTimestamp = () => new Date().toISOString();
const refinerLog = {
  info: (msg: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [Refiner]${elapsed} ${msg}`);
  },
  debug: (msg: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${getTimestamp()}] [Refiner] ${msg}`);
    }
  },
  step: (stepName: string, durationMs: number) => {
    console.log(`[${getTimestamp()}] [Refiner] ✓ ${stepName} completed in ${durationMs}ms`);
  },
  warn: (msg: string) => {
    console.log(`[${getTimestamp()}] [Refiner] ⚠ ${msg}`);
  },
};

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
 * Uses XML-style tags for clear section delineation
 */
function buildRefinerUserPrompt(input: RefineInput): string {
  const parts: string[] = [];

  // Original question
  parts.push('<original_question>');
  parts.push(input.originalQuery);
  parts.push('</original_question>');
  parts.push('');

  // Current answer
  parts.push('<current_answer>');
  parts.push(input.currentAnswer);
  parts.push('</current_answer>');
  parts.push('');

  // Focus areas
  parts.push('<focus_areas>');
  for (const area of input.focusAreas) {
    parts.push(`<area>${area}</area>`);
  }
  parts.push('</focus_areas>');
  parts.push('');

  // What we know
  parts.push('<evaluation_context>');
  parts.push(`<summary>${input.previousContext.summary}</summary>`);
  if (input.previousContext.structured.establishedFacts.length > 0) {
    parts.push(`<established_facts>${input.previousContext.structured.establishedFacts.join('; ')}</established_facts>`);
  }
  if (input.previousContext.stillNeeded.length > 0) {
    parts.push(`<still_needed>${input.previousContext.stillNeeded.join(', ')}</still_needed>`);
  }
  parts.push('</evaluation_context>');
  parts.push('');

  // Additional doc results if any - include full content
  if (input.additionalContext.newDocResults && input.additionalContext.newDocResults.length > 0) {
    parts.push('<additional_documentation>');
    for (const r of input.additionalContext.newDocResults) {
      parts.push('<doc_result>');
      parts.push(`<title>${r.chunk.title}</title>`);
      parts.push(`<section>${r.chunk.section}</section>`);
      parts.push(`<url>${r.chunk.url}</url>`);
      parts.push(`<content>${r.chunk.content}</content>`);
      parts.push('</doc_result>');
    }
    parts.push('</additional_documentation>');
    parts.push('');
  }

  // Web results if any - include full content
  if (input.additionalContext.webResults && input.additionalContext.webResults.length > 0) {
    parts.push('<web_search_results>');
    for (const r of input.additionalContext.webResults) {
      parts.push('<web_result>');
      parts.push(`<title>${r.title}</title>`);
      parts.push(`<url>${r.url}</url>`);
      parts.push(`<content>${r.content}</content>`);
      parts.push('</web_result>');
    }
    parts.push('</web_search_results>');
    parts.push('');
  }

  parts.push('<instructions>Improve the answer by addressing the focus areas and incorporating any new information. Return only the improved answer.</instructions>');

  return parts.join('\n');
}

/**
 * Refine an answer based on evaluation feedback
 */
export async function refineAnswer(
  llmClient: LLMClient,
  input: RefineInput,
  maxTokens: number = 4000
): Promise<string> {
  const startTime = Date.now();

  refinerLog.debug(`=== ANSWER REFINEMENT STARTED ===`);
  refinerLog.debug(`Query: "${input.originalQuery}"`);
  refinerLog.debug(`Project: ${input.project}`);
  refinerLog.debug(`Focus areas: [${input.focusAreas.join(', ')}]`);
  refinerLog.debug(`Current answer length: ${input.currentAnswer.length} chars`);

  // Log additional context
  const newDocCount = input.additionalContext.newDocResults?.length || 0;
  const webResultCount = input.additionalContext.webResults?.length || 0;
  refinerLog.debug(`Additional context: ${newDocCount} new docs, ${webResultCount} web results`);

  // Build prompt
  const promptBuildStart = Date.now();
  const userPrompt = buildRefinerUserPrompt(input);
  refinerLog.debug(`Prompt built in ${Date.now() - promptBuildStart}ms (${userPrompt.length} chars)`);

  // Call LLM
  refinerLog.debug(`Calling LLM for refinement (maxTokens=${maxTokens})...`);
  const llmCallStart = Date.now();
  const refined = await llmClient.synthesize(
    REFINER_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens, temperature: 0.3 }
  );
  refinerLog.debug(`LLM refinement call completed in ${Date.now() - llmCallStart}ms`);

  refinerLog.debug(`Refined answer length: ${refined.length} chars (${refined.length > input.currentAnswer.length ? '+' : ''}${refined.length - input.currentAnswer.length} chars)`);
  refinerLog.debug(`Answer refinement total: ${Date.now() - startTime}ms`);

  return refined;
}

/**
 * Create a synthesized answer from web search results
 * Used when indexed docs don't have the answer but web search found info
 *
 * @param llmClient - LLM client for synthesis
 * @param query - Original user query
 * @param project - Project context
 * @param webResults - Web search results (ideally pre-filtered for relevance)
 * @param existingContext - Context from previous evaluation steps
 * @param preAnalyzedContext - Pre-analyzed context from web-result-analyzer (if available)
 * @param maxTokens - Maximum tokens for the synthesis call
 */
export async function synthesizeFromWebResults(
  llmClient: LLMClient,
  query: string,
  project: string,
  webResults: WebSearchResult[],
  existingContext?: CompressedContext,
  preAnalyzedContext?: string,
  maxTokens: number = 4000
): Promise<string> {
  const startTime = Date.now();

  refinerLog.debug(`=== WEB SYNTHESIS STARTED ===`);
  refinerLog.debug(`Query: "${query}"`);
  refinerLog.debug(`Project: ${project}`);
  refinerLog.debug(`Web results: ${webResults.length}`);
  refinerLog.debug(`Has existing context: ${!!existingContext}`);
  refinerLog.debug(`Has pre-analyzed context: ${!!preAnalyzedContext} (${preAnalyzedContext?.length || 0} chars)`);

  const systemPrompt = `You are an expert blockchain documentation assistant. Synthesize an answer from web search results.

RULES:
1. Only use information from the provided web results and analysis
2. Cite sources with [Web: Title] format
3. For code, include complete examples with imports
4. Note any caveats about the information (e.g., version-specific)
5. If results are insufficient, say what's missing
6. If pre-analyzed context is provided, use the extracted facts - they've been vetted for relevance

Output a complete, helpful answer.`;

  const parts: string[] = [];
  parts.push('<question>');
  parts.push(`<query>${query}</query>`);
  parts.push(`<project>${project}</project>`);
  parts.push('</question>');
  parts.push('');

  if (existingContext) {
    parts.push('<existing_context>');
    parts.push(existingContext.summary);
    parts.push('</existing_context>');
    parts.push('');
  }

  // Use pre-analyzed context if available (more efficient, already extracted key facts)
  if (preAnalyzedContext) {
    refinerLog.debug(`Using pre-analyzed context (${preAnalyzedContext.length} chars)`);
    parts.push('<analyzed_web_results>');
    parts.push(preAnalyzedContext);
    parts.push('</analyzed_web_results>');
  } else {
    // Fallback to raw web results - include full content
    refinerLog.debug(`Using raw web results (${webResults.length} results)`);
    parts.push('<web_search_results>');
    for (const r of webResults) {
      parts.push('<web_result>');
      parts.push(`<title>${r.title}</title>`);
      parts.push(`<url>${r.url}</url>`);
      if (r.publishedDate) {
        parts.push(`<published>${r.publishedDate}</published>`);
      }
      parts.push(`<content>${r.content}</content>`);
      parts.push('</web_result>');
    }
    parts.push('</web_search_results>');
  }
  parts.push('');

  parts.push('<instructions>Synthesize a comprehensive answer from these web results.</instructions>');

  const userPrompt = parts.join('\n');
  refinerLog.debug(`Prompt length: ${userPrompt.length} chars`);

  // Call LLM
  refinerLog.debug(`Calling LLM for web synthesis (maxTokens=${maxTokens})...`);
  const llmCallStart = Date.now();
  const answer = await llmClient.synthesize(
    systemPrompt,
    userPrompt,
    { maxTokens, temperature: 0.3 }
  );
  refinerLog.debug(`LLM web synthesis call completed in ${Date.now() - llmCallStart}ms`);

  refinerLog.debug(`Synthesized answer length: ${answer.length} chars`);
  refinerLog.debug(`Web synthesis total: ${Date.now() - startTime}ms`);

  return answer;
}
