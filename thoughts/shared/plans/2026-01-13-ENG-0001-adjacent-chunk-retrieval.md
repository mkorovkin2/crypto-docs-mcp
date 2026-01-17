# Adjacent Chunk Retrieval Implementation Plan

## Overview

Improve the RAG (Retrieval-Augmented Generation) flow by implementing adjacent chunk retrieval. When a chunk is deemed relevant during search, the system will automatically fetch neighboring chunks to provide fuller context. This addresses the current limitation where chunks are retrieved in isolation, losing valuable surrounding context.

## Current State Analysis

### What Exists Now
- **Chunking** (`packages/scraper/src/chunker.ts`): Splits documents into chunks with 150-token overlap for prose, AST-based semantic boundaries for code
- **Storage**: Chunks stored in Qdrant (vector) and SQLite (FTS) with random UUIDs as IDs
- **Search** (`packages/shared/src/search.ts`): Hybrid vector + FTS search with optional LLM reranking
- **Context Assembly** (`packages/server/src/tools/context-formatter.ts`): Concatenates retrieved chunks without considering document structure

### Key Gaps
1. **No chunk ordering metadata**: No `chunkIndex`, `documentId`, or sibling references stored
2. **No adjacent retrieval**: Search returns isolated chunks without surrounding context
3. **Inference-only adjacency**: Can only infer relationships via URL + "(Part X/Y)" string parsing

### Key Discoveries
- Chunk creation: `packages/scraper/src/chunker.ts:52-64` - split chunks get "(Part X/Y)" but no ordering metadata
- `DocumentChunk` type: `packages/shared/src/types.ts:3-42` - no ordering fields
- Search: `packages/shared/src/search.ts:26-62` - no post-processing for adjacency
- Context formatting: `packages/server/src/tools/context-formatter.ts:88-94` - simple concatenation

## Desired End State

After implementation:
1. Every chunk has ordering metadata: `documentId`, `chunkIndex`, `totalChunks`
2. Search automatically expands relevant results with adjacent chunks (configurable N per content type)
3. Adjacent chunks are fetched before reranking, letting the reranker filter relevance
4. All existing documents re-indexed with new ordering metadata

### Verification
- Query for a specific topic returns chunks with their neighbors grouped together
- Split prose chunks "(Part 1/3)", "(Part 2/3)", etc. can be retrieved together
- Code context includes surrounding functions/methods when relevant

## What We're NOT Doing

- **Not implementing lazy adjacency fetching** (noted as future TODO for performance optimization)
- **Not adding real-time streaming** of adjacent chunks
- **Not changing the reranker logic** - it will handle the expanded result set as-is
- **Not supporting partial migration** - we'll require full re-indexing

## Implementation Approach

The implementation follows a bottom-up approach:
1. First, update types and schema (foundation)
2. Then, update chunking to populate ordering metadata
3. Add database methods to fetch adjacent chunks
4. Create the adjacent chunk expansion logic
5. Integrate into search flow
6. Re-index all documents

---

## Phase 1: Schema and Type Updates

### Overview
Add ordering metadata fields to the `DocumentChunk` type and update both database schemas (SQLite and Qdrant) to store and index these fields.

### Changes Required

#### 1. Update DocumentChunk Type
**File**: `packages/shared/src/types.ts`
**Changes**: Add ordering metadata fields to the interface

```typescript
export interface DocumentChunk {
  id: string;
  url: string;
  title: string;
  section: string;
  content: string;
  contentType: 'prose' | 'code' | 'api-reference';
  project: string;
  // NEW: Ordering metadata for adjacent chunk retrieval
  documentId: string;      // Hash of URL - groups chunks from same source
  chunkIndex: number;      // 0-based position within document
  totalChunks: number;     // Total chunks in this document
  metadata: {
    // ... existing fields unchanged
  };
}
```

#### 2. Update SQLite Schema
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Add columns and indexes for ordering metadata

