/**
 * LLM-based Query Variation Generator
 *
 * Uses a fast LLM to generate 3-5 diverse search query variations
 * for improved retrieval coverage.
 */

import type { LLMClient } from './llm.js';
import type { QueryAnalysis } from './query-analyzer.js';

export interface QueryVariationOptions {
  /** Number of variations to generate (default: 4) */
  count?: number;
  /** Max tokens for LLM call (default: 1000, higher for thinking models) */
  maxTokens?: number;
  /** Project context for better variations */
  project?: string;
  /** Query analysis for additional context */
  analysis?: QueryAnalysis;
}

export interface QueryVariationResult {
  /** Original query */
  original: string;
  /** Generated query variations */
  variations: string[];
  /** Time taken in ms */
  durationMs: number;
}

const QUERY_VARIATION_PROMPT = `You are a search query optimizer for blockchain documentation. Given a user's question, generate diverse search query variations that would help find relevant documentation.

Guidelines:
- Generate exactly {count} query variations
- Each variation should approach the topic differently:
  - Use synonyms and alternative terminology
  - Try different phrasings (how-to, what-is, conceptual)
  - Include relevant technical terms
  - Vary specificity (broader and narrower queries)
- Keep queries concise (under 15 words each)
- Focus on terms likely to appear in documentation
- Do NOT include the project name in queries (it's filtered separately)

Respond with ONLY a JSON array of strings, no explanation.

Example input: "how do I deploy a smart contract"
Example output: ["deploy smart contract tutorial", "contract deployment guide steps", "deploying contracts getting started", "smart contract deploy command"]`;

/**
 * Generate query variations using a fast LLM
 */
export async function generateQueryVariations(
  query: string,
  llmClient: LLMClient,
  options: QueryVariationOptions = {}
): Promise<QueryVariationResult> {
  const startTime = Date.now();
  const count = options.count ?? 4;

  const systemPrompt = QUERY_VARIATION_PROMPT.replace('{count}', count.toString());

  const userPrompt = buildUserPrompt(query, options);

  try {
    const response = await llmClient.synthesize(systemPrompt, userPrompt, {
      maxTokens: options.maxTokens ?? 1000,
      temperature: 0.7 // Higher temp for more diverse variations
    });

    const variations = parseVariations(response, query, count);

    return {
      original: query,
      variations,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    // Fallback: return original query if LLM fails
    console.warn('[QueryVariations] LLM failed, using original query:', error);
    return {
      original: query,
      variations: [query],
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Build user prompt with context
 */
function buildUserPrompt(query: string, options: QueryVariationOptions): string {
  let prompt = `User question: "${query}"`;

  if (options.project) {
    prompt += `\nProject: ${options.project} (blockchain/crypto documentation)`;
  }

  if (options.analysis) {
    prompt += `\nQuery type: ${options.analysis.type}`;
    if (options.analysis.keywords.length > 0) {
      prompt += `\nKey terms: ${options.analysis.keywords.join(', ')}`;
    }
  }

  return prompt;
}

/**
 * Parse LLM response into query variations
 */
function parseVariations(response: string, originalQuery: string, expectedCount: number): string[] {
  try {
    // Try to extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[QueryVariations] No JSON array found in response');
      return [originalQuery];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.warn('[QueryVariations] Parsed result is not an array');
      return [originalQuery];
    }

    // Filter and clean variations
    const variations = parsed
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(v => v.length > 0 && v.length < 200);

    if (variations.length === 0) {
      return [originalQuery];
    }

    // Ensure we don't have too many variations
    return variations.slice(0, expectedCount);
  } catch (error) {
    console.warn('[QueryVariations] Failed to parse response:', error);
    return [originalQuery];
  }
}

/**
 * Merge search results from multiple query variations
 * Uses reciprocal rank fusion to combine results
 */
import type { SearchResult } from './types.js';

export function mergeQueryVariationResults(
  resultSets: SearchResult[][],
  limit: number
): SearchResult[] {
  const k = 60; // RRF constant
  const scores = new Map<string, { result: SearchResult; score: number; hitCount: number }>();

  // Score each result set
  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = 1 / (k + rank + 1);

      const existing = scores.get(result.chunk.id);
      if (existing) {
        existing.score += rrfScore;
        existing.hitCount += 1;
        // Keep the higher-scored version
        if (result.score > existing.result.score) {
          existing.result = result;
        }
      } else {
        scores.set(result.chunk.id, {
          result,
          score: rrfScore,
          hitCount: 1
        });
      }
    }
  }

  // Boost results that appeared in multiple query variations
  for (const entry of scores.values()) {
    if (entry.hitCount > 1) {
      // Boost by 20% for each additional hit
      entry.score *= 1 + (entry.hitCount - 1) * 0.2;
    }
  }

  // Sort by combined score and return top results
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.result);
}
