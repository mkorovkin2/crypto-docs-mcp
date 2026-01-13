import Database from 'better-sqlite3';
import type { DocumentChunk } from '../types.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export interface FullTextDBOptions {
  path: string;
}

export class FullTextDB {
  private db: Database.Database;

  constructor(private options: FullTextDBOptions) {
    // Ensure directory exists
    mkdirSync(dirname(options.path), { recursive: true });
    this.db = new Database(options.path);
  }

  async initialize(): Promise<void> {
    // Create main table with project column
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        page_id TEXT,
        chunk_index INTEGER,
        chunk_total INTEGER,
        char_start INTEGER,
        char_end INTEGER,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        project TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for project filtering
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project)
    `);

    // Index for adjacency lookups by page and position
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_page_pos ON chunks(page_id, chunk_index)
    `);

    // Add orphaned column if it doesn't exist (migration for existing databases)
    const columns = this.db.prepare("PRAGMA table_info(chunks)").all() as Array<{name: string}>;
    if (!columns.some(c => c.name === 'orphaned')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN orphaned INTEGER DEFAULT 0`);
    }
    if (!columns.some(c => c.name === 'page_id')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN page_id TEXT`);
    }
    if (!columns.some(c => c.name === 'chunk_index')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN chunk_index INTEGER`);
    }
    if (!columns.some(c => c.name === 'chunk_total')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN chunk_total INTEGER`);
    }
    if (!columns.some(c => c.name === 'char_start')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN char_start INTEGER`);
    }
    if (!columns.some(c => c.name === 'char_end')) {
      this.db.exec(`ALTER TABLE chunks ADD COLUMN char_end INTEGER`);
    }

    // Create index for URL-based deletion
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url)
    `);

    // Create FTS5 virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        title,
        section,
        content,
        content_id UNINDEXED,
        tokenize='porter unicode61'
      )
    `);

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

    // Index for project-based queries on page_hashes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_page_hashes_project ON page_hashes(project)
    `);
  }

  async upsert(chunks: DocumentChunk[]): Promise<void> {
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (
        id,
        url,
        page_id,
        chunk_index,
        chunk_total,
        char_start,
        char_end,
        title,
        section,
        content,
        content_type,
        project,
        metadata,
        orphaned
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const deleteFts = this.db.prepare(`
      DELETE FROM chunks_fts WHERE content_id = ?
    `);

    const insertFts = this.db.prepare(`
      INSERT INTO chunks_fts (title, section, content, content_id)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        insertChunk.run(
          chunk.id,
          chunk.url,
          chunk.pageId || chunk.url,
          chunk.chunkIndex ?? null,
          chunk.chunkTotal ?? null,
          chunk.charStart ?? null,
          chunk.charEnd ?? null,
          chunk.title,
          chunk.section,
          chunk.content,
          chunk.contentType,
          chunk.project,
          JSON.stringify(chunk.metadata),
          chunk.metadata.orphaned ? 1 : 0
        );

        // Update FTS index
        deleteFts.run(chunk.id);
        insertFts.run(chunk.title, chunk.section, chunk.content, chunk.id);
      }
    });

    transaction(chunks);
  }

  async search(
    query: string,
    options: { limit?: number; contentType?: string; project?: string } = {}
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const { limit = 10, contentType, project } = options;

    // Escape special FTS5 characters and format query
    const escapedQuery = query
      .replace(/["\-*]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => `"${word}"`)
      .join(' OR ');

    if (!escapedQuery) {
      return [];
    }

    let sql = `
      SELECT
        c.*,
        bm25(chunks_fts) as score
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.content_id
      WHERE chunks_fts MATCH ?
    `;

    const params: any[] = [escapedQuery];

    if (contentType) {
      sql += ` AND c.content_type = ?`;
      params.push(contentType);
    }

    if (project) {
      sql += ` AND c.project = ?`;
      params.push(project);
    }

    sql += ` ORDER BY score LIMIT ?`;
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];

      return rows.map(row => ({
        chunk: {
          id: row.id,
          url: row.url,
          pageId: row.page_id || row.url,
          chunkIndex: row.chunk_index ?? null,
          chunkTotal: row.chunk_total ?? null,
          charStart: row.char_start ?? null,
          charEnd: row.char_end ?? null,
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
        score: Math.abs(row.score) // BM25 returns negative scores
      }));
    } catch (error) {
      console.error('FTS search error:', error);
      return [];
    }
  }

  /**
   * Delete all chunks matching a specific URL
   */
  async deleteByUrl(url: string): Promise<number> {
    const chunks = this.db.prepare('SELECT id FROM chunks WHERE url = ?').all(url) as Array<{id: string}>;
    if (chunks.length === 0) return 0;

    const transaction = this.db.transaction(() => {
      for (const chunk of chunks) {
        this.db.prepare('DELETE FROM chunks_fts WHERE content_id = ?').run(chunk.id);
      }
      this.db.prepare('DELETE FROM chunks WHERE url = ?').run(url);
    });

    transaction();
    return chunks.length;
  }

  /**
   * Delete all chunks for a project
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
   * Get all unique URLs for a project
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
   * Get all indexed URLs for a project (from page_hashes table)
   */
  async getIndexedUrlsForProject(project: string): Promise<string[]> {
    const rows = this.db.prepare('SELECT url FROM page_hashes WHERE project = ?').all(project) as Array<{url: string}>;
    return rows.map(r => r.url);
  }

  /**
   * Delete page hash record
   */
  async deletePageHash(url: string): Promise<void> {
    this.db.prepare('DELETE FROM page_hashes WHERE url = ?').run(url);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  /**
   * Fetch chunks for a page within an index window (inclusive)
   */
  async getAdjacentChunks(
    pageId: string,
    startIndex: number,
    endIndex: number
  ): Promise<DocumentChunk[]> {
    const rows = this.db.prepare(
      `SELECT * FROM chunks
       WHERE page_id = ?
         AND chunk_index IS NOT NULL
         AND chunk_index BETWEEN ? AND ?
       ORDER BY chunk_index ASC`
    ).all(pageId, startIndex, endIndex) as any[];

    return rows.map(row => ({
      id: row.id,
      url: row.url,
      pageId: row.page_id || row.url,
      chunkIndex: row.chunk_index ?? null,
      chunkTotal: row.chunk_total ?? null,
      charStart: row.char_start ?? null,
      charEnd: row.char_end ?? null,
      title: row.title,
      section: row.section,
      content: row.content,
      contentType: row.content_type,
      project: row.project,
      metadata: {
        ...JSON.parse(row.metadata),
        orphaned: row.orphaned === 1
      }
    }));
  }
}
