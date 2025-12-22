# Mina Protocol Documentation MCP Server - Implementation Plan

## Overview

Build a proof-of-concept multi-component system that serves Mina Protocol developer documentation to AI coding agents (Claude Code, Cursor, etc.) via the Model Context Protocol (MCP). The system enables web3 developers with limited Mina knowledge to get contextual documentation, code examples, and debugging assistance while coding.

## Current State Analysis

- **Project**: Empty repository with only a README stub
- **Target**: docs.minaprotocol.com + GitHub repos (o1js, zkapp-cli)
- **Key Documentation Areas**:
  - zkApp development with o1js (TypeScript ZK framework)
  - Smart contract patterns and examples
  - Deployment and testing guides
  - Node operation documentation
  - API references

## Desired End State

A working PoC system with three components:

1. **Document Scraper**: Crawls Mina documentation, chunks content semantically, generates embeddings, and populates databases
2. **Database Layer**: Qdrant (vector search) + SQLite with FTS5 (full-text search)
3. **MCP HTTP Server**: Exposes documentation via MCP protocol with tools for search, examples, concepts, and debugging

### Verification:
- Scraper successfully indexes docs.minaprotocol.com content
- MCP server responds to tool calls with relevant documentation
- Integration works with Claude Desktop or Cursor

## What We're NOT Doing

- Production-grade scalability or deployment infrastructure
- Authentication/authorization
- Real-time documentation sync (manual re-scrape for updates)
- Comprehensive test coverage (basic integration tests only)
- UI/dashboard for managing indexed content
- Support for multiple blockchain documentation (Mina only)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Monorepo Structure                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │  packages/      │                                                │
│  │  scraper/       │──────────┐                                     │
│  │                 │          │                                     │
│  │  - Crawler      │          ▼                                     │
│  │  - Parser       │   ┌──────────────┐    ┌──────────────┐        │
│  │  - Chunker      │   │   Qdrant     │    │   SQLite     │        │
│  │  - Embedder     │──▶│   (Vector)   │    │   (FTS5)     │        │
│  └─────────────────┘   └──────────────┘    └──────────────┘        │
│                               │                   │                 │
│                               └─────────┬─────────┘                 │
│                                         │                           │
│  ┌─────────────────┐                    │                           │
│  │  packages/      │                    │                           │
│  │  server/        │◀───────────────────┘                           │
│  │                 │                                                │
│  │  - MCP HTTP     │                                                │
│  │  - Tools        │◀──── Coding Agents (Claude, Cursor)           │
│  │  - Resources    │                                                │
│  └─────────────────┘                                                │
│                                                                     │
│  ┌─────────────────┐                                                │
│  │  packages/      │                                                │
│  │  shared/        │  (Types, utilities, DB clients)                │
│  └─────────────────┘                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Approach

- **Monorepo with npm workspaces** for code sharing between components
- **TypeScript** throughout for type safety
- **Qdrant** (Docker) for vector search - production-ready, easy local setup
- **SQLite + better-sqlite3** with FTS5 for full-text search - zero external deps
- **OpenAI text-embedding-3-small** for embeddings (cost-effective, good quality)
- **Cheerio** for HTML parsing, **node-fetch** for crawling
- **@modelcontextprotocol/sdk** for MCP server implementation

---

## Phase 1: Project Setup & Infrastructure

### Overview
Set up the monorepo structure, shared configurations, and database infrastructure.

### Changes Required:

#### 1. Root Package Configuration
**File**: `package.json`

```json
{
  "name": "mina-docs-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "clean": "rm -rf packages/*/dist",
    "scraper": "npm run start -w packages/scraper",
    "server": "npm run start -w packages/server",
    "dev:server": "npm run dev -w packages/server"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

#### 2. TypeScript Configuration
**File**: `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

#### 3. Shared Package
**File**: `packages/shared/package.json`

```json
{
  "name": "@mina-docs/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@qdrant/js-client-rest": "^1.7.0",
    "better-sqlite3": "^11.0.0",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8"
  }
}
```

**File**: `packages/shared/src/index.ts`

```typescript
export * from './types.js';
export * from './db/vector.js';
export * from './db/fts.js';
export * from './embeddings.js';
```

**File**: `packages/shared/src/types.ts`

```typescript
export interface DocumentChunk {
  id: string;
  url: string;
  title: string;
  section: string;
  content: string;
  contentType: 'prose' | 'code' | 'api-reference';
  metadata: {
    headings: string[];
    codeLanguage?: string;
    lastScraped: string;
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  matchType: 'vector' | 'fts' | 'hybrid';
}

export interface EmbeddingResult {
  id: string;
  embedding: number[];
}
```

#### 4. Docker Compose for Qdrant
**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334

volumes:
  qdrant_storage:
```

#### 5. Environment Configuration
**File**: `.env.example`

```bash
# OpenAI API Key for embeddings
OPENAI_API_KEY=sk-...

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=mina_docs

# SQLite Database Path
SQLITE_PATH=./data/mina_docs.db

# MCP Server Configuration
MCP_PORT=3000
MCP_HOST=localhost

# Scraper Configuration
SCRAPER_BASE_URL=https://docs.minaprotocol.com
SCRAPER_CONCURRENCY=5
SCRAPER_DELAY_MS=500
```

#### 6. Directory Structure Creation
```bash
mkdir -p packages/{shared,scraper,server}/src
mkdir -p data
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles all packages
- [ ] `docker-compose up -d` starts Qdrant successfully
- [ ] Qdrant health check passes: `curl http://localhost:6333/health`

#### Manual Verification:
- [ ] Project structure matches the architecture diagram
- [ ] TypeScript compilation produces correct output in `dist/` folders

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Document Scraper Service

### Overview
Build the standalone scraper that crawls docs.minaprotocol.com, parses content, chunks it semantically, and stores in databases.

### Changes Required:

#### 1. Scraper Package Configuration
**File**: `packages/scraper/package.json`

