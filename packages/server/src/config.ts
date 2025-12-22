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
    apiKey: process.env.OPENAI_API_KEY || ''
  }
};

export function validateConfig(): void {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
}
