import type { DocumentChunk, SearchResult } from './types.js';
import { VectorDB } from './db/vector.js';
import { FullTextDB } from './db/fts.js';
import { generateSingleEmbedding } from './embeddings.js';

export interface HybridSearchOptions {
  vectorDb: VectorDB;
  ftsDb: FullTextDB;
  openaiApiKey: string;
}

export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string;
  mode?: 'hybrid' | 'vector' | 'fts';
}

export class HybridSearch {
  constructor(private options: HybridSearchOptions) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 10, contentType, project, mode = 'hybrid' } = options;

    if (mode === 'fts') {
      return this.ftsSearch(query, { limit, contentType, project });
    }

    if (mode === 'vector') {
      return this.vectorSearch(query, { limit, contentType, project });
    }

    // Hybrid: combine vector and FTS results
    const [vectorResults, ftsResults] = await Promise.all([
      this.vectorSearch(query, { limit: limit * 2, contentType, project }),
      this.ftsSearch(query, { limit: limit * 2, contentType, project })
    ]);

    // Merge and deduplicate results using reciprocal rank fusion
    return this.reciprocalRankFusion(vectorResults, ftsResults, limit);
  }

  private async vectorSearch(
    query: string,
    options: { limit: number; contentType?: string; project?: string }
  ): Promise<SearchResult[]> {
    const embedding = await generateSingleEmbedding(
      query,
      this.options.openaiApiKey
    );

    const filter: Record<string, string> = {};
    if (options.contentType) filter.contentType = options.contentType;
    if (options.project) filter.project = options.project;

    const results = await this.options.vectorDb.search(embedding, {
      limit: options.limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined
    });

    return results.map(r => ({
      chunk: r.chunk,
      score: r.score,
      matchType: 'vector' as const
    }));
  }

  private async ftsSearch(
    query: string,
    options: { limit: number; contentType?: string; project?: string }
  ): Promise<SearchResult[]> {
    const results = await this.options.ftsDb.search(query, {
      limit: options.limit,
      contentType: options.contentType,
      project: options.project
    });

    return results.map(r => ({
      chunk: r.chunk,
      score: r.score,
      matchType: 'fts' as const
    }));
  }

  private reciprocalRankFusion(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const k = 60; // RRF constant
    const scores = new Map<string, { chunk: DocumentChunk; score: number; matchType: SearchResult['matchType'] }>();

    // Score vector results
    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scores.set(result.chunk.id, {
        chunk: result.chunk,
        score: rrfScore,
        matchType: 'hybrid'
      });
    });

    // Add FTS scores
    ftsResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = scores.get(result.chunk.id);

      if (existing) {
        existing.score += rrfScore;
        existing.matchType = 'hybrid';
      } else {
        scores.set(result.chunk.id, {
          chunk: result.chunk,
          score: rrfScore,
          matchType: 'hybrid'
        });
      }
    });

    // Sort by combined score and return top results
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
