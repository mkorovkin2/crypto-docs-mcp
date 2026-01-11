---
date: 2026-01-11T12:00:00-08:00
topic: "Re-indexing Behavior and Change Detection"
tags: [research, codebase, indexing, chunks, deduplication, vector-db, qdrant]
status: complete
last_updated: 2026-01-11
---

# Research: Re-indexing Behavior and Change Detection

**Date**: 2026-01-11

## Research Question
How does this codebase deal with re-indexing the same website? What happens if you are reindexing docs from the same project, but they slightly changed? Will chunks be slightly off? How does it deal with this?

## Summary

**The current implementation has a significant architectural gap: there is NO change detection or intelligent re-indexing.** Each scrape run generates fresh random UUIDs for all chunks, meaning:

1. **Re-indexing creates duplicates** - Same content scraped twice produces entirely different chunk IDs
2. **Database grows unbounded** - Each run adds a complete copy of all content
3. **Stale content persists indefinitely** - Removed or updated docs leave orphan chunks
4. **No "slightly off" detection** - The system doesn't even try to compare old vs new content

This is worse than the user's concern about chunks being "slightly off" - the system simply doesn't address re-indexing at all.

## Detailed Findings

### 1. Chunk ID Generation Strategy

All chunks use **random UUIDs** (via `crypto.randomUUID()`) generated fresh on every scrape:

| Source | Location |
|--------|----------|
| Prose chunks | `packages/scraper/src/parser.ts:104` |
| Code blocks | `packages/scraper/src/parser.ts:56` |
| Split sub-chunks | `packages/scraper/src/chunker.ts:57` |
| AST code structures | `packages/scraper/src/ast-chunker.ts:485` |
| GitHub classes | `packages/scraper/src/github-source.ts:249` |
| GitHub functions | `packages/scraper/src/github-source.ts:285` |
| Intelligent scraper | `packages/scraper/src/intelligent-github-scraper.ts:376` |

**Critical implication**: Identical content scraped twice will receive **different IDs**, making upsert operations create new entries rather than update existing ones.

### 2. Database Upsert Behavior

**Qdrant (Vector DB)** at `packages/shared/src/db/vector.ts:44-64`:
```typescript
async upsert(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
  const points = chunks.map((chunk, i) => ({
    id: chunk.id,  // Random UUID - different each scrape!
    vector: embeddings[i],
    payload: { /* chunk data */ }
  }));
  await this.client.upsert(this.collection, { points: batch });
}
```

**SQLite FTS** at `packages/shared/src/db/fts.ts:52-87`:
```typescript
const insertChunk = this.db.prepare(`
  INSERT OR REPLACE INTO chunks (id, url, title, section, content, ...)
  VALUES (?, ?, ?, ?, ?, ...)
`);
```

Both use upsert-by-ID semantics, but since IDs are random, this creates **new rows/points** instead of updating.

### 3. What's Missing: No Change Detection

The codebase has **zero mechanisms** for detecting content changes:

| Feature | Status |
|---------|--------|
| Content hashing (SHA-256, MD5) | Not implemented |
| Last-modified HTTP headers | Ignored (`Cache-Control: no-cache` at `crawler.ts:175`) |
| ETag / conditional requests | Not implemented |
| URL-based deduplication across runs | Not implemented |
| Timestamp comparison | Stored but never compared |
| Database cleanup before re-index | Not implemented |

### 4. Concrete Re-indexing Scenario

**What happens when you re-index a project:**

1. Scraper starts fresh with new `Crawler` instance (`index.ts:213-221`)
2. In-memory visited set is empty (lost from previous run)
3. Crawler fetches all pages again with `Cache-Control: no-cache`
4. Parser creates chunks with **new random UUIDs**
5. Qdrant upsert creates **new points** (old ones remain)
6. SQLite inserts **new rows** (old ones remain)

**Result**: Database has 2x the chunks - both old and new versions exist.

### 5. Database Accumulation Problem

If you run the scraper 5 times on the same unchanged documentation:
- Qdrant: 5 complete copies of all vectors
- SQLite: 5 complete copies of all chunks
- Search results may return duplicates with only `lastScraped` timestamp differing

### 6. Deleted Content Problem

If a documentation page is removed from the source website:
- Old chunks for that page **remain in the database forever**
- No mechanism to identify or clean up orphan chunks
- Search will return outdated results

## Code References

- `packages/scraper/src/chunker.ts:2` - UUID import: `import { randomUUID } from 'crypto'`
- `packages/shared/src/db/vector.ts:18-42` - Qdrant initialization (no cleanup)
- `packages/shared/src/db/fts.ts:52-87` - SQLite upsert (ID-based only)
- `packages/scraper/src/index.ts:184-208` - `processBatch()` function
- `packages/scraper/src/crawler.ts:23` - `visited = new Set<string>()` (session-only)
- `packages/shared/src/types.ts:14` - `lastScraped` metadata (never compared)

## Architecture Insights

### Current Design Pattern: "Full Replace" (But Not Actually Replacing)

The system appears designed for a "full re-index" workflow but doesn't actually implement the "replace" part. The expected workflow would be:

1. Delete all chunks for a project
2. Re-scrape everything
3. Insert fresh chunks

But only step 2-3 are implemented, missing the critical step 1.

### Why Random UUIDs Were Chosen

Random UUIDs were likely chosen for simplicity - they guarantee uniqueness without needing to compute content hashes. This works fine for single-run indexing but breaks for re-indexing scenarios.

### Possible Solutions

1. **Content-addressable IDs**: Hash `(url + content)` or `(url + section + content)` for deterministic IDs
2. **Project-scoped cleanup**: Delete all chunks for a project before re-indexing
3. **Incremental with timestamps**: Compare `lastScraped` against source `Last-Modified`
4. **URL-based deduplication**: Use URL + section as primary key instead of random ID

## Open Questions

1. Is the database accumulation intentional (keeping historical versions)?
2. Should we implement content hashing for deterministic chunk IDs?
3. Should re-indexing automatically clean up the project's existing chunks first?
4. How do we handle chunks from deleted/moved pages?

## Recommendations

### Quick Fix: Add Project Cleanup Before Re-index

Add a `deleteByProject(project: string)` method to both VectorDB and FullTextDB, call it at the start of each scrape run.

### Medium-term: Content-Addressable Chunk IDs

Change ID generation from:
```typescript
id: randomUUID()
```
To:
```typescript
id: createHash('sha256').update(`${url}:${section}:${content}`).digest('hex').slice(0, 32)
```

This makes chunks with identical content at the same URL/section receive the same ID, enabling true upsert behavior.

### Long-term: Incremental Indexing

Implement proper change detection:
1. Store content hashes in database
2. Fetch with `If-None-Match` / `If-Modified-Since` headers
3. Only re-process changed pages
4. Mark chunks as "stale" if source page no longer exists
