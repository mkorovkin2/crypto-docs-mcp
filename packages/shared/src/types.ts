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