```json
{
  "name": "@mina-docs/scraper",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "scrape": "node dist/index.js --full"
  },
  "dependencies": {
    "@mina-docs/shared": "*",
    "cheerio": "^1.0.0-rc.12",
    "node-fetch": "^3.3.2",
    "p-limit": "^5.0.0",
    "dotenv": "^16.3.1"
  }
}
```

#### 2. Web Crawler
**File**: `packages/scraper/src/crawler.ts`

```typescript
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

export interface CrawlResult {
  url: string;
  html: string;
  title: string;
  links: string[];
}

export interface CrawlerOptions {
  baseUrl: string;
  concurrency: number;
  delayMs: number;
  maxPages?: number;
}

export class Crawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private limit: ReturnType<typeof pLimit>;

  constructor(private options: CrawlerOptions) {
    this.limit = pLimit(options.concurrency);
  }

  async crawl(): AsyncGenerator<CrawlResult> {
    this.queue.push(this.options.baseUrl);

    while (this.queue.length > 0) {
      const url = this.queue.shift()!;

      if (this.visited.has(url)) continue;
      if (this.options.maxPages && this.visited.size >= this.options.maxPages) break;

      this.visited.add(url);

      try {
        const result = await this.fetchPage(url);

        // Add new links to queue
        for (const link of result.links) {
          if (!this.visited.has(link) && this.isValidUrl(link)) {
            this.queue.push(link);
          }
        }

        yield result;

        // Rate limiting
        await this.delay(this.options.delayMs);
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }
  }

  private async fetchPage(url: string): Promise<CrawlResult> {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text() || $('h1').first().text() || url;

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const absoluteUrl = new URL(href, url).toString();
        links.push(absoluteUrl);
      }
    });

    return { url, html, title, links };
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const base = new URL(this.options.baseUrl);

      // Only crawl same domain
      if (parsed.hostname !== base.hostname) return false;

      // Skip non-documentation pages
      if (parsed.pathname.includes('/api/') && !parsed.pathname.includes('/zkapps/')) return false;
      if (parsed.pathname.endsWith('.pdf')) return false;
      if (parsed.pathname.endsWith('.zip')) return false;

      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 3. Content Parser
**File**: `packages/scraper/src/parser.ts`

```typescript
import * as cheerio from 'cheerio';
import type { DocumentChunk } from '@mina-docs/shared';
import { randomUUID } from 'crypto';

export interface ParsedSection {
  heading: string;
  content: string;
  codeBlocks: Array<{ language: string; code: string }>;
}

export function parseDocumentation(url: string, html: string): DocumentChunk[] {
  const $ = cheerio.load(html);
  const chunks: DocumentChunk[] = [];

  // Remove navigation, footer, and other non-content elements
  $('nav, footer, .sidebar, .navigation, script, style').remove();

  // Get the main content area
  const mainContent = $('main, article, .content, .documentation').first();
  const content = mainContent.length ? mainContent : $('body');

  const title = $('h1').first().text().trim() || $('title').text().trim();
  const headings: string[] = [];

  // Process content by sections (split on h2/h3)
  let currentSection = '';
  let currentHeading = title;
  let currentContent = '';

  content.children().each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase();

    if (tagName === 'h2' || tagName === 'h3') {
      // Save previous section if has content
      if (currentContent.trim()) {
        chunks.push(createChunk(url, title, currentHeading, currentContent, headings, $));
      }

      currentHeading = $el.text().trim();
      headings.push(currentHeading);
      currentContent = '';
    } else if (tagName === 'pre' || $el.find('pre').length > 0) {
      // Code block - create separate chunk
      const codeEl = tagName === 'pre' ? $el : $el.find('pre').first();
      const code = codeEl.text().trim();
      const language = detectLanguage(codeEl, $);

      if (code.length > 50) {
        chunks.push({
          id: randomUUID(),
          url,
          title,
          section: currentHeading,
          content: code,
          contentType: 'code',
          metadata: {
            headings: [...headings],
            codeLanguage: language,
            lastScraped: new Date().toISOString()
          }
        });
      }
    } else {
      // Regular content
      const text = $el.text().trim();
      if (text) {
        currentContent += text + '\n\n';
      }
    }
  });

  // Don't forget the last section
  if (currentContent.trim()) {
    chunks.push(createChunk(url, title, currentHeading, currentContent, headings, $));
  }

  return chunks;
}

function createChunk(
  url: string,
  title: string,
  section: string,
  content: string,
  headings: string[],
  $: cheerio.CheerioAPI
): DocumentChunk {
  const isApiRef = url.includes('/reference') || url.includes('/api');

  return {
    id: randomUUID(),
    url,
    title,
    section,
    content: content.trim(),
    contentType: isApiRef ? 'api-reference' : 'prose',
    metadata: {
      headings: [...headings],
      lastScraped: new Date().toISOString()
    }
  };
}

function detectLanguage(codeEl: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  // Check class names for language hints
  const classes = codeEl.attr('class') || '';
  const match = classes.match(/language-(\w+)|lang-(\w+)|(\w+)-code/);
  if (match) {
    return match[1] || match[2] || match[3];
  }

  // Check parent or child elements
  const parentClass = codeEl.parent().attr('class') || '';
  const parentMatch = parentClass.match(/language-(\w+)/);
  if (parentMatch) return parentMatch[1];

  // Default based on content heuristics
  const code = codeEl.text();
  if (code.includes('import') && code.includes('from')) return 'typescript';
  if (code.includes('npm ') || code.includes('yarn ')) return 'bash';
  if (code.includes('zkApp') || code.includes('o1js')) return 'typescript';

  return 'text';
}
```

#### 4. Semantic Chunker
**File**: `packages/scraper/src/chunker.ts`

```typescript
import type { DocumentChunk } from '@mina-docs/shared';
import { randomUUID } from 'crypto';

const MAX_CHUNK_SIZE = 1500; // tokens (approximate)
const OVERLAP_SIZE = 200;

