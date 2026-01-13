import 'dotenv/config';

export const config = {
  port: parseInt(process.env.MCP_PORT || '3000'),
  host: process.env.MCP_HOST || 'localhost',

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'crypto_docs'
  },

  sqlite: {
    path: process.env.SQLITE_PATH || './data/crypto_docs.db'
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },

  // LLM synthesis configuration
  llm: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3')
  },

  // Tavily web search configuration (optional)
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    searchDepth: (process.env.TAVILY_SEARCH_DEPTH as 'basic' | 'advanced') || 'basic',
    maxResults: parseInt(process.env.TAVILY_MAX_RESULTS || '5')
  },

  // Agentic evaluation loop configuration
  agenticEvaluation: {
    enabled: process.env.AGENTIC_EVALUATION_ENABLED !== 'false', // Enabled by default
    maxIterations: parseInt(process.env.AGENTIC_MAX_ITERATIONS || '3'),
    autoReturnConfidenceThreshold: parseInt(process.env.AGENTIC_AUTO_RETURN_THRESHOLD || '85'),
    maxWebSearches: parseInt(process.env.AGENTIC_MAX_WEB_SEARCHES || '2'),
    maxDocQueries: parseInt(process.env.AGENTIC_MAX_DOC_QUERIES || '2')
  }
};

export function validateConfig(): void {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
}