In the `initialize()` method, add migration for new columns:
```typescript
// Add ordering columns if they don't exist (migration)
const columns = this.db.prepare("PRAGMA table_info(chunks)").all() as Array<{name: string}>;
if (!columns.some(c => c.name === 'document_id')) {
  this.db.exec(`ALTER TABLE chunks ADD COLUMN document_id TEXT`);
  this.db.exec(`ALTER TABLE chunks ADD COLUMN chunk_index INTEGER`);
  this.db.exec(`ALTER TABLE chunks ADD COLUMN total_chunks INTEGER`);
  this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)`);
  this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_ordering ON chunks(document_id, chunk_index)`);
}
```

Update `upsert()` to store new fields:
```typescript
const insertChunk = this.db.prepare(`
  INSERT OR REPLACE INTO chunks (id, url, title, section, content, content_type, project, metadata, orphaned, document_id, chunk_index, total_chunks)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
```

Add new method `getAdjacentChunks()`:
```typescript
/**
 * Get adjacent chunks for a given chunk
 * @param documentId - The document ID to query
 * @param chunkIndex - The center chunk index
 * @param windowSize - Number of chunks to fetch in each direction
 * @returns Chunks ordered by index
 */
async getAdjacentChunks(
  documentId: string,
  chunkIndex: number,
  windowSize: number
): Promise<DocumentChunk[]> {
  const minIndex = Math.max(0, chunkIndex - windowSize);
  const maxIndex = chunkIndex + windowSize;

  const rows = this.db.prepare(`
    SELECT * FROM chunks
    WHERE document_id = ? AND chunk_index >= ? AND chunk_index <= ?
    ORDER BY chunk_index
  `).all(documentId, minIndex, maxIndex) as any[];

  return rows.map(row => ({
    id: row.id,
    url: row.url,
    title: row.title,
    section: row.section,
    content: row.content,
    contentType: row.content_type,
    project: row.project,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    totalChunks: row.total_chunks,
    metadata: {
      ...JSON.parse(row.metadata),
      orphaned: row.orphaned === 1
    }
  }));
}
```

#### 3. Update Qdrant Schema
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Add payload fields and index for document_id

In `initialize()`, add new payload index:
```typescript
// Create document_id index for adjacent chunk queries
await this.client.createPayloadIndex(this.collection, {
  field_name: 'documentId',
  field_schema: 'keyword'
});
```

Update `upsert()` to include new fields in payload:
```typescript
payload: {
  // ... existing fields
  documentId: chunk.documentId,
  chunkIndex: chunk.chunkIndex,
  totalChunks: chunk.totalChunks,
}
```

Add new method `getAdjacentChunks()`:
```typescript
/**
 * Get adjacent chunks by document ID and index range
 */
async getAdjacentChunks(
  documentId: string,
  chunkIndex: number,
  windowSize: number
): Promise<DocumentChunk[]> {
  const minIndex = Math.max(0, chunkIndex - windowSize);
  const maxIndex = chunkIndex + windowSize;

  const result = await this.client.scroll(this.collection, {
    filter: {
      must: [
        { key: 'documentId', match: { value: documentId } }
      ]
    },
    limit: windowSize * 2 + 1,
    with_payload: true
  });

  // Filter by index range and sort
  return result.points
    .filter(p => {
      const idx = p.payload?.chunkIndex as number;
      return idx >= minIndex && idx <= maxIndex;
    })
    .sort((a, b) => (a.payload?.chunkIndex as number) - (b.payload?.chunkIndex as number))
    .map(p => ({
      id: p.id as string,
      url: p.payload!.url as string,
      title: p.payload!.title as string,
      section: p.payload!.section as string,
      content: p.payload!.content as string,
      contentType: p.payload!.contentType as DocumentChunk['contentType'],
      project: p.payload!.project as string,
      documentId: p.payload!.documentId as string,
      chunkIndex: p.payload!.chunkIndex as number,
      totalChunks: p.payload!.totalChunks as number,
      metadata: p.payload!.metadata as DocumentChunk['metadata']
    }));
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build` in packages/shared
- [ ] Existing tests pass (if any): `npm test` in packages/shared

#### Manual Verification:
- [ ] SQLite schema has new columns after running initialization
- [ ] Qdrant collection accepts new payload fields

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that database migrations work correctly before proceeding to the next phase.

---

## Phase 2: Update Chunking to Populate Ordering Metadata

### Overview
Modify the chunking logic to assign `documentId`, `chunkIndex`, and `totalChunks` to each chunk as they're created.

### Changes Required

#### 1. Add Document ID Generation Utility
**File**: `packages/scraper/src/hash-utils.ts`
**Changes**: Add function to generate document ID from URL

```typescript
import { createHash } from 'crypto';

/**
 * Generate a stable document ID from a URL
 * Used to group chunks from the same source document
 */
export function generateDocumentId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}
```

#### 2. Update Chunker to Assign Ordering Metadata
**File**: `packages/scraper/src/chunker.ts`
**Changes**: Track chunk indices and assign ordering metadata

```typescript
import { generateDocumentId } from './hash-utils.js';