export function chunkContent(chunks: DocumentChunk[]): DocumentChunk[] {
  const result: DocumentChunk[] = [];

  for (const chunk of chunks) {
    // Code chunks stay as-is (usually well-sized)
    if (chunk.contentType === 'code') {
      result.push(chunk);
      continue;
    }

    // Split large prose chunks
    const words = chunk.content.split(/\s+/);
    const estimatedTokens = words.length * 1.3; // rough estimate

    if (estimatedTokens <= MAX_CHUNK_SIZE) {
      result.push(chunk);
      continue;
    }

    // Split into smaller chunks with overlap
    const subChunks = splitWithOverlap(chunk.content, MAX_CHUNK_SIZE, OVERLAP_SIZE);

    for (let i = 0; i < subChunks.length; i++) {
      result.push({
        ...chunk,
        id: randomUUID(),
        section: `${chunk.section} (Part ${i + 1}/${subChunks.length})`,
        content: subChunks[i]
      });
    }
  }

  return result;
}

function splitWithOverlap(text: string, maxSize: number, overlap: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];

  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const sentence of sentences) {
    const sentenceSize = sentence.split(/\s+/).length * 1.3;

    if (currentSize + sentenceSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));

      // Keep overlap from end of previous chunk
      const overlapSentences: string[] = [];
      let overlapSize = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const s = currentChunk[i];
        const size = s.split(/\s+/).length * 1.3;
        if (overlapSize + size > overlap) break;
        overlapSentences.unshift(s);
        overlapSize += size;
      }

      currentChunk = overlapSentences;
      currentSize = overlapSize;
    }

    currentChunk.push(sentence);
    currentSize += sentenceSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}
```

#### 5. Main Scraper Entrypoint
**File**: `packages/scraper/src/index.ts`

```typescript
import 'dotenv/config';
import { Crawler } from './crawler.js';
import { parseDocumentation } from './parser.js';
import { chunkContent } from './chunker.js';
import {
  VectorDB,
  FullTextDB,
  generateEmbeddings,
  type DocumentChunk
} from '@mina-docs/shared';

async function main() {
  console.log('Starting Mina documentation scraper...');

  // Initialize databases
  const vectorDb = new VectorDB({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'mina_docs'
  });

  const ftsDb = new FullTextDB({
    path: process.env.SQLITE_PATH || './data/mina_docs.db'
  });

  await vectorDb.initialize();
  await ftsDb.initialize();

  // Initialize crawler
  const crawler = new Crawler({
    baseUrl: process.env.SCRAPER_BASE_URL || 'https://docs.minaprotocol.com',
    concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '5'),
    delayMs: parseInt(process.env.SCRAPER_DELAY_MS || '500'),
    maxPages: 500 // Limit for PoC
  });

  let totalChunks = 0;
  let processedPages = 0;

  // Crawl and process pages
  for await (const page of crawler.crawl()) {
    console.log(`Processing: ${page.url}`);

    try {
      // Parse HTML into chunks
      const rawChunks = parseDocumentation(page.url, page.html);

      // Apply semantic chunking
      const chunks = chunkContent(rawChunks);

      if (chunks.length === 0) {
        console.log(`  No content extracted, skipping`);
        continue;
      }

      // Generate embeddings in batches
      const embeddings = await generateEmbeddings(
        chunks.map(c => c.content),
        process.env.OPENAI_API_KEY!
      );

      // Store in vector database
      await vectorDb.upsert(chunks, embeddings);

      // Store in full-text search
      await ftsDb.upsert(chunks);

      totalChunks += chunks.length;
      processedPages++;

      console.log(`  Indexed ${chunks.length} chunks (total: ${totalChunks})`);
    } catch (error) {
      console.error(`  Error processing ${page.url}:`, error);
    }
  }

  console.log(`\nScraping complete!`);
  console.log(`Pages processed: ${processedPages}`);
  console.log(`Total chunks indexed: ${totalChunks}`);

  await vectorDb.close();
  await ftsDb.close();
}

main().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build -w packages/scraper` compiles without errors
- [ ] `npm run scrape` runs and outputs progress logs
- [ ] Qdrant collection contains indexed documents: `curl http://localhost:6333/collections/mina_docs`
- [ ] SQLite database file exists at `./data/mina_docs.db`

#### Manual Verification:
- [ ] Sample queries in Qdrant dashboard return relevant results
- [ ] SQLite FTS queries return expected documentation sections
- [ ] Code blocks are correctly identified and tagged with language

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Database Layer & Search API

### Overview
Implement the shared database clients for vector and full-text search with a unified hybrid search API.

### Changes Required:

#### 1. Vector Database Client
**File**: `packages/shared/src/db/vector.ts`

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import type { DocumentChunk } from '../types.js';

export interface VectorDBOptions {
  url: string;
  collection: string;
}

export class VectorDB {
  private client: QdrantClient;
  private collection: string;

  constructor(options: VectorDBOptions) {
    this.client = new QdrantClient({ url: options.url });
    this.collection = options.collection;
  }

  async initialize(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === this.collection);

