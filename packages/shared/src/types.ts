export interface DocumentChunk {
  id: string;
  url: string;
  title: string;
  section: string;
  content: string;
  contentType: 'prose' | 'code' | 'api-reference';
  project: string; // Project identifier (e.g., "mina", "solana", "cosmos")
  metadata: {
    headings: string[];
    codeLanguage?: string;
    lastScraped: string;
    // GitHub source metadata (optional)
    sourceType?: 'docs' | 'github';
    className?: string;
    methodName?: string;
    functionName?: string;
    typeName?: string;
    isStatic?: boolean;
    filePath?: string;
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