export function chunkContent(chunks: DocumentChunk[]): DocumentChunk[] {
  const result: DocumentChunk[] = [];

  // Group by URL to assign ordering per document
  const byUrl = new Map<string, DocumentChunk[]>();

  for (const chunk of chunks) {
    // ... existing chunking logic (code vs prose, splitting, etc.)
    // Store intermediate results grouped by URL
  }

  // After all chunking, assign ordering metadata
  for (const [url, urlChunks] of byUrl) {
    const documentId = generateDocumentId(url);
    const totalChunks = urlChunks.length;

    urlChunks.forEach((chunk, index) => {
      chunk.documentId = documentId;
      chunk.chunkIndex = index;
      chunk.totalChunks = totalChunks;
    });

    result.push(...urlChunks);
  }

  return result;
}
```

The full refactored function:

```typescript
export function chunkContent(chunks: DocumentChunk[]): DocumentChunk[] {
  // Group input chunks by URL
  const byUrl = new Map<string, DocumentChunk[]>();

  for (const chunk of chunks) {
    const url = chunk.url;
    if (!byUrl.has(url)) {
      byUrl.set(url, []);
    }
    byUrl.get(url)!.push(chunk);
  }

  const result: DocumentChunk[] = [];

  for (const [url, urlChunks] of byUrl) {
    const documentId = generateDocumentId(url);
    const processedChunks: DocumentChunk[] = [];

    for (const chunk of urlChunks) {
      // Code chunks: Use AST-based chunking
      if (chunk.contentType === 'code') {
        if (shouldUseASTChunking(chunk.content)) {
          const astChunks = chunkCodeWithAST(chunk);
          processedChunks.push(...astChunks);
        } else {
          const tokens = estimateTokens(chunk.content);
          if (tokens >= MIN_CHUNK_TOKENS || chunk.content.length > 100) {
            processedChunks.push(chunk);
          }
        }
        continue;
      }

      // Prose chunks: split if too large
      const tokens = estimateTokens(chunk.content);

      if (tokens <= MAX_CHUNK_TOKENS) {
        if (tokens >= MIN_CHUNK_TOKENS) {
          processedChunks.push(chunk);
        }
        continue;
      }

      // Split large prose chunks with overlap
      const subChunks = splitWithOverlap(chunk.content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS);

      for (let i = 0; i < subChunks.length; i++) {
        const subContent = subChunks[i];
        if (estimateTokens(subContent) >= MIN_CHUNK_TOKENS) {
          processedChunks.push({
            ...chunk,
            id: randomUUID(),
            section: subChunks.length > 1
              ? `${chunk.section} (Part ${i + 1}/${subChunks.length})`
              : chunk.section,
            content: subContent
          });
        }
      }
    }

    // Assign ordering metadata to all chunks from this URL
    const totalChunks = processedChunks.length;
    processedChunks.forEach((chunk, index) => {
      chunk.documentId = documentId;
      chunk.chunkIndex = index;
      chunk.totalChunks = totalChunks;
    });

    result.push(...processedChunks);
  }

  return result;
}
```

#### 3. Update AST Chunker Similarly
**File**: `packages/scraper/src/ast-chunker.ts`
**Changes**: The AST chunker creates new chunks, so ensure they inherit the base chunk's URL for proper grouping. The ordering metadata will be assigned by the parent `chunkContent()` function after AST chunking completes.

No changes needed to `ast-chunker.ts` itself - the ordering is assigned in the main `chunkContent()` function after AST chunking.

### Success Criteria

#### Automated Verification:
- [ ] Scraper package builds: `npm run build` in packages/scraper
- [ ] Can run scraper in dry-run mode: `npm run scraper -- -p mina --dry-run`

#### Manual Verification:
- [ ] Add console.log to verify chunks have documentId, chunkIndex, totalChunks populated
- [ ] Verify chunks from same URL share the same documentId
- [ ] Verify chunkIndex is sequential (0, 1, 2, ...)

**Implementation Note**: After completing this phase, test by running the scraper on a single URL and inspecting the generated chunks before proceeding.

---

## Phase 3: Create Adjacent Chunk Expansion Module

### Overview
Create a new module that takes search results and expands them with adjacent chunks based on content type. This module will be called after search but before reranking.

### Changes Required

#### 1. Create Adjacent Chunk Configuration
**File**: `packages/shared/src/adjacent-chunks.ts` (new file)

```typescript
import type { DocumentChunk, SearchResult } from './types.js';
import type { FullTextDB } from './db/fts.js';

