import OpenAI from 'openai';
import type { SearchResult } from './types.js';

export interface RerankerConfig {
  apiKey: string;
  model?: string;
}

export interface RerankerOptions {
  topK?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast model for reranking
const DEFAULT_TOP_K = 10;

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

    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    // Create scoring prompt
    const documents = results.map((r, i) => ({
      index: i,
      title: r.chunk.title,
      section: r.chunk.section,
      preview: r.chunk.content.slice(0, 500)
    }));

    const prompt = `You are a document relevance scorer. Rate how relevant each document is to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map(d => `[${d.index}] ${d.title} - ${d.section}
${d.preview}...
`).join('\n')}

Return a JSON array of the ${topK} most relevant document indices, ordered by relevance (most relevant first).
Example: [3, 1, 7, 0, 5]

Only return the JSON array, nothing else.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0
      });

      const content = response.choices[0]?.message?.content || '[]';
      // Extract JSON array from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\[[\d,\s]+\]/);
      if (!jsonMatch) {
        console.error('Reranking failed: no valid JSON array in response');
        return results.slice(0, topK);
      }

      const indices: number[] = JSON.parse(jsonMatch[0]);

      // Return results in reranked order
      return indices
        .filter(i => i >= 0 && i < results.length)
        .map(i => results[i])
        .slice(0, topK);
    } catch (error) {
      console.error('Reranking failed, returning original order:', error);
      return results.slice(0, topK);
    }
  }
}
