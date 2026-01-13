/**
 * Adjacent Chunk Expansion Module
 *
 * Expands search results with neighboring chunks to provide fuller context.
 * When a relevant chunk is found, this module fetches adjacent chunks based
 * on content type configuration.
 *
 * TODO: Currently fetches adjacent chunks eagerly before reranking.
 * Future optimization: lazy fetching based on initial result quality.
 */

import type { DocumentChunk, SearchResult } from './types.js';
import type { FullTextDB } from './db/fts.js';

/**
 * Configuration for adjacent chunk retrieval by content type
 */
export interface AdjacentChunkConfig {
  prose: number;           // Window size for prose chunks
  code: number;            // Window size for code chunks
  'api-reference': number; // Window size for API reference
}

export const DEFAULT_ADJACENT_CONFIG: AdjacentChunkConfig = {
  prose: 2,           // Fetch 2 chunks before and after (5 total including center)
  code: 3,            // Fetch 3 chunks before and after (7 total - code often needs more context)
  'api-reference': 1  // Fetch 1 chunk before and after (3 total - API docs are more self-contained)
};

export interface ExpandAdjacentOptions {
  config?: Partial<AdjacentChunkConfig>;
  maxTotalChunks?: number;  // Cap on total chunks after expansion (default: 50)
}

/**
 * Expand search results with adjacent chunks
 *
 * For each result, fetches neighboring chunks based on content type.
 * Deduplicates and maintains original relevance scores for searched chunks.
 * Adjacent chunks get a reduced score to indicate they're context, not direct matches.
 *
 * Results are grouped by document and sorted by chunk index within each group,
 * with document groups ordered by their highest-scoring chunk.
 *
 * @param results - Original search results
 * @param ftsDb - Database for fetching adjacent chunks
 * @param options - Configuration options
 * @returns Expanded results with adjacent chunks included
 */
export async function expandWithAdjacentChunks(
  results: SearchResult[],
  ftsDb: FullTextDB,
  options: ExpandAdjacentOptions = {}
): Promise<SearchResult[]> {
  const config = { ...DEFAULT_ADJACENT_CONFIG, ...options.config };
  const maxTotal = options.maxTotalChunks ?? 50;

  if (results.length === 0) {
    return [];
  }

  // Track all chunks by ID to deduplicate
  const chunkMap = new Map<string, SearchResult>();

  // First, add all original results (they keep their original scores)
  for (const result of results) {
    chunkMap.set(result.chunk.id, result);
  }

  // Collect unique documentIds that have ordering metadata
  const documentIdsToExpand = new Map<string, { chunkIndex: number; score: number; contentType: DocumentChunk['contentType'] }[]>();

  for (const result of results) {
    const { chunk } = result;

    // Skip if chunk doesn't have ordering metadata
    if (!chunk.documentId || chunk.chunkIndex === undefined) {
      continue;
    }

    if (!documentIdsToExpand.has(chunk.documentId)) {
      documentIdsToExpand.set(chunk.documentId, []);
    }
    documentIdsToExpand.get(chunk.documentId)!.push({
      chunkIndex: chunk.chunkIndex,
      score: result.score,
      contentType: chunk.contentType
    });
  }

  // Fetch adjacent chunks for each document
  const adjacentPromises: Promise<void>[] = [];

  for (const [documentId, chunks] of documentIdsToExpand) {
    // Find the window size based on the content types in this document
    // Use the max window size among all matched chunks
    const maxWindowSize = Math.max(
      ...chunks.map(c => config[c.contentType] || config.prose)
    );

    // Find the range we need to fetch (union of all chunk windows)
    const minIndex = Math.min(...chunks.map(c => Math.max(0, c.chunkIndex - maxWindowSize)));
    const maxIndex = Math.max(...chunks.map(c => c.chunkIndex + maxWindowSize));

    // Calculate center index for score calculation (average of matched chunks)
    const avgChunkIndex = chunks.reduce((sum, c) => sum + c.chunkIndex, 0) / chunks.length;
    const maxScore = Math.max(...chunks.map(c => c.score));

    adjacentPromises.push(
      ftsDb.getAdjacentChunks(documentId, Math.round(avgChunkIndex), maxWindowSize)
        .then(adjacentChunks => {
          for (const adjChunk of adjacentChunks) {
            // Skip if already in map (original result or from another expansion)
            if (chunkMap.has(adjChunk.id)) {
              continue;
            }

            // Skip if outside our desired range
            if (adjChunk.chunkIndex === undefined ||
                adjChunk.chunkIndex < minIndex ||
                adjChunk.chunkIndex > maxIndex) {
              continue;
            }

            // Calculate distance from nearest matched chunk
            const nearestMatchedChunk = chunks.reduce((nearest, c) => {
              const dist = Math.abs(c.chunkIndex - adjChunk.chunkIndex!);
              return dist < nearest.dist ? { dist, score: c.score } : nearest;
            }, { dist: Infinity, score: 0 });

            // Score is based on distance from the nearest matched chunk
            // Closer chunks get higher scores, but always less than the matched chunk
            const distance = nearestMatchedChunk.dist;
            const adjacentScore = nearestMatchedChunk.score * (0.5 / Math.max(1, distance));

            chunkMap.set(adjChunk.id, {
              chunk: adjChunk,
              score: adjacentScore,
              matchType: 'hybrid' // Mark as hybrid since it's context
            });
          }
        })
        .catch(err => {
          console.error(`[AdjacentChunks] Failed to fetch adjacent chunks for documentId ${documentId}:`, err);
        })
    );
  }

  await Promise.all(adjacentPromises);

  // Group chunks by documentId and sort within groups by chunkIndex
  const byDocument = new Map<string, SearchResult[]>();
  for (const result of chunkMap.values()) {
    const docId = result.chunk.documentId || result.chunk.id;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId)!.push(result);
  }

  // Sort within each document group by chunk index
  for (const docResults of byDocument.values()) {
    docResults.sort((a, b) => (a.chunk.chunkIndex ?? 0) - (b.chunk.chunkIndex ?? 0));
  }

  // Calculate max score for each document group to determine document order
  const docScores = new Map<string, number>();
  for (const [docId, docResults] of byDocument) {
    docScores.set(docId, Math.max(...docResults.map(r => r.score)));
  }

  // Sort document groups by their max score (highest first)
  const sortedDocIds = Array.from(docScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([docId]) => docId);

  // Reconstruct result array: documents ordered by score, chunks within each document by index
  const expanded: SearchResult[] = [];
  for (const docId of sortedDocIds) {
    const docChunks = byDocument.get(docId)!;
    expanded.push(...docChunks);
    if (expanded.length >= maxTotal) break;
  }

  return expanded.slice(0, maxTotal);
}