/**
 * Configuration for adjacent chunk retrieval by content type
 */
export interface AdjacentChunkConfig {
  prose: number;      // Window size for prose chunks
  code: number;       // Window size for code chunks
  'api-reference': number;  // Window size for API reference
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

  // Track all chunks by ID to deduplicate
  const chunkMap = new Map<string, SearchResult>();

  // First, add all original results (they keep their original scores)
  for (const result of results) {
    chunkMap.set(result.chunk.id, result);
  }

  // Then, fetch adjacent chunks for each result
  const adjacentPromises: Promise<void>[] = [];

  for (const result of results) {
    const { chunk } = result;

    // Skip if chunk doesn't have ordering metadata
    if (!chunk.documentId || chunk.chunkIndex === undefined) {
      continue;
    }

    const windowSize = config[chunk.contentType] || config.prose;

    adjacentPromises.push(
      ftsDb.getAdjacentChunks(chunk.documentId, chunk.chunkIndex, windowSize)
        .then(adjacentChunks => {
          for (const adjChunk of adjacentChunks) {
            // Skip if already in map (original result or from another expansion)
            if (chunkMap.has(adjChunk.id)) {
              continue;
            }

            // Add with reduced score to indicate it's context, not a direct match
            // Score is based on distance from the original matched chunk
            const distance = Math.abs(adjChunk.chunkIndex - chunk.chunkIndex);
            const adjacentScore = result.score * (0.5 / distance); // Closer = higher score

            chunkMap.set(adjChunk.id, {
              chunk: adjChunk,
              score: adjacentScore,
              matchType: 'hybrid' // Mark as hybrid since it's context
            });
          }
        })
        .catch(err => {
          console.error(`Failed to fetch adjacent chunks for ${chunk.id}:`, err);
        })
    );
  }

  await Promise.all(adjacentPromises);

  // Convert map back to array, sorted by score
  let expanded = Array.from(chunkMap.values())
    .sort((a, b) => b.score - a.score);

  // Group chunks by documentId and sort within groups by chunkIndex
  // This keeps document context together
  const byDocument = new Map<string, SearchResult[]>();
  for (const result of expanded) {
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

  // Reconstruct expanded array: keep overall score order but group document chunks
  // We'll use the max score in each document group to determine document order
  const docScores = new Map<string, number>();
  for (const [docId, docResults] of byDocument) {
    docScores.set(docId, Math.max(...docResults.map(r => r.score)));
  }

  const sortedDocIds = Array.from(docScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([docId]) => docId);

  expanded = [];
  for (const docId of sortedDocIds) {
    expanded.push(...byDocument.get(docId)!);
    if (expanded.length >= maxTotal) break;
  }

  return expanded.slice(0, maxTotal);
}
```

#### 2. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add export for new module

```typescript
export * from './adjacent-chunks.js';
```

### Success Criteria

#### Automated Verification:
- [ ] Shared package builds: `npm run build` in packages/shared
- [ ] TypeScript types are correctly inferred

#### Manual Verification:
- [ ] Unit test with mock data shows correct adjacent chunk fetching
- [ ] Score reduction for adjacent chunks works as expected
- [ ] Document grouping maintains chunk order

**Implementation Note**: This phase can be tested in isolation with mock data before integrating into the search flow.

---

## Phase 4: Integrate Adjacent Expansion into Search Flow

### Overview
Modify the HybridSearch class and MCP tools to call adjacent chunk expansion after initial search, before reranking.

### Changes Required

#### 1. Update HybridSearch to Support Adjacent Expansion
**File**: `packages/shared/src/search.ts`
**Changes**: Add option to expand with adjacent chunks

```typescript
import { expandWithAdjacentChunks, type AdjacentChunkConfig } from './adjacent-chunks.js';

export interface SearchOptions {
  limit?: number;
  contentType?: 'prose' | 'code' | 'api-reference';
  project?: string;
  mode?: 'hybrid' | 'vector' | 'fts';
  rerank?: boolean;
  rerankTopK?: number;
  // NEW: Adjacent chunk expansion options
  expandAdjacent?: boolean;
  adjacentConfig?: Partial<AdjacentChunkConfig>;
}

export interface HybridSearchOptions {
  vectorDb: VectorDB;
  ftsDb: FullTextDB;
  openaiApiKey: string;
  reranker?: Reranker;
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
      rerankTopK = 10,
      expandAdjacent = false,
      adjacentConfig
    } = options;