    if (!exists) {
      await this.client.createCollection(this.collection, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension
          distance: 'Cosine'
        }
      });

      // Create payload index for filtering
      await this.client.createPayloadIndex(this.collection, {
        field_name: 'contentType',
        field_schema: 'keyword'
      });
    }
  }

  async upsert(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
    const points = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: embeddings[i],
      payload: {
        url: chunk.url,
        title: chunk.title,
        section: chunk.section,
        content: chunk.content,
        contentType: chunk.contentType,
        metadata: chunk.metadata
      }
    }));

    // Upsert in batches of 100
    for (let i = 0; i < points.length; i += 100) {
      const batch = points.slice(i, i + 100);
      await this.client.upsert(this.collection, { points: batch });
    }
  }

  async search(
    embedding: number[],
    options: { limit?: number; filter?: Record<string, string> } = {}
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const { limit = 10, filter } = options;

    const searchParams: any = {
      vector: embedding,
      limit,
      with_payload: true
    };

    if (filter) {
      searchParams.filter = {
        must: Object.entries(filter).map(([key, value]) => ({
          key,
          match: { value }
        }))
      };
    }

    const results = await this.client.search(this.collection, searchParams);

    return results.map(result => ({
      chunk: {
        id: result.id as string,
        url: result.payload!.url as string,
        title: result.payload!.title as string,
        section: result.payload!.section as string,
        content: result.payload!.content as string,
        contentType: result.payload!.contentType as DocumentChunk['contentType'],
        metadata: result.payload!.metadata as DocumentChunk['metadata']
      },
      score: result.score
    }));
  }

  async close(): Promise<void> {
    // QdrantClient doesn't require explicit close
  }
}
```

#### 2. Full-Text Search Database Client
**File**: `packages/shared/src/db/fts.ts`

```typescript
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
    // Create main table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
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

    // Create triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(title, section, content, content_id)
        VALUES (NEW.title, NEW.section, NEW.content, NEW.id);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        DELETE FROM chunks_fts WHERE content_id = OLD.id;
      END
    `);
  }

  async upsert(chunks: DocumentChunk[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, url, title, section, content, content_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO chunks_fts (title, section, content, content_id)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        insert.run(
          chunk.id,
          chunk.url,
          chunk.title,
          chunk.section,
          chunk.content,
          chunk.contentType,
          JSON.stringify(chunk.metadata)
        );

        // Manually insert to FTS (trigger may not fire on REPLACE)
        this.db.prepare('DELETE FROM chunks_fts WHERE content_id = ?').run(chunk.id);
        insertFts.run(chunk.title, chunk.section, chunk.content, chunk.id);
      }
    });

    transaction(chunks);
  }

  async search(
    query: string,
    options: { limit?: number; contentType?: string } = {}
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const { limit = 10, contentType } = options;

    let sql = `
      SELECT
        c.*,
        bm25(chunks_fts) as score
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.content_id
      WHERE chunks_fts MATCH ?
    `;

    const params: any[] = [query];

    if (contentType) {
      sql += ` AND c.content_type = ?`;
      params.push(contentType);
    }

    sql += ` ORDER BY score LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => ({
      chunk: {
        id: row.id,
        url: row.url,
        title: row.title,
        section: row.section,
        content: row.content,
        contentType: row.content_type,
        metadata: JSON.parse(row.metadata)
      },
      score: Math.abs(row.score) // BM25 returns negative scores
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
```

#### 3. Embeddings Client
**File**: `packages/shared/src/embeddings.ts`

```typescript
import OpenAI from 'openai';

const BATCH_SIZE = 100;
const MODEL = 'text-embedding-3-small';

export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const client = new OpenAI({ apiKey });
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model: MODEL,
      input: batch
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

export async function generateSingleEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const client = new OpenAI({ apiKey });

  const response = await client.embeddings.create({
    model: MODEL,
    input: text
  });

  return response.data[0].embedding;
}
```

#### 4. Hybrid Search API
**File**: `packages/shared/src/search.ts`

```typescript
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
  mode?: 'hybrid' | 'vector' | 'fts';
}

export class HybridSearch {
  constructor(private options: HybridSearchOptions) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 10, contentType, mode = 'hybrid' } = options;

    if (mode === 'fts') {
      return this.ftsSearch(query, { limit, contentType });
    }

    if (mode === 'vector') {
      return this.vectorSearch(query, { limit, contentType });
    }

    // Hybrid: combine vector and FTS results
    const [vectorResults, ftsResults] = await Promise.all([
      this.vectorSearch(query, { limit: limit * 2, contentType }),
      this.ftsSearch(query, { limit: limit * 2, contentType })
    ]);

    // Merge and deduplicate results using reciprocal rank fusion
    return this.reciprocalRankFusion(vectorResults, ftsResults, limit);
  }

  private async vectorSearch(
    query: string,
    options: { limit: number; contentType?: string }
  ): Promise<SearchResult[]> {
    const embedding = await generateSingleEmbedding(
      query,
      this.options.openaiApiKey
    );

    const filter = options.contentType
      ? { contentType: options.contentType }
      : undefined;

    const results = await this.options.vectorDb.search(embedding, {
      limit: options.limit,
      filter
    });

    return results.map(r => ({
      chunk: r.chunk,
      score: r.score,
      matchType: 'vector' as const
    }));
  }

  private async ftsSearch(
    query: string,
    options: { limit: number; contentType?: string }
  ): Promise<SearchResult[]> {
    const results = await this.options.ftsDb.search(query, {
      limit: options.limit,
      contentType: options.contentType
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
```

#### 5. Update Shared Package Exports
**File**: `packages/shared/src/index.ts`

```typescript
export * from './types.js';
export * from './db/vector.js';
export * from './db/fts.js';
export * from './embeddings.js';
export * from './search.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build -w packages/shared` compiles without errors
- [ ] Unit tests for VectorDB client pass
- [ ] Unit tests for FullTextDB client pass
- [ ] Unit tests for HybridSearch pass

#### Manual Verification:
- [ ] Vector search returns semantically relevant results for "how to create a zkApp"
- [ ] FTS search returns exact matches for specific terms like "SmartContract"
- [ ] Hybrid search combines both effectively

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: MCP HTTP Server Core

### Overview
Implement the MCP server using HTTP/SSE transport with the core protocol handlers.

### Changes Required:

#### 1. Server Package Configuration
**File**: `packages/server/package.json`

```json
{
  "name": "@mina-docs/server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mina-docs-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "node --watch dist/index.js"
  },
  "dependencies": {
    "@mina-docs/shared": "*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21"
  }
}
```

#### 2. Server Configuration
**File**: `packages/server/src/config.ts`

```typescript
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.MCP_PORT || '3000'),
  host: process.env.MCP_HOST || 'localhost',

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'mina_docs'
  },

  sqlite: {
    path: process.env.SQLITE_PATH || './data/mina_docs.db'
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY!
  }
};

// Validate required config
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

#### 3. MCP Server Implementation
**File**: `packages/server/src/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { VectorDB, FullTextDB, HybridSearch } from '@mina-docs/shared';
import { config } from './config.js';
import { registerTools, handleToolCall } from './tools/index.js';
import { registerResources, handleResourceRead } from './resources/index.js';

export async function createMCPServer() {
  // Initialize databases
  const vectorDb = new VectorDB({
    url: config.qdrant.url,
    collection: config.qdrant.collection
  });

  const ftsDb = new FullTextDB({
    path: config.sqlite.path
  });

  await vectorDb.initialize();
  await ftsDb.initialize();

  // Initialize hybrid search
  const search = new HybridSearch({
    vectorDb,
    ftsDb,
    openaiApiKey: config.openai.apiKey
  });

  // Create MCP server
  const server = new Server(
    {
      name: 'mina-docs-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: registerTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments, { search, ftsDb });
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: await registerResources(ftsDb) };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleResourceRead(request.params.uri, { ftsDb });
  });

  return { server, vectorDb, ftsDb };
}
```

#### 4. HTTP Transport Layer
**File**: `packages/server/src/transport.ts`

```typescript
import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export function createHttpTransport(server: Server, port: number, host: string) {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'mina-docs-mcp', version: '0.1.0' });
  });

  // MCP endpoint using SSE for streaming responses
  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const message = req.body;

      // Process the JSON-RPC request through the MCP server
      // Note: This is a simplified implementation
      // Full implementation would handle SSE streaming

      const result = await processMessage(server, message);
      res.json(result);
    } catch (error) {
      console.error('MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: req.body?.id || null
      });
    }
  });

  // SSE endpoint for streaming
  app.get('/mcp/sse', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.error(`MCP server listening on http://${host}:${port}`);
      console.error(`Health check: http://${host}:${port}/health`);
      resolve();
    });
  });
}

