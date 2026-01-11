# Atomic Re-indexing Implementation Plan

## Overview

Implement content-aware re-indexing with page-level atomic operations. When a page is re-scraped, all old chunks for that URL are deleted before new chunks are inserted. Content hashing detects unchanged pages to skip unnecessary re-processing. Pages not visited during a crawl are marked as "orphaned" (not deleted) and deprioritized in search results.

## Current State Analysis

### What Exists Now
- Chunks use random UUIDs generated fresh each scrape (`parser.ts:56,104`, `chunker.ts:57`)
- Database upsert operations are ID-based, so same content gets new IDs = new entries
- No deletion methods exist in VectorDB or FullTextDB
- No content hash tracking
- Database grows unbounded with each re-index

### Key Discoveries
- `url` field is stored in every chunk and reliably groups chunks by source page
- Qdrant supports deletion by filter (`client.delete()` with payload filter)
- SQLite supports deletion via SQL (`DELETE WHERE url = ?`)
- No URL index exists in either database (would be slow for large datasets)

## Desired End State

After implementation:
1. **Re-indexing a page** atomically deletes all old chunks for that URL before inserting new ones
2. **Unchanged pages** are skipped entirely (detected via content hash)
3. **Deleted/unreachable pages** have their chunks marked as `orphaned: true`
4. **Search results** deprioritize orphaned chunks via score penalty in RRF

### Verification
- Run scraper twice on same project: total chunk count should NOT double
- Modify one page's content, re-run: only that page's chunks should be replaced
- Remove a page from sitemap, re-run: old chunks marked orphaned, not deleted

## What We're NOT Doing

- **NOT** implementing incremental crawling with HTTP caching (If-Modified-Since, ETags)
- **NOT** implementing content diffing (we re-chunk entirely if hash changes)
- **NOT** automatically deleting orphaned chunks (user can implement cleanup later)
- **NOT** changing chunk ID generation strategy (keeping random UUIDs)

## Implementation Approach

The strategy is "delete-before-insert" at the URL level:
1. Before processing a page, compute content hash
2. Compare to stored hash - if unchanged, skip
3. If changed or new, delete all existing chunks for that URL
4. Parse, chunk, embed, and insert new chunks
5. Update stored hash
6. After crawl completes, mark chunks from unvisited URLs as orphaned

---

## Phase 1: Add Orphaned Field to Type and Databases

### Overview
Add an `orphaned` boolean field to track chunks from pages that no longer exist or weren't visited in the latest crawl.

### Changes Required:

#### 1. Update DocumentChunk Type
**File**: `packages/shared/src/types.ts`
**Changes**: Add `orphaned` field to metadata

```typescript
// After line 38 (inside metadata object), add:
    /** True if this chunk's source URL was not visited in the latest crawl */
    orphaned?: boolean;
```

#### 2. Update SQLite Schema
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Add `orphaned` column to chunks table

In the `initialize()` method, after the CREATE TABLE statement (around line 33), add migration logic:

```typescript
// After line 33, add:
    // Add orphaned column if it doesn't exist (migration)
    const columns = this.db.prepare("PRAGMA table_info(chunks)").all() as Array<{name: string}>;
    if (!columns.some(c => c.name === 'orphaned')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN orphaned INTEGER DEFAULT 0`);
    }
```

Update the INSERT statement in `upsert()` (line 53-55) to include orphaned:

```typescript
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, url, title, section, content, content_type, project, metadata, orphaned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
```

And update the run call (line 69-78) to pass orphaned value:

```typescript
        insertChunk.run(
          chunk.id,
          chunk.url,
          chunk.title,
          chunk.section,
          chunk.content,
          chunk.contentType,
          chunk.project,
          JSON.stringify(chunk.metadata),
          chunk.metadata.orphaned ? 1 : 0
        );
```

#### 3. Update Qdrant Payload
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Include orphaned in payload

In `upsert()` method (line 48-56), add orphaned to payload:

```typescript
      payload: {
        url: chunk.url,
        title: chunk.title,
        section: chunk.section,
        content: chunk.content,
        contentType: chunk.contentType,
        project: chunk.project,
        metadata: chunk.metadata,
        orphaned: chunk.metadata.orphaned || false  // Add this line
      }
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Existing tests pass (if any): `npm test`

#### Manual Verification:
- [ ] Run scraper on a small project, verify chunks are created
- [ ] Inspect SQLite: `sqlite3 data/crypto_docs.db "SELECT orphaned FROM chunks LIMIT 5"` shows 0 values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Add URL Index and Deletion Methods