    // Fetch more candidates if reranking OR expanding adjacent
    // Adjacent expansion can add many chunks, so we start with fewer initial results
    const fetchLimit = (rerank || expandAdjacent) ? Math.max(limit * 3, 30) : limit;

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

      results = this.reciprocalRankFusion(vectorResults, ftsResults, fetchLimit);
    }

    // NEW: Expand with adjacent chunks before reranking
    if (expandAdjacent && results.length > 0) {
      results = await expandWithAdjacentChunks(results, this.options.ftsDb, {
        config: adjacentConfig,
        maxTotalChunks: rerank ? rerankTopK * 3 : limit * 3 // Give reranker more to work with
      });
    }

    // Apply reranking if enabled and reranker is available
    if (rerank && this.options.reranker && results.length > rerankTopK) {
      results = await this.options.reranker.rerank(query, results, { topK: rerankTopK });
    }

    return results.slice(0, limit);
  }

  // ... rest of class unchanged
}
```

#### 2. Update ask-docs Tool
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Enable adjacent chunk expansion

```typescript
// In the search call (around line 53):
const initialResults = await context.search.search(enhancedQuery, {
  limit: analysis.suggestedLimit,
  project: args.project,
  contentType: analysis.suggestedContentType,
  rerank: true,
  rerankTopK: Math.min(analysis.suggestedLimit, 10),
  expandAdjacent: true,  // NEW: Enable adjacent chunk expansion
  adjacentConfig: {
    prose: 2,
    code: 3,
    'api-reference': 1
  }
});
```

#### 3. Update working-example Tool
**File**: `packages/server/src/tools/working-example.ts`
**Changes**: Enable adjacent chunk expansion for code searches

```typescript
// In the parallel search calls (around line 35):
const [codeResults, proseResults, apiResults] = await Promise.all([
  context.search.search(args.task, {
    limit: 15,
    project: args.project,
    contentType: 'code',
    rerank: true,
    rerankTopK: 8,
    expandAdjacent: true,  // NEW
    adjacentConfig: { code: 4 }  // More context for code examples
  }),
  context.search.search(`${args.task} tutorial guide how to`, {
    limit: 10,
    project: args.project,
    contentType: 'prose',
    rerank: true,
    rerankTopK: 5,
    expandAdjacent: true,  // NEW
  }),
  context.search.search(`${args.task} interface type`, {
    limit: 5,
    project: args.project,
    contentType: 'api-reference',
    rerank: true,
    rerankTopK: 3,
    expandAdjacent: true,  // NEW
  })
]);
```

### Success Criteria

#### Automated Verification:
- [ ] All packages build: `npm run build` from root
- [ ] Server starts without errors: `npm run dev` in packages/server

#### Manual Verification:
- [ ] Query returns chunks with their neighbors grouped together
- [ ] Log output shows adjacent chunks being fetched
- [ ] Response quality improves for queries that span multiple chunks

**Implementation Note**: After this phase, the feature is functionally complete. Test with real queries before proceeding to re-indexing.

---

## Phase 5: Re-index All Documents

### Overview
Update the scraper to re-index all documents with the new ordering metadata. This requires clearing existing data and running a full re-crawl.

### Changes Required

#### 1. Add Re-index Command to Scraper
**File**: `packages/scraper/src/index.ts`
**Changes**: Add `--reindex` flag that clears existing data before indexing

```typescript
// In parseArgs options:
const { values: args } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    list: { type: 'boolean', short: 'l' },
    help: { type: 'boolean', short: 'h' },
    'use-registry': { type: 'boolean', short: 'r' },
    'dry-run': { type: 'boolean', short: 'd' },
    'github-only': { type: 'boolean', short: 'g' },
    'reindex': { type: 'boolean' },  // NEW: Force re-index all documents
  },
  allowPositionals: true
});