async function processMessage(server: Server, message: any): Promise<any> {
  // Route JSON-RPC messages to appropriate handlers
  // This is handled internally by the MCP SDK
  // We're creating a simple pass-through here

  return new Promise((resolve, reject) => {
    // Use internal server processing
    // This needs to be adapted based on MCP SDK internals
    try {
      // For now, return a placeholder
      // Full implementation would integrate with server.handle()
      resolve({
        jsonrpc: '2.0',
        result: {},
        id: message.id
      });
    } catch (error) {
      reject(error);
    }
  });
}
```

#### 5. Server Entrypoint
**File**: `packages/server/src/index.ts`

```typescript
#!/usr/bin/env node

import { createMCPServer } from './server.js';
import { createHttpTransport } from './transport.js';
import { config } from './config.js';

async function main() {
  console.error('Starting Mina Documentation MCP Server...');

  try {
    const { server, vectorDb, ftsDb } = await createMCPServer();

    await createHttpTransport(server, config.port, config.host);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.error('\nShutting down...');
      await ftsDb.close();
      await vectorDb.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('\nShutting down...');
      await ftsDb.close();
      await vectorDb.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build -w packages/server` compiles without errors
- [ ] `npm run server` starts without errors
- [ ] Health check returns 200: `curl http://localhost:3000/health`
- [ ] MCP endpoint accepts POST requests: `curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`

#### Manual Verification:
- [ ] Server logs show successful initialization
- [ ] Qdrant and SQLite connections are established
- [ ] Server gracefully handles SIGINT/SIGTERM

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: MCP Tools Implementation

### Overview
Implement the four main MCP tools for documentation search, code examples, concept explanation, and debugging help.

### Changes Required:

#### 1. Tools Index
**File**: `packages/server/src/tools/index.ts`

```typescript
import { z } from 'zod';
import { searchDocumentation, SearchDocumentationSchema } from './search.js';
import { getCodeExamples, GetCodeExamplesSchema } from './examples.js';
import { explainConcept, ExplainConceptSchema } from './explain.js';
import { debugHelper, DebugHelperSchema } from './debug.js';
import type { HybridSearch, FullTextDB } from '@mina-docs/shared';

export interface ToolContext {
  search: HybridSearch;
  ftsDb: FullTextDB;
}

export function registerTools() {
  return [
    {
      name: 'search_documentation',
      description: 'Search Mina Protocol documentation using semantic and keyword search. Returns relevant documentation sections, tutorials, and API references.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be a question, keyword, or concept'
          },
          contentType: {
            type: 'string',
            enum: ['prose', 'code', 'api-reference'],
            description: 'Filter results by content type (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_code_examples',
      description: 'Find code examples for Mina/o1js development. Returns TypeScript code snippets for zkApps, smart contracts, proofs, and common patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to find examples for (e.g., "state management", "deploy zkApp", "Poseidon hash")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of examples to return (default: 3)',
            default: 3
          }
        },
        required: ['topic']
      }
    },
    {
      name: 'explain_concept',
      description: 'Get explanations of Mina Protocol and zero-knowledge concepts. Useful for understanding ZK terminology, protocol mechanics, and o1js features.',
      inputSchema: {
        type: 'object',
        properties: {
          concept: {
            type: 'string',
            description: 'Concept to explain (e.g., "zkSNARK", "SmartContract", "Provable types", "recursion")'
          },
          depth: {
            type: 'string',
            enum: ['brief', 'detailed'],
            description: 'Level of detail (default: brief)',
            default: 'brief'
          }
        },
        required: ['concept']
      }
    },
    {
      name: 'debug_helper',
      description: 'Get help debugging common Mina/o1js errors and issues. Provide the error message or describe the problem to get troubleshooting guidance.',
      inputSchema: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message or description of the issue'
          },
          context: {
            type: 'string',
            description: 'Additional context about what you were trying to do (optional)'
          }
        },
        required: ['error']
      }
    }
  ];
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'search_documentation':
        return await searchDocumentation(
          SearchDocumentationSchema.parse(args),
          context
        );

      case 'get_code_examples':
        return await getCodeExamples(
          GetCodeExamplesSchema.parse(args),
          context
        );

      case 'explain_concept':
        return await explainConcept(
          ExplainConceptSchema.parse(args),
          context
        );

      case 'debug_helper':
        return await debugHelper(
          DebugHelperSchema.parse(args),
          context
        );

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        };
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: error instanceof Error ? error.message : 'Tool execution failed'
      }]
    };
  }
}
```

#### 2. Search Documentation Tool
**File**: `packages/server/src/tools/search.ts`

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';

export const SearchDocumentationSchema = z.object({
  query: z.string(),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional(),
  limit: z.number().optional().default(5)
});

type SearchDocumentationArgs = z.infer<typeof SearchDocumentationSchema>;

export async function searchDocumentation(
  args: SearchDocumentationArgs,
  context: ToolContext
) {
  const results = await context.search.search(args.query, {
    limit: args.limit,
    contentType: args.contentType
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for "${args.query}". Try rephrasing your query or using different keywords.`
      }]
    };
  }

  const formattedResults = results.map((result, index) => {
    const { chunk } = result;
    return [
      `## Result ${index + 1}: ${chunk.title}`,
      `**Section:** ${chunk.section}`,
      `**URL:** ${chunk.url}`,
      `**Type:** ${chunk.contentType}`,
      '',
      chunk.content,
      '',
      '---'
    ].join('\n');
  });

  return {
    content: [{
      type: 'text',
      text: [
        `# Search Results for "${args.query}"`,
        `Found ${results.length} relevant sections:`,
        '',
        ...formattedResults
      ].join('\n')
    }]
  };
}
```

#### 3. Get Code Examples Tool
**File**: `packages/server/src/tools/examples.ts`

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetCodeExamplesSchema = z.object({
  topic: z.string(),
  limit: z.number().optional().default(3)
});

type GetCodeExamplesArgs = z.infer<typeof GetCodeExamplesSchema>;

export async function getCodeExamples(
  args: GetCodeExamplesArgs,
  context: ToolContext
) {
  // Search specifically for code content
  const results = await context.search.search(args.topic, {
    limit: args.limit * 2, // Get more to filter
    contentType: 'code'
  });

  // Also search prose for embedded code
  const proseResults = await context.search.search(
    `${args.topic} example code`,
    { limit: args.limit, contentType: 'prose' }
  );

  // Filter and format code results
  const codeResults = results.slice(0, args.limit);

  if (codeResults.length === 0 && proseResults.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No code examples found for "${args.topic}". Try searching for a more specific o1js feature or pattern.`
      }]
    };
  }

  const formattedExamples = codeResults.map((result, index) => {
    const { chunk } = result;
    const language = chunk.metadata.codeLanguage || 'typescript';

    return [
      `## Example ${index + 1}: ${chunk.section}`,
      `**From:** ${chunk.title}`,
      `**URL:** ${chunk.url}`,
      '',
      '```' + language,
      chunk.content,
      '```',
      ''
    ].join('\n');
  });

  // Add relevant prose context if available
  const contextSection = proseResults.length > 0 ? [
    '',
    '## Related Documentation',
    '',
    ...proseResults.slice(0, 2).map(r =>
      `- **${r.chunk.title}** (${r.chunk.section}): ${r.chunk.url}`
    )
  ].join('\n') : '';

  return {
    content: [{
      type: 'text',
      text: [
        `# Code Examples: ${args.topic}`,
        '',
        ...formattedExamples,
        contextSection
      ].join('\n')
    }]
  };
}
```

#### 4. Explain Concept Tool
**File**: `packages/server/src/tools/explain.ts`

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ExplainConceptSchema = z.object({
  concept: z.string(),
  depth: z.enum(['brief', 'detailed']).optional().default('brief')
});

type ExplainConceptArgs = z.infer<typeof ExplainConceptSchema>;

// Common Mina/ZK concepts with pre-defined explanations
const CONCEPT_GLOSSARY: Record<string, { brief: string; detailed: string }> = {
  'zksnark': {
    brief: 'Zero-Knowledge Succinct Non-Interactive Argument of Knowledge - a cryptographic proof that allows one party to prove possession of information without revealing it.',
    detailed: 'zkSNARKs are the foundation of Mina Protocol. They enable the 22KB blockchain by allowing validators to verify the entire chain state through a small, constant-size proof. In Mina, zkSNARKs are generated using the Kimchi proof system (a PLONKish construction). Key properties: zero-knowledge (reveals nothing about inputs), succinct (small proof size), non-interactive (no back-and-forth communication required).'
  },
  'smartcontract': {
    brief: 'In o1js, SmartContract is the base class for creating zkApps - zero-knowledge applications that run on Mina.',
    detailed: 'SmartContract in o1js extends the base class to create zkApps. Key features: @state decorators for on-chain state (max 8 Field elements), @method decorators for provable methods that generate proofs, automatic proof generation and verification. State is stored on-chain but computation happens off-chain, with only the proof submitted to the network.'
  },
  'provable': {
    brief: 'Provable types in o1js are data types that can be used inside zkApp methods to generate zero-knowledge proofs.',
    detailed: 'Provable types are the building blocks of zkApp circuits. They include: Field (native field element), Bool (boolean), UInt32/UInt64 (unsigned integers), PublicKey, Signature, and Struct (custom types). Only provable types can be used in @method functions. Non-provable operations (like console.log) are ignored during proof generation.'
  }
};

export async function explainConcept(
  args: ExplainConceptArgs,
  context: ToolContext
) {
  const normalizedConcept = args.concept.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check glossary first
  const glossaryEntry = CONCEPT_GLOSSARY[normalizedConcept];
  if (glossaryEntry) {
    const explanation = args.depth === 'detailed'
      ? glossaryEntry.detailed
      : glossaryEntry.brief;

    // Also search for related documentation
    const related = await context.search.search(args.concept, {
      limit: 3,
      contentType: 'prose'
    });

    return {
      content: [{
        type: 'text',
        text: [
          `# ${args.concept}`,
          '',
          explanation,
          '',
          related.length > 0 ? [
            '## Learn More',
            '',
            ...related.map(r => `- [${r.chunk.title}](${r.chunk.url}): ${r.chunk.section}`)
          ].join('\n') : ''
        ].join('\n')
      }]
    };
  }

  // Search documentation for the concept
  const results = await context.search.search(
    `what is ${args.concept} definition explanation`,
    { limit: args.depth === 'detailed' ? 5 : 3 }
  );

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No explanation found for "${args.concept}". This might not be a Mina-specific concept. Try searching the general documentation with search_documentation.`
      }]
    };
  }

  const sections = results.map(r => r.chunk.content).join('\n\n');
  const sources = results.map(r => `- ${r.chunk.title}: ${r.chunk.url}`);

  return {
    content: [{
      type: 'text',
      text: [
        `# ${args.concept}`,
        '',
        sections,
        '',
        '## Sources',
        ...sources
      ].join('\n')
    }]
  };
}
```

#### 5. Debug Helper Tool
**File**: `packages/server/src/tools/debug.ts`

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';

export const DebugHelperSchema = z.object({
  error: z.string(),
  context: z.string().optional()
});

type DebugHelperArgs = z.infer<typeof DebugHelperSchema>;

// Common error patterns and solutions
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  solution: string;
}> = [
  {
    pattern: /Field\.assert/i,
    title: 'Assertion Failed in Circuit',
    solution: 'Field assertions fail when a condition is not met during proof generation. Check that your inputs satisfy the constraint. Use Provable.log() to debug values during proof generation (not console.log).'
  },
  {
    pattern: /cannot read properties of undefined/i,
    title: 'Undefined Value in Circuit',
    solution: 'This often occurs when accessing state before it\'s initialized. Ensure @state fields are properly initialized in the constructor or use Field(0) as default.'
  },
  {
    pattern: /proof verification failed/i,
    title: 'Proof Verification Failed',
    solution: 'The proof doesn\'t match the expected verification key. Common causes: 1) Contract code changed after deployment, 2) Incorrect network/contract address, 3) State mismatch between local and on-chain.'
  },
  {
    pattern: /nonce/i,
    title: 'Nonce Error',
    solution: 'Nonce errors occur when transactions are out of order. Wait for pending transactions to confirm, or fetch the latest account state before sending new transactions.'
  },
  {
    pattern: /insufficient balance/i,
    title: 'Insufficient Balance',
    solution: 'The account doesn\'t have enough MINA for the transaction. Ensure you have MINA for: 1) Transaction fee, 2) Account creation fee (1 MINA for new accounts), 3) Any value transfers.'
  },
  {
    pattern: /circuit|constraint/i,
    title: 'Circuit Constraint Issue',
    solution: 'Circuit constraints must be deterministic. Avoid: 1) Conditional branches that depend on runtime values, 2) Variable-length loops, 3) Non-provable operations inside @method. Use Provable.if() for conditional logic.'
  }
];

export async function debugHelper(
  args: DebugHelperArgs,
  context: ToolContext
) {
  // Check for known error patterns
  const matchedPattern = ERROR_PATTERNS.find(p => p.pattern.test(args.error));

  // Search documentation for error-related content
  const searchQuery = args.context
    ? `${args.error} ${args.context}`
    : args.error;

  const results = await context.search.search(
    `error troubleshoot ${searchQuery}`,
    { limit: 5 }
  );

  const sections: string[] = [
    `# Debugging: ${args.error.slice(0, 100)}${args.error.length > 100 ? '...' : ''}`,
    ''
  ];

  // Add matched pattern solution if found
  if (matchedPattern) {
    sections.push(
      `## Likely Issue: ${matchedPattern.title}`,
      '',
      matchedPattern.solution,
      ''
    );
  }

  // Add relevant documentation
  if (results.length > 0) {
    sections.push(
      '## Related Documentation',
      ''
    );

    for (const result of results.slice(0, 3)) {
      sections.push(
        `### ${result.chunk.title}`,
        `*${result.chunk.section}*`,
        '',
        result.chunk.content.slice(0, 500) + (result.chunk.content.length > 500 ? '...' : ''),
        '',
        `[Read more](${result.chunk.url})`,
        ''
      );
    }
  }

  // Add general debugging tips
  sections.push(
    '## General Debugging Tips',
    '',
    '1. **Use Provable.log()** - Debug values inside circuits (not console.log)',
    '2. **Check the Local Blockchain** - Use `npm run test` with LocalBlockchain for fast iteration',
    '3. **Verify Contract State** - Fetch on-chain state to compare with expected values',
    '4. **Review Proof Generation** - Enable verbose logging during compile()',
    '',
    '## Need More Help?',
    '',
    '- [Mina Discord #zkapps-developers](https://discord.gg/minaprotocol)',
    '- [o1js GitHub Issues](https://github.com/o1-labs/o1js/issues)'
  );

  return {
    content: [{
      type: 'text',
      text: sections.join('\n')
    }]
  };
}
```

#### 6. Resources Implementation
**File**: `packages/server/src/resources/index.ts`

```typescript
import type { FullTextDB, DocumentChunk } from '@mina-docs/shared';