### Overview
Add URL indexes for efficient deletion and implement `deleteByUrl()` and `markOrphanedByProject()` methods in both database classes.

### Changes Required:

#### 1. Add URL Index to SQLite
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Create index on URL column in `initialize()`

After the project index creation (line 38), add:

```typescript
    // Create index for URL-based deletion
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url)
    `);
```

#### 2. Add URL Index to Qdrant
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Create payload index on URL field in `initialize()`

After the project index creation (line 37-40), add:

```typescript
      // Create URL index for efficient deletion
      await this.client.createPayloadIndex(this.collection, {
        field_name: 'url',
        field_schema: 'keyword'
      });
```

#### 3. Add Deletion Methods to VectorDB
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Add `deleteByUrl()` and `markOrphanedByUrls()` methods

After the `search()` method (after line 102), add:

```typescript
  /**
   * Delete all points (chunks) matching a specific URL
   * @returns Number of points deleted
   */
  async deleteByUrl(url: string): Promise<number> {
    const result = await this.client.delete(this.collection, {
      filter: {
        must: [{ key: 'url', match: { value: url } }]
      }
    });
    return result.status === 'completed' ? 1 : 0; // Qdrant doesn't return count
  }

  /**
   * Delete all points for a project
   * @returns Number of points deleted
   */
  async deleteByProject(project: string): Promise<number> {
    const result = await this.client.delete(this.collection, {
      filter: {
        must: [{ key: 'project', match: { value: project } }]
      }
    });
    return result.status === 'completed' ? 1 : 0;
  }

  /**
   * Get all unique URLs for a project (for orphan detection)
   */
  async getUrlsForProject(project: string): Promise<string[]> {
    const urls = new Set<string>();
    let offset: string | number | undefined = undefined;

    // Scroll through all points for this project
    while (true) {
      const result = await this.client.scroll(this.collection, {
        filter: {
          must: [{ key: 'project', match: { value: project } }]
        },
        limit: 100,
        offset,
        with_payload: ['url']
      });

      for (const point of result.points) {
        if (point.payload?.url) {
          urls.add(point.payload.url as string);
        }
      }

      if (!result.next_page_offset) break;
      offset = result.next_page_offset;
    }

    return Array.from(urls);
  }

  /**
   * Mark all chunks for given URLs as orphaned
   */
  async markOrphaned(urls: string[], orphaned: boolean): Promise<void> {
    for (const url of urls) {
      await this.client.setPayload(this.collection, {
        payload: { orphaned },
        filter: {
          must: [{ key: 'url', match: { value: url } }]
        }
      });
    }
  }
```

#### 4. Add Deletion Methods to FullTextDB
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Add `deleteByUrl()` and `markOrphanedByUrls()` methods

After the `search()` method (after line 151), add:

```typescript
  /**
   * Delete all chunks matching a specific URL
   * @returns Number of chunks deleted
   */
  async deleteByUrl(url: string): Promise<number> {
    // Get chunk IDs for this URL
    const chunks = this.db.prepare('SELECT id FROM chunks WHERE url = ?').all(url) as Array<{id: string}>;

    if (chunks.length === 0) return 0;

    const transaction = this.db.transaction(() => {
      // Delete from FTS index
      for (const chunk of chunks) {
        this.db.prepare('DELETE FROM chunks_fts WHERE content_id = ?').run(chunk.id);
      }
      // Delete from main table
      this.db.prepare('DELETE FROM chunks WHERE url = ?').run(url);
    });

    transaction();
    return chunks.length;
  }

  /**
   * Delete all chunks for a project
   * @returns Number of chunks deleted
   */
  async deleteByProject(project: string): Promise<number> {
    const chunks = this.db.prepare('SELECT id FROM chunks WHERE project = ?').all(project) as Array<{id: string}>;

    if (chunks.length === 0) return 0;

    const transaction = this.db.transaction(() => {
      for (const chunk of chunks) {
        this.db.prepare('DELETE FROM chunks_fts WHERE content_id = ?').run(chunk.id);
      }
      this.db.prepare('DELETE FROM chunks WHERE project = ?').run(project);
    });

    transaction();
    return chunks.length;
  }

  /**
   * Get all unique URLs for a project (for orphan detection)
   */
  async getUrlsForProject(project: string): Promise<string[]> {
    const rows = this.db.prepare('SELECT DISTINCT url FROM chunks WHERE project = ?').all(project) as Array<{url: string}>;
    return rows.map(r => r.url);
  }

  /**
   * Mark all chunks for given URLs as orphaned
   */
  async markOrphaned(urls: string[], orphaned: boolean): Promise<void> {
    const stmt = this.db.prepare('UPDATE chunks SET orphaned = ? WHERE url = ?');
    const transaction = this.db.transaction(() => {
      for (const url of urls) {
        stmt.run(orphaned ? 1 : 0, url);
      }
    });
    transaction();
  }
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Existing tests pass: `npm test`

