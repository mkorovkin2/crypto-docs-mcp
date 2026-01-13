import OpenAI from 'openai';
import type { SearchResult } from './types.js';

export interface RerankerConfig {
  apiKey: string;
  model?: string;
}

export interface RerankerOptions {
  topK?: number;
  /** Use extended context (2000 chars) for better accuracy. Default: true */
  extendedContext?: boolean;
}

const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast model for reranking
const DEFAULT_TOP_K = 10;
const SHORT_PREVIEW_LENGTH = 500;
const EXTENDED_PREVIEW_LENGTH = 2000;

// Debug flag - set via environment variable
const DEBUG_RERANKER = process.env.DEBUG_RERANKER === 'true';

export class Reranker {
  private client: OpenAI;
  private model: string;

  constructor(config: RerankerConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_MODEL;
  }

  async rerank(
    query: string,
    results: SearchResult[],
    options: RerankerOptions = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK || DEFAULT_TOP_K;
    const extendedContext = options.extendedContext !== false; // Default to true

    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    // Use extended preview length for better code understanding
    const previewLength = extendedContext ? EXTENDED_PREVIEW_LENGTH : SHORT_PREVIEW_LENGTH;

    // Create scoring prompt with richer metadata
    const documents = results.map((r, i) => {
      const metadata = r.chunk.metadata;
      const metaParts: string[] = [];

      if (r.chunk.contentType === 'code') {
        if (metadata.className) metaParts.push(`Class: ${metadata.className}`);
        if (metadata.methodName) metaParts.push(`Method: ${metadata.methodName}`);
        if (metadata.functionName) metaParts.push(`Function: ${metadata.functionName}`);
        if (metadata.codeLanguage) metaParts.push(`Lang: ${metadata.codeLanguage}`);
      }

      const metaStr = metaParts.length > 0 ? ` (${metaParts.join(', ')})` : '';

      return {
        index: i,
        title: r.chunk.title,
        section: r.chunk.section,
        type: r.chunk.contentType,
        metadata: metaStr,
        preview: r.chunk.content.slice(0, previewLength)
      };
    });

    const prompt = `You are a document relevance scorer for blockchain developer documentation. Rate how relevant each document is to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map(d => `[${d.index}] [${d.type.toUpperCase()}]${d.metadata} ${d.title} - ${d.section}
${d.preview}${d.preview.length >= previewLength ? '...' : ''}
`).join('\n')}

SCORING GUIDELINES:
- Prioritize documents that directly answer the query
- For code queries, prefer [CODE] documents with matching function/class names
- For concept queries, prefer [DOCS] with clear explanations
- For API queries, prefer [API-REFERENCE] with signatures
- Consider metadata (Class, Method, Function) matches as strong relevance signals

Return a JSON array of the ${topK} most relevant document indices, ordered by relevance (most relevant first).
Example: [3, 1, 7, 0, 5]

Only return the JSON array, nothing else.`;

    try {
      if (DEBUG_RERANKER) {
        console.log('[Reranker] Query:', query);
        console.log('[Reranker] Documents to rerank:', results.length);
        console.log('[Reranker] TopK:', topK);
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150, // Increased for larger topK values
        temperature: 0
      });

      const content = response.choices[0]?.message?.content || '[]';

      if (DEBUG_RERANKER) {
        console.log('[Reranker] Raw response:', JSON.stringify(content));
        console.log('[Reranker] Response length:', content.length);
      }

      // Extract JSON array from response (handle potential markdown code blocks)
      // Try multiple patterns to be more robust (use * instead of + to handle empty arrays)
      let jsonMatch = content.match(/\[[\d,\s]*\]/);

      // If simple pattern fails, try to extract from code blocks
      if (!jsonMatch) {
        const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
          jsonMatch = codeBlockMatch[1].match(/\[[\d,\s]*\]/);
        }
      }

      // Try parsing any array-like structure
      if (!jsonMatch) {
        const anyArrayMatch = content.match(/\[[\d,\s\n]*\]/);
        if (anyArrayMatch) {
          jsonMatch = anyArrayMatch;
        }
      }

      if (!jsonMatch) {
        console.error('[Reranker] Failed: no valid JSON array in response');
        console.error('[Reranker] Raw content was:', content);
        return results.slice(0, topK);
      }

      if (DEBUG_RERANKER) {
        console.log('[Reranker] Matched JSON:', jsonMatch[0]);
      }

      const indices: number[] = JSON.parse(jsonMatch[0]);

      if (DEBUG_RERANKER) {
        console.log('[Reranker] Parsed indices:', indices);
      }

      // If model returns empty array (no relevant results), fall back to original order
      if (indices.length === 0) {
        if (DEBUG_RERANKER) {
          console.log('[Reranker] Model returned empty array, falling back to original order');
        }
        return results.slice(0, topK);
      }

      // Return results in reranked order
      const reranked = indices
        .filter(i => i >= 0 && i < results.length)
        .map(i => results[i])
        .slice(0, topK);

      if (DEBUG_RERANKER) {
        console.log('[Reranker] Returning', reranked.length, 'results');
      }

      return reranked;
    } catch (error) {
      console.error('[Reranker] Failed, returning original order:', error);
      if (DEBUG_RERANKER && error instanceof Error) {
        console.error('[Reranker] Error stack:', error.stack);
      }
      return results.slice(0, topK);
    }
  }
}
