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

      // Create project index for filtering
      await this.client.createPayloadIndex(this.collection, {
        field_name: 'project',
        field_schema: 'keyword'
      });

      // Create URL index for efficient deletion
      await this.client.createPayloadIndex(this.collection, {
        field_name: 'url',
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
        project: chunk.project,
        metadata: chunk.metadata,
        orphaned: chunk.metadata.orphaned || false
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
        project: result.payload!.project as string,
        metadata: {
          ...(result.payload!.metadata as DocumentChunk['metadata']),
          orphaned: result.payload!.orphaned as boolean || false
        }
      },
      score: result.score
    }));
  }

  /**
   * Delete all points (chunks) matching a specific URL
   */
  async deleteByUrl(url: string): Promise<void> {
    await this.client.delete(this.collection, {
      filter: {
        must: [{ key: 'url', match: { value: url } }]
      }
    });
  }

  /**
   * Delete all points for a project
   */
  async deleteByProject(project: string): Promise<void> {
    await this.client.delete(this.collection, {
      filter: {
        must: [{ key: 'project', match: { value: project } }]
      }
    });
  }

  /**
   * Get all unique URLs for a project (for orphan detection)
   */
  async getUrlsForProject(project: string): Promise<string[]> {
    const urls = new Set<string>();
    let offsetId: string | number | null = null;

    // Scroll through all points for this project
    while (true) {
      const scrollParams: any = {
        filter: {
          must: [{ key: 'project', match: { value: project } }]
        },
        limit: 100,
        with_payload: ['url']
      };

      if (offsetId !== null) {
        scrollParams.offset = offsetId;
      }

      const result = await this.client.scroll(this.collection, scrollParams);

      for (const point of result.points) {
        if (point.payload?.url) {
          urls.add(point.payload.url as string);
        }
      }

      if (!result.next_page_offset) break;
      offsetId = result.next_page_offset as string | number;
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

  async close(): Promise<void> {
    // QdrantClient doesn't require explicit close
  }
}