#### Manual Verification:
- [ ] Run scraper to create some chunks
- [ ] Test deletion via node REPL:
  ```javascript
  const { FullTextDB } = require('@mina-docs/shared');
  const db = new FullTextDB({ path: './data/crypto_docs.db' });
  await db.initialize();
  const count = await db.deleteByUrl('https://some-indexed-url.com');
  console.log(`Deleted ${count} chunks`);
  ```

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Add Page Hash Tracking Table

### Overview
Create a `page_hashes` table in SQLite to track content hashes per URL. This enables skipping unchanged pages during re-indexing.

### Changes Required:

#### 1. Add Page Hashes Table to FullTextDB
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Create `page_hashes` table and add methods

In `initialize()` method, after the indexes (around line 38), add:

```typescript
    // Create page_hashes table for change detection
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS page_hashes (
        url TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        chunk_count INTEGER NOT NULL,
        last_indexed TEXT NOT NULL
      )
    `);

    // Index for project-based queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_page_hashes_project ON page_hashes(project)
    `);
```

After the `markOrphaned()` method, add:

```typescript
  /**
   * Get the stored content hash for a URL
   */
  async getPageHash(url: string): Promise<string | null> {
    const row = this.db.prepare('SELECT content_hash FROM page_hashes WHERE url = ?').get(url) as {content_hash: string} | undefined;
    return row?.content_hash || null;
  }

  /**
   * Update or insert the content hash for a URL
   */
  async setPageHash(url: string, project: string, contentHash: string, chunkCount: number): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO page_hashes (url, project, content_hash, chunk_count, last_indexed)
      VALUES (?, ?, ?, ?, ?)
    `).run(url, project, contentHash, chunkCount, new Date().toISOString());
  }

  /**
   * Get all indexed URLs for a project (for orphan detection)
   */
  async getIndexedUrlsForProject(project: string): Promise<string[]> {
    const rows = this.db.prepare('SELECT url FROM page_hashes WHERE project = ?').all(project) as Array<{url: string}>;
    return rows.map(r => r.url);
  }

  /**
   * Delete page hash record (when page is confirmed deleted)
   */
  async deletePageHash(url: string): Promise<void> {
    this.db.prepare('DELETE FROM page_hashes WHERE url = ?').run(url);
  }
```

#### 2. Add Content Hash Utility Function
**File**: `packages/scraper/src/hash-utils.ts` (NEW FILE)
**Changes**: Create utility for computing content hashes

```typescript
import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of content
 * Used for detecting page content changes
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] New file exists: `packages/scraper/src/hash-utils.ts`

#### Manual Verification:
- [ ] Run scraper briefly, then check table exists:
  ```bash
  sqlite3 data/crypto_docs.db ".schema page_hashes"
  ```

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Integrate Atomic Re-indexing into Documentation Scraper

### Overview
Modify the main scraper loop to:
1. Check content hash before processing
2. Delete old chunks for URL before inserting new ones
3. Track visited URLs for orphan detection

### Changes Required:

#### 1. Update Scraper Main Loop
**File**: `packages/scraper/src/index.ts`
**Changes**: Add hash checking, atomic deletion, and orphan tracking

Add imports at the top (after line 9):

```typescript
import { computeContentHash } from './hash-utils.js';
```

Add visited URL tracking after the `startTime` declaration (around line 178):

```typescript
  // Track visited URLs for orphan detection
  const visitedUrls = new Set<string>();
```

Replace the documentation crawl loop (lines 226-255) with:

```typescript
    // Crawl and process pages
    for await (const page of crawler.crawl()) {
      processedPages++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${elapsed}s] Processing (${processedPages}/${config.maxPages}): ${page.url}`);

      // Track this URL as visited
      visitedUrls.add(page.url);

      try {
        // Check content hash - skip if unchanged
        const contentHash = computeContentHash(page.html);
        const existingHash = await ftsDb.getPageHash(page.url);

        if (existingHash === contentHash) {
          console.log(`  ⊘ Content unchanged, skipping`);
          continue;
        }

        // Content changed or new - delete old chunks first
        if (existingHash) {
          const deletedVector = await vectorDb.deleteByUrl(page.url);
          const deletedFts = await ftsDb.deleteByUrl(page.url);
          console.log(`  ↻ Content changed, deleted old chunks`);
        }

        // Parse HTML into chunks with project identifier
        const rawChunks = parseDocumentation(page.url, page.html, config.project);

        if (rawChunks.length === 0) {
          console.log(`  ⚠ No content extracted, skipping`);
          // Update hash even for empty pages to avoid re-processing
          await ftsDb.setPageHash(page.url, config.project, contentHash, 0);
          continue;
        }

        // Apply semantic chunking
        const chunks = chunkContent(rawChunks);
        console.log(`  ✓ Extracted ${chunks.length} chunks`);

        // Add to pending batch
        pendingChunks.push(...chunks);

        // Process batch if large enough
        if (pendingChunks.length >= EMBEDDING_BATCH_SIZE) {
          await processBatch();
        }

        // Update page hash after successful processing
        await ftsDb.setPageHash(page.url, config.project, contentHash, chunks.length);

      } catch (error) {
        failedPages++;
        console.error(`  ✗ Error:`, error instanceof Error ? error.message : error);
      }
    }

    // Process remaining chunks
    await processBatch();
```

After the documentation crawl section (after line 258, before GitHub scraping), add orphan detection:

```typescript
    // Mark orphaned chunks (pages not visited in this crawl)
    console.log('\nDetecting orphaned pages...');
    const indexedUrls = await ftsDb.getIndexedUrlsForProject(config.project);
    const orphanedUrls = indexedUrls.filter(url => !visitedUrls.has(url));

    if (orphanedUrls.length > 0) {
      console.log(`  Found ${orphanedUrls.length} orphaned URLs, marking chunks...`);
      await vectorDb.markOrphaned(orphanedUrls, true);
      await ftsDb.markOrphaned(orphanedUrls, true);
      console.log(`  ✓ Marked ${orphanedUrls.length} URLs as orphaned`);
    } else {
      console.log(`  ✓ No orphaned pages detected`);
    }

    // Un-orphan visited URLs that were previously orphaned
    const revisitedUrls = Array.from(visitedUrls);
    await vectorDb.markOrphaned(revisitedUrls, false);
    await ftsDb.markOrphaned(revisitedUrls, false);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`

#### Manual Verification:
- [ ] Run scraper on a project: `npm run scraper -- -p mina`
- [ ] Run scraper again immediately: should see "Content unchanged, skipping" for most pages
- [ ] Check page_hashes table has entries: `sqlite3 data/crypto_docs.db "SELECT COUNT(*) FROM page_hashes"`
- [ ] Check chunk count didn't double between runs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Integrate Atomic Re-indexing into GitHub Scraper

### Overview
Apply the same atomic re-indexing pattern to GitHub source scraping. GitHub files use URLs like `https://github.com/org/repo/blob/branch/path/file.ts`.

### Changes Required:

#### 1. Update Intelligent GitHub Scraper
**File**: `packages/scraper/src/intelligent-github-scraper.ts`
**Changes**: Add hash checking and atomic deletion per file

Add import at the top:

```typescript
import { computeContentHash } from './hash-utils.js';
```

The intelligent scraper returns chunks in batch. We need to modify `scrapeProjectGitHubSources()` to accept database instances and perform atomic operations.

Update the function signature and add hash checking in the scrape loop. In the `scrape()` method of `IntelligentGitHubScraper` class, around where chunks are created:

```typescript
// Before creating chunks for a file, compute hash and check for changes
const fileUrl = `https://github.com/${this.repo}/${this.branch}/${filePath}`;
const contentHash = computeContentHash(content);

