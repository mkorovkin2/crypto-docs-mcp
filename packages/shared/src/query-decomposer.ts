/**
 * Query Decomposer - Breaks complex abstract questions into searchable sub-questions
 *
 * For multi-hop retrieval: "How does Polymarket handle market resolution?" becomes:
 * 1. "What is market resolution on Polymarket?"
 * 2. "How are Polymarket market outcomes determined?"
 * 3. "What is the UMA oracle in Polymarket?"
 */

import type { LLMClient } from './llm.js';
import type { QueryType } from './query-analyzer.js';

const DECOMPOSITION_SYSTEM_PROMPT = `You are a question decomposer for documentation search.

Given a complex question, break it into 2-4 simpler sub-questions that, when answered together, fully address the original.

RULES:
1. Each sub-question should be answerable independently
2. Include "what is" questions for key concepts mentioned
3. Include "how does" questions for processes mentioned
4. Include prerequisite concepts the user may not know
5. Don't create redundant questions
6. Order from foundational to advanced
7. Keep sub-questions focused and specific

OUTPUT: Return ONLY a JSON array of strings, nothing else.
["sub-question 1", "sub-question 2", ...]`;

const DECOMPOSITION_EXAMPLES = `
EXAMPLES:

Q: "How does Polymarket handle market resolution?"
["What is market resolution on Polymarket?", "Who determines the outcome of Polymarket markets?", "How does settlement happen after resolution?"]

Q: "What's the difference between maker and taker fees?"
["What are maker fees?", "What are taker fees?", "When do you pay maker vs taker fees?"]

Q: "How do I deploy a zkApp on Mina?"
["What is a zkApp?", "What are the prerequisites for deploying a zkApp?", "How do I deploy to Mina testnet?"]

Q: "How does the CLOB API work?"
["What is the CLOB API?", "How do I authenticate with the CLOB API?", "What are the main CLOB API endpoints?"]`;

export interface DecomposeResult {
  originalQuery: string;
  subQueries: string[];
  wasDecomposed: boolean;
  durationMs: number;
}

/**
 * Decompose a complex query into simpler sub-questions for multi-hop retrieval
 *
 * Only decomposes concept, howto, and general queries with 6+ words.
 * Code lookup and API reference queries are specific enough already.
 */
export async function decomposeQuery(
  query: string,
  queryType: QueryType,
  llmClient: LLMClient
): Promise<DecomposeResult> {
  const startTime = Date.now();

  // Only decompose concept, howto, and general queries
  if (!['concept', 'howto', 'general'].includes(queryType)) {
    return {
      originalQuery: query,
      subQueries: [query],
      wasDecomposed: false,
      durationMs: Date.now() - startTime
    };
  }

  // Simple queries don't need decomposition (less than 6 words)
  const wordCount = query.split(/\s+/).length;
  if (wordCount < 6) {
    return {
      originalQuery: query,
      subQueries: [query],
      wasDecomposed: false,
      durationMs: Date.now() - startTime
    };
  }

  try {
    const response = await llmClient.synthesize(
      DECOMPOSITION_SYSTEM_PROMPT,
      `${DECOMPOSITION_EXAMPLES}\n\nQ: "${query}"`,
      { maxTokens: 500, temperature: 0.3 }
    );

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      return {
        originalQuery: query,
        subQueries: [query],
        wasDecomposed: false,
        durationMs: Date.now() - startTime
      };
    }

    const subQueries: string[] = JSON.parse(jsonMatch[0]);

    // Validate we got useful sub-queries
    if (!Array.isArray(subQueries) || subQueries.length === 0) {
      return {
        originalQuery: query,
        subQueries: [query],
        wasDecomposed: false,
        durationMs: Date.now() - startTime
      };
    }

    // Filter out empty strings and duplicates of original query
    const filteredSubQueries = subQueries
      .filter((q): q is string =>
        typeof q === 'string' &&
        q.trim().length > 0 &&
        q.toLowerCase() !== query.toLowerCase()
      )
      .slice(0, 4); // Max 4 sub-queries

    // Always include original query first, then sub-queries
    const allQueries = [query, ...filteredSubQueries];

    return {
      originalQuery: query,
      subQueries: allQueries,
      wasDecomposed: filteredSubQueries.length > 0,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    // On any error, fall back to original query only
    console.error('[QueryDecomposer] Failed to decompose query:', error);
    return {
      originalQuery: query,
      subQueries: [query],
      wasDecomposed: false,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Check if a query is likely to benefit from decomposition
 *
 * Heuristics:
 * - Contains "how does" or "what is" + another concept
 * - Contains multiple technical terms
 * - Asks about relationships between things
 */
export function shouldDecompose(query: string, queryType: QueryType): boolean {
  if (!['concept', 'howto', 'general'].includes(queryType)) {
    return false;
  }

  const wordCount = query.split(/\s+/).length;
  if (wordCount < 6) {
    return false;
  }

  // Check for compound question patterns
  const compoundPatterns = [
    /how does .+ work/i,
    /what is .+ and .+/i,
    /difference between .+ and .+/i,
    /relationship between/i,
    /how .+ affects? .+/i,
    /why does .+ when .+/i,
    /\band\b.*\band\b/i, // Multiple "and"s suggest compound question
  ];

  return compoundPatterns.some(pattern => pattern.test(query));
}
