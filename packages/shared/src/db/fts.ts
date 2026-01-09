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
  }

  async upsert(chunks: DocumentChunk[]): Promise<void> {
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, url, title, section, content, content_type, project, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
          chunk.title,
          chunk.section,
          chunk.content,
          chunk.contentType,
          chunk.project,
          JSON.stringify(chunk.metadata)
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
          title: row.title,
          section: row.section,
          content: row.content,
          contentType: row.content_type,
          project: row.project,
          metadata: JSON.parse(row.metadata)
        },
        score: Math.abs(row.score) // BM25 returns negative scores
      }));
    } catch (error) {
      console.error('FTS search error:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
