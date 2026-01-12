import type { SearchGuidance } from './search-query-generator.js';

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
    // Trust and quality metadata
    trustLevel?: 'official' | 'verified-community' | 'community';
    sourceId?: string; // Reference to source registry entry
    versionHint?: string; // Inferred version compatibility (e.g., "o1js@>=0.15.0")
    prerequisites?: string[]; // Inferred prerequisites
    repoStats?: {
      stars: number;
      forks: number;
      lastCommit: string; // ISO timestamp
    };
    // Context from surrounding docs
    readmeContext?: string; // Relevant excerpt from README
    exampleDescription?: string; // What this example demonstrates
    // Quality filtering metadata
    qualityScore?: number; // 0-100 from LLM evaluation
    indexedReason?: string; // Why this was deemed index-worthy
    // Re-indexing metadata
    orphaned?: boolean; // True if source URL was not visited in latest crawl
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

/**
 * Structured response metadata for AI coding agents
 * Provides machine-readable signals about response quality and suggested actions
 */
export interface AgentResponseMetadata {
  /** Confidence score 0-100 (100 = highly confident) */
  confidence: number;

  /** Quality of retrieval (based on number and relevance of chunks found) */
  retrievalQuality: 'high' | 'medium' | 'low' | 'none';

  /** Number of source chunks used in the response */
  sourcesUsed: number;

  /** Detected query type */
  queryType: string;

  /** Suggested follow-up actions for the agent */
  suggestions: Array<{
    action: string;  // Tool name or action type
    reason: string;  // Why this might help
    params?: Record<string, string>;  // Suggested parameters
  }>;

  /** Related queries the agent might consider */
  relatedQueries?: string[];

  /** Warnings about the response quality or completeness */
  warnings?: string[];

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Search guidance when documentation is insufficient (optional) */
  searchGuidance?: SearchGuidance;
}

/**
 * Source reference for citation
 */
export interface SourceReference {
  index: number;
  url: string;
  title: string;
  relevance: 'high' | 'medium' | 'low';
}

/**
 * Complete structured response for AI agents
 */
export interface AgentResponse {
  /** The synthesized text response */
  answer: string;

  /** Structured metadata for agents */
  metadata: AgentResponseMetadata;

  /** Source URLs for verification */
  sources: SourceReference[];
}
