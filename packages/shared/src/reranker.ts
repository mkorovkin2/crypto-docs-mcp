import OpenAI from 'openai';
import type { SearchResult } from './types.js';
import type { QueryType } from './query-analyzer.js';

export interface RerankerConfig {
  apiKey: string;
  model?: string;
}

export interface RerankerOptions {
  topK?: number;
  /** Query type for specialized scoring. If provided, uses type-specific prompts. */
  queryType?: QueryType;
}

const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast model for reranking
const DEFAULT_TOP_K = 10;

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
    const queryType = options.queryType;

    if (results.length === 0) return [];
    if (results.length <= topK) return results;

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
        preview: r.chunk.content
      };
    });

    // Build query-type-specific scoring guidelines
    let scoringGuidelines: string;
    if (queryType === 'concept') {
      scoringGuidelines = `SCORING GUIDELINES FOR CONCEPTUAL QUERY:
- PRIORITIZE documents that EXPLAIN the concept, not just mention it
- Prefer documents with definitions, examples, and context
- Prefer comprehensive sections over brief mentions
- Documents that cover related concepts for fuller understanding are valuable
- DEPRIORITIZE:
  - API reference docs that only show method signatures without explanation
  - Code snippets without explanatory context
  - Changelog entries or version notes
  - Documents that assume prior knowledge of the concept`;
    } else if (queryType === 'howto') {
      scoringGuidelines = `SCORING GUIDELINES FOR HOW-TO QUERY:
- PRIORITIZE step-by-step tutorials and guides
- Prefer documents with complete code examples
- Look for documents that explain prerequisites and setup
- Documents showing common patterns and best practices are valuable
- DEPRIORITIZE:
  - Conceptual overviews without practical steps
  - API references without usage examples`;
    } else if (queryType === 'error') {
      scoringGuidelines = `SCORING GUIDELINES FOR ERROR/DEBUG QUERY:
- PRIORITIZE documents mentioning this specific error or similar errors
- Look for troubleshooting guides and common issues sections
- Solutions with code fixes are highly valuable
- Stack Overflow-style Q&A content is relevant
- DEPRIORITIZE:
  - General documentation not related to errors
  - Conceptual content without practical fixes`;
    } else if (queryType === 'code_lookup') {
      scoringGuidelines = `SCORING GUIDELINES FOR CODE LOOKUP:
- PRIORITIZE [CODE] documents with matching function/class/method names
- Exact name matches in metadata are strong signals
- Complete implementations are better than fragments
- Consider parameter types and return types as relevance signals
- DEPRIORITIZE:
  - Prose explanations without actual code
  - Test files unless specifically requested`;
    } else if (queryType === 'api_reference') {
      scoringGuidelines = `SCORING GUIDELINES FOR API REFERENCE:
- PRIORITIZE [API-REFERENCE] documents with matching signatures
- Method parameters, return types, and options are important
- Type definitions and interfaces are highly relevant
- DEPRIORITIZE:
  - Tutorial content without API details
  - High-level overviews`;
    } else {
      // General/default scoring
      scoringGuidelines = `SCORING GUIDELINES:
- Prioritize documents that directly answer the query
- For code queries, prefer [CODE] documents with matching function/class names
- For concept queries, prefer [PROSE] with clear explanations
- For API queries, prefer [API-REFERENCE] with signatures
- Consider metadata (Class, Method, Function) matches as strong relevance signals`;
    }

    const prompt = `You are a document relevance scorer for blockchain developer documentation. Rate how relevant each document is to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map(d => `[${d.index}] [${d.type.toUpperCase()}]${d.metadata} ${d.title} - ${d.section}
${d.preview}
`).join('\n')}

${scoringGuidelines}

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