// In help text:
console.log(`
  --reindex            Clear existing data and re-index all documents
`);

// In main(), before crawling:
if (args.reindex) {
  console.log('\n⚠️  Re-indexing mode: Clearing existing data for project...');
  await vectorDb.deleteByProject(config.project);
  await ftsDb.deleteByProject(config.project);
  console.log('✓ Existing data cleared');
}
```

#### 2. Create Re-indexing Script
**File**: `scripts/reindex-all.sh` (new file)

```bash
#!/bin/bash
# Re-index all projects with new ordering metadata

set -e

echo "=== Re-indexing all projects with ordering metadata ==="
echo ""

# Get list of projects
PROJECTS=$(npm run --silent scraper -- --list 2>/dev/null | grep "^  -" | cut -d: -f1 | sed 's/  - //')

if [ -z "$PROJECTS" ]; then
  echo "No projects found. Make sure project configs exist."
  exit 1
fi

echo "Found projects:"
echo "$PROJECTS"
echo ""

for PROJECT in $PROJECTS; do
  echo "=== Re-indexing: $PROJECT ==="
  npm run scraper -- --project "$PROJECT" --reindex --use-registry
  echo ""
done

echo "=== Re-indexing complete ==="
```

### Success Criteria

#### Automated Verification:
- [ ] Scraper builds and runs with `--reindex` flag
- [ ] `scripts/reindex-all.sh` executes without errors

#### Manual Verification:
- [ ] After re-indexing, query the database to verify chunks have documentId, chunkIndex, totalChunks
- [ ] Run a test query and verify adjacent chunk retrieval works
- [ ] Compare response quality before and after re-indexing

**Implementation Note**: Re-indexing can take significant time depending on the number of documents. Consider running this overnight or in batches.

---

## Testing Strategy

### Unit Tests
- Test `generateDocumentId()` produces consistent hashes for same URL
- Test `expandWithAdjacentChunks()` with mock database results
- Test score reduction logic for adjacent chunks
- Test deduplication when same chunk appears in multiple expansions

### Integration Tests
- Test full search flow with adjacent expansion enabled
- Test that reranker receives expanded result set
- Test `getAdjacentChunks()` database methods return correct results

### Manual Testing Steps
1. Re-index a small test project with `--reindex` flag
2. Query for a topic that spans multiple chunks (e.g., a tutorial with steps)
3. Verify response includes context from adjacent chunks
4. Compare response quality to before the change
5. Test with different content types (prose, code, API reference)

## Performance Considerations

### Current Approach (Phase 4 "TODO" noted)
- Adjacent chunks are fetched eagerly before reranking
- This adds N database queries per search result (where N = number of unique documentIds)
- Reranker then filters the expanded set

### Future Optimization (Out of Scope for This Plan)
- Consider lazy fetching: only expand chunks that score above a threshold
- Consider caching document chunks in memory during a search session
- Consider batch fetching: group adjacent chunk requests by documentId
- Profile to identify if this becomes a bottleneck

## Migration Notes

- **No backwards compatibility**: Existing chunks without ordering metadata will not benefit from adjacent expansion
- **Full re-index required**: Must run `--reindex` for all projects after deploying
- **Database schema additive**: New columns are nullable, so old data won't break queries

## References

- Current chunker: `packages/scraper/src/chunker.ts:15-68`
- Current types: `packages/shared/src/types.ts:3-42`
- Current search: `packages/shared/src/search.ts:26-62`
- SQLite schema: `packages/shared/src/db/fts.ts:21-60`
- Qdrant schema: `packages/shared/src/db/vector.ts:18-47`