// This will need to be coordinated with the caller
// For now, include hash in the chunk metadata
```

**Alternative Approach (Simpler)**: Since GitHub scraping is already batch-oriented, modify the main `index.ts` to delete all chunks for a GitHub source before re-indexing:

**File**: `packages/scraper/src/index.ts`

In the intelligent GitHub scraping section (around line 289), before processing results:

```typescript
        // Delete existing chunks for each source before re-indexing
        for (const result of results) {
          // Delete all chunks from this source
          const sourceUrls = await ftsDb.getUrlsForProject(config.project);
          const sourcePrefix = `https://github.com/${result.sourceId}`;
          const urlsToDelete = sourceUrls.filter(u => u.includes(sourcePrefix));

          for (const url of urlsToDelete) {
            await vectorDb.deleteByUrl(url);
            await ftsDb.deleteByUrl(url);
          }
          console.log(`  Cleared ${urlsToDelete.length} old URLs for ${result.sourceId}`);

          // ... existing indexing code ...
        }
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`

#### Manual Verification:
- [ ] Run scraper with GitHub sources: `npm run scraper -- -p mina --use-registry`
- [ ] Run again: should not double chunk count
- [ ] Verify chunks replaced properly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 6: Deprioritize Orphaned Chunks in Search

### Overview
Modify the search/reranking logic to apply a score penalty to orphaned chunks, pushing them lower in results.

### Changes Required:

#### 1. Update VectorDB Search to Return Orphaned Flag
**File**: `packages/shared/src/db/vector.ts`
**Changes**: Include orphaned in returned chunks

In `search()` method (around line 89-101), update the return mapping:

```typescript
    return results.map(result => ({
      chunk: {
        id: result.id as string,
        url: result.payload!.url as string,
        title: result.payload!.title as string,
        section: result.payload!.section as string,
        content: result.payload!.content as string,
        contentType: result.payload!.contentType as DocumentChunk['contentType'],
        project: result.payload!.project as string,
        metadata: {
          ...(result.payload!.metadata as DocumentChunk['metadata']),
          orphaned: result.payload!.orphaned as boolean || false
        }
      },
      score: result.score
    }));
```

#### 2. Update FullTextDB Search to Return Orphaned Flag
**File**: `packages/shared/src/db/fts.ts`
**Changes**: Include orphaned in returned chunks

In `search()` method, update the SELECT statement (around line 108-113):

```typescript
    let sql = `
      SELECT
        c.*,
        c.orphaned,
        bm25(chunks_fts) as score
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.content_id
      WHERE chunks_fts MATCH ?
    `;
```

And update the return mapping (around line 134-144):

```typescript
      return rows.map(row => ({
        chunk: {
          id: row.id,
          url: row.url,
          title: row.title,
          section: row.section,
          content: row.content,
          contentType: row.content_type,
          project: row.project,
          metadata: {
            ...JSON.parse(row.metadata),
            orphaned: row.orphaned === 1
          }
        },
        score: Math.abs(row.score)
      }));
```

#### 3. Apply Orphan Penalty in RRF
**File**: `packages/shared/src/search.ts`
**Changes**: Penalize orphaned chunks in `reciprocalRankFusion()`

In the `reciprocalRankFusion()` method (around line 106-145), add orphan penalty:

```typescript
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
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`

#### Manual Verification:
- [ ] Search for a term that appears in both active and orphaned chunks
- [ ] Verify orphaned chunks appear lower in results than equivalent active chunks
- [ ] Orphaned chunks should still appear, just deprioritized

**Implementation Note**: After completing this phase, the full atomic re-indexing system is complete.

---

## Testing Strategy

### Unit Tests:
- `computeContentHash()` produces consistent hashes for same content
- `deleteByUrl()` removes all chunks for a URL from both databases
- `markOrphaned()` correctly sets orphaned flag

### Integration Tests:
- Full re-index cycle: scrape → re-scrape unchanged → verify no duplicates
- Content change detection: modify page → re-scrape → verify old chunks deleted
- Orphan detection: remove page from crawl → verify chunks marked orphaned

### Manual Testing Steps:
1. Run scraper on a project
2. Note the chunk count
3. Run scraper again immediately
4. Verify chunk count is the same (not doubled)
5. Manually modify a page's HTML in the crawl cache (or wait for actual change)
6. Re-run scraper
7. Verify only changed page's chunks were replaced
8. Search for content and verify orphaned chunks appear lower

## Performance Considerations

- **URL Index**: Essential for efficient `deleteByUrl()`. Without it, Qdrant/SQLite would scan all records.
- **Batch Orphan Marking**: The `markOrphaned()` method loops through URLs individually. For large projects with many orphaned URLs, consider batching.
- **Hash Table Size**: The `page_hashes` table grows with unique URLs but is small (one row per URL, not per chunk).

## Migration Notes

- **Existing Data**: First run after deployment will:
  - Add `orphaned` column to SQLite (defaults to 0/false)
  - Create `page_hashes` table (empty)
  - Create URL indexes
  - All existing chunks will be treated as "changed" (no hash match) and re-indexed
- **First Full Re-index**: Expected after deployment to populate hashes and clean up duplicates

## References

- Related research: `thoughts/shared/research/2026-01-11-reindexing-behavior.md`
- VectorDB implementation: `packages/shared/src/db/vector.ts`
- FullTextDB implementation: `packages/shared/src/db/fts.ts`
- Scraper main loop: `packages/scraper/src/index.ts:226-258`
- Search/RRF: `packages/shared/src/search.ts:106-145`
