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
