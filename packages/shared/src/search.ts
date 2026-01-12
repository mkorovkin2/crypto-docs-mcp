import type { DocumentChunk, SearchResult } from './types.js';
import { VectorDB } from './db/vector.js';
import { FullTextDB } from './db/fts.js';
import { generateSingleEmbedding } from './embeddings.js';
import type { Reranker } from './reranker.js';

export interface HybridSearchOptions {
  vectorDb: VectorDB;
  ftsDb: FullTextDB;
  openaiApiKey: string;
  reranker?: Reranker;
}

export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string;
  mode?: 'hybrid' | 'vector' | 'fts';
  rerank?: boolean;
  rerankTopK?: number;
}

export class HybridSearch {
  constructor(private options: HybridSearchOptions) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      contentType,
      project,
      mode = 'hybrid',
      rerank = false,
      rerankTopK = 10
    } = options;

    // Fetch more candidates if reranking
    const fetchLimit = rerank ? Math.max(limit * 3, 30) : limit;

    let results: SearchResult[];

    if (mode === 'fts') {
      results = await this.ftsSearch(query, { limit: fetchLimit, contentType, project });
    } else if (mode === 'vector') {
      results = await this.vectorSearch(query, { limit: fetchLimit, contentType, project });
    } else {
      // Hybrid: combine vector and FTS results
      const [vectorResults, ftsResults] = await Promise.all([
        this.vectorSearch(query, { limit: fetchLimit, contentType, project }),
        this.ftsSearch(query, { limit: fetchLimit, contentType, project })
      ]);

      // Merge and deduplicate results using reciprocal rank fusion
      results = this.reciprocalRankFusion(vectorResults, ftsResults, fetchLimit);
    }

    // Apply reranking if enabled and reranker is available
    if (rerank && this.options.reranker && results.length > rerankTopK) {
      results = await this.options.reranker.rerank(query, results, { topK: rerankTopK });
    }

    return results.slice(0, limit);
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
    const ORPHAN_PENALTY = 0.5; // Reduce orphaned chunk scores by 50%
    const scores = new Map<string, { chunk: DocumentChunk; score: number; matchType: SearchResult['matchType'] }>();

    // Score vector results
    vectorResults.forEach((result, rank) => {
      let rrfScore = 1 / (k + rank + 1);

      // Apply orphan penalty
      if (result.chunk.metadata.orphaned) {
        rrfScore *= ORPHAN_PENALTY;
      }

      scores.set(result.chunk.id, {
        chunk: result.chunk,
        score: rrfScore,
        matchType: 'hybrid'
      });
    });

    // Add FTS scores
    ftsResults.forEach((result, rank) => {
      let rrfScore = 1 / (k + rank + 1);

      // Apply orphan penalty
      if (result.chunk.metadata.orphaned) {
        rrfScore *= ORPHAN_PENALTY;
      }

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