export interface ResourceContext {
  ftsDb: FullTextDB;
}

export async function registerResources(ftsDb: FullTextDB) {
  // Get unique URLs from the database as resources
  // For PoC, we'll expose top-level documentation sections

  return [
    {
      uri: 'mina://docs/zkapps/overview',
      name: 'zkApps Overview',
      description: 'Introduction to building zkApps on Mina',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/o1js/introduction',
      name: 'o1js Introduction',
      description: 'Getting started with the o1js TypeScript framework',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/tutorials/hello-world',
      name: 'Hello World Tutorial',
      description: 'Build your first zkApp',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/api-reference',
      name: 'API Reference',
      description: 'o1js API documentation',
      mimeType: 'text/markdown'
    }
  ];
}

export async function handleResourceRead(
  uri: string,
  context: ResourceContext
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  // Parse the URI to determine what content to fetch
  const match = uri.match(/^mina:\/\/docs\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const path = match[1];

  // Search for content matching this path
  const results = await context.ftsDb.search(path.replace(/\//g, ' '), {
    limit: 10
  });

  if (results.length === 0) {
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: `# Resource Not Found\n\nNo content found for ${uri}`
      }]
    };
  }

  // Combine matching chunks into a single document
  const content = results
    .map(r => [
      `## ${r.chunk.section}`,
      '',
      r.chunk.content,
      '',
      `*Source: ${r.chunk.url}*`
    ].join('\n'))
    .join('\n\n---\n\n');

  return {
    contents: [{
      uri,
      mimeType: 'text/markdown',
      text: [
        `# ${path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
        '',
        content
      ].join('\n')
    }]
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run build -w packages/server` compiles without errors
- [ ] Server starts and lists all 4 tools via MCP endpoint
- [ ] `tools/list` returns search_documentation, get_code_examples, explain_concept, debug_helper
- [ ] `tools/call` with search_documentation returns results

#### Manual Verification:
- [ ] `search_documentation` with "how to create a zkApp" returns relevant tutorials
- [ ] `get_code_examples` with "SmartContract" returns TypeScript code snippets
- [ ] `explain_concept` with "zkSNARK" returns a clear explanation
- [ ] `debug_helper` with "proof verification failed" returns troubleshooting steps

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Integration & Testing

### Overview
End-to-end testing and integration with Claude Desktop/Cursor.

### Changes Required:

#### 1. Integration Test Script
**File**: `scripts/test-integration.ts`

```typescript
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testHealthCheck() {
  console.log('Testing health check...');
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log('Health:', data);
  return data.status === 'ok';
}

async function testToolsList() {
  console.log('\nTesting tools/list...');
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    })
  });
  const data = await response.json();
  console.log('Tools:', JSON.stringify(data, null, 2));
  return data.result?.tools?.length === 4;
}

async function testSearchTool() {
  console.log('\nTesting search_documentation tool...');
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_documentation',
        arguments: {
          query: 'how to create a zkApp',
          limit: 3
        }
      },
      id: 2
    })
  });
  const data = await response.json();
  console.log('Search result preview:', data.result?.content?.[0]?.text?.slice(0, 500));
  return !data.result?.isError;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Mina Docs MCP Server Integration Tests');
  console.log('='.repeat(60));

  const results = [];

  results.push({ name: 'Health Check', passed: await testHealthCheck() });
  results.push({ name: 'Tools List', passed: await testToolsList() });
  results.push({ name: 'Search Tool', passed: await testSearchTool() });

  console.log('\n' + '='.repeat(60));
  console.log('Results:');
  console.log('='.repeat(60));

  for (const result of results) {
    console.log(`${result.passed ? '✓' : '✗'} ${result.name}`);
  }

  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? 'All tests passed!' : 'Some tests failed.'}`);

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error);
```

#### 2. Claude Desktop Configuration Example
**File**: `examples/claude-desktop-config.json`

```json
{
  "mcpServers": {
    "mina-docs": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

#### 3. Cursor Configuration Example
**File**: `examples/cursor-mcp-config.json`

```json
{
  "mcp": {
    "servers": {
      "mina-docs": {
        "type": "http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

#### 4. README Updates
**File**: `README.md`

```markdown
# Mina Protocol Documentation MCP Server

A Model Context Protocol (MCP) server that provides Mina Protocol developer documentation to AI coding agents like Claude Code and Cursor.

## Features

- **Semantic Search**: Find relevant documentation using natural language queries
- **Code Examples**: Retrieve o1js/zkApp code snippets
- **Concept Explanations**: Understand ZK and Mina-specific terminology
- **Debug Helper**: Get troubleshooting guidance for common errors

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for Qdrant vector database)
- OpenAI API key

### Setup

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/your-org/mina-docs-mcp.git
   cd mina-docs-mcp
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

3. Start the database:
   ```bash
   docker-compose up -d
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Scrape the documentation:
   ```bash
   npm run scraper
   ```

6. Start the MCP server:
   ```bash
   npm run server
   ```

### Integration with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mina-docs": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Document       │────▶│  Database Layer  │◀────│  MCP HTTP       │
│  Scraper        │     │  (Qdrant + FTS)  │     │  Server         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_documentation` | Hybrid semantic/keyword search |
| `get_code_examples` | Find o1js code snippets |
| `explain_concept` | Explain ZK terminology |
| `debug_helper` | Troubleshoot common errors |

## Development

```bash
# Build all packages
npm run build

# Run scraper
npm run scraper

# Start server in dev mode
npm run dev:server

# Run integration tests
npx ts-node scripts/test-integration.ts
```

## License

MIT
```

### Success Criteria:

#### Automated Verification:
- [ ] Integration test script passes: `npx ts-node scripts/test-integration.ts`
- [ ] All MCP tools respond correctly
- [ ] Server handles concurrent requests

#### Manual Verification:
- [ ] Claude Desktop can connect to the MCP server
- [ ] Using "search_documentation" in Claude Desktop returns Mina docs
- [ ] Cursor integration works (if available)
- [ ] End-to-end workflow: ask Claude about building a zkApp, get helpful responses grounded in Mina documentation

**Implementation Note**: After completing this phase and all verification passes, the proof-of-concept is complete.

---

## Testing Strategy

### Unit Tests
- VectorDB client: connection, upsert, search
- FullTextDB client: FTS queries, upsert
- HybridSearch: reciprocal rank fusion, result merging
- Parser: HTML to chunk conversion
- Chunker: semantic splitting, overlap handling

### Integration Tests
- Scraper: full crawl of test page set
- Server: MCP protocol compliance
- Tools: each tool with sample inputs

### Manual Testing Steps
1. Start full system (Qdrant + server)
2. Verify scraper indexes ~100+ documentation pages
3. Test each MCP tool through curl or MCP inspector
4. Connect Claude Desktop and ask Mina development questions
5. Verify responses reference actual Mina documentation

## Performance Considerations

- **Embedding API calls**: Batched in groups of 100 to optimize costs
- **Crawl rate limiting**: 500ms delay between requests to respect rate limits
- **Search caching**: Consider adding LRU cache for frequent queries
- **Database indices**: Payload index on contentType for filtered searches

## References

- MCP Specification: https://modelcontextprotocol.io
- Mina Documentation: https://docs.minaprotocol.com
- o1js SDK: https://github.com/o1-labs/o1js
- Qdrant Documentation: https://qdrant.tech/documentation/
