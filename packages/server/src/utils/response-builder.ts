/**
 * ResponseBuilder - Creates structured responses for AI coding agents
 *
 * Provides machine-readable metadata alongside text responses to help
 * agents make better decisions about next actions.
 */

import type {
  AgentResponseMetadata,
  AgentResponse,
  SearchResult,
  SourceReference,
  QueryAnalysis,
  SearchGuidance,
  EvaluationTrace
} from '@mina-docs/shared';
import { calculateConfidenceScore, quickConfidenceEstimate } from '@mina-docs/shared';

export class ResponseBuilder {
  private startTime: number;
  private metadata: Partial<AgentResponseMetadata> = {};
  private sources: SourceReference[] = [];
  private webSources: Array<{ url: string; title: string }> = [];
  private warnings: string[] = [];
  private suggestions: AgentResponseMetadata['suggestions'] = [];
  private relatedQueries: string[] = [];
  private searchGuidance?: SearchGuidance;
  private evaluationTrace?: EvaluationTrace;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Set confidence score (0-100)
   */
  setConfidence(score: number): this {
    this.metadata.confidence = Math.max(0, Math.min(100, Math.round(score)));
    return this;
  }

  /**
   * Set retrieval quality based on search results
   */
  setRetrievalQuality(results: SearchResult[]): this {
    const count = results.length;
    if (count >= 8) {
      this.metadata.retrievalQuality = 'high';
    } else if (count >= 4) {
      this.metadata.retrievalQuality = 'medium';
    } else if (count > 0) {
      this.metadata.retrievalQuality = 'low';
    } else {
      this.metadata.retrievalQuality = 'none';
    }
    this.metadata.sourcesUsed = count;
    return this;
  }

  /**
   * Set the detected query type
   */
  setQueryType(type: string): this {
    this.metadata.queryType = type;
    return this;
  }

  /**
   * Add a suggested follow-up action
   */
  addSuggestion(action: string, reason: string, params?: Record<string, string>): this {
    this.suggestions.push({ action, reason, params });
    return this;
  }

  /**
   * Add a related query suggestion
   */
  addRelatedQuery(query: string): this {
    if (!this.relatedQueries.includes(query)) {
      this.relatedQueries.push(query);
    }
    return this;
  }

  /**
   * Add a warning about the response
   */
  addWarning(warning: string): this {
    if (!this.warnings.includes(warning)) {
      this.warnings.push(warning);
    }
    return this;
  }

  /**
   * Set search guidance for when documentation is insufficient
   */
  setSearchGuidance(guidance: SearchGuidance): this {
    this.searchGuidance = guidance;
    return this;
  }

  /**
   * Add a web source from web search results
   */
  addWebSource(url: string, title: string): this {
    // Avoid duplicates
    if (!this.webSources.some(s => s.url === url)) {
      this.webSources.push({ url, title });
    }
    return this;
  }

  /**
   * Set evaluation trace for debugging (only included when DEBUG_EVALUATION=true)
   */
  setEvaluationTrace(trace: EvaluationTrace): this {
    this.evaluationTrace = trace;
    return this;
  }

  /**
   * Set source references from search results
   */
  setSources(results: SearchResult[]): this {
    this.sources = results.map((r, i) => ({
      index: i + 1,
      url: r.chunk.url,
      title: `${r.chunk.title} - ${r.chunk.section}`,
      relevance: this.scoreToRelevance(r.score)
    }));
    return this;
  }

  private scoreToRelevance(score: number): 'high' | 'medium' | 'low' {
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Build the complete AgentResponse object
   */
  build(answer: string): AgentResponse {
    return {
      answer,
      metadata: {
        confidence: this.metadata.confidence ?? 50,
        retrievalQuality: this.metadata.retrievalQuality ?? 'low',
        sourcesUsed: this.metadata.sourcesUsed ?? 0,
        queryType: this.metadata.queryType ?? 'general',
        suggestions: this.suggestions,
        relatedQueries: this.relatedQueries.length > 0 ? this.relatedQueries : undefined,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        processingTimeMs: Date.now() - this.startTime,
        searchGuidance: this.searchGuidance
      },
      sources: this.sources
    };
  }

  /**
   * Build response formatted for MCP protocol
   * Combines prose answer with JSON metadata block
   */
  buildMCPResponse(answer: string): { content: Array<{ type: string; text: string }> } {
    const response = this.build(answer);

    // Format indexed sources for text display
    const indexedSourcesText = response.sources.length > 0
      ? response.sources.map(s => `[${s.index}] ${s.title}\n    ${s.url}`).join('\n')
      : 'No indexed sources';

    // Format web sources if any
    const webSourcesText = this.webSources.length > 0
      ? this.webSources.map((s, i) => `[Web ${i + 1}] ${s.title}\n    ${s.url}`).join('\n')
      : '';

    // Combine all sources
    const sourcesText = webSourcesText
      ? `${indexedSourcesText}\n\n### Web Sources\n${webSourcesText}`
      : indexedSourcesText;

    // Include evaluation trace in metadata if set
    const metadataToInclude = this.evaluationTrace
      ? { ...response.metadata, evaluationTrace: this.evaluationTrace }
      : response.metadata;

    // Build the complete formatted response
    const formattedAnswer = `${response.answer}

---

<response_metadata>
\`\`\`json
${JSON.stringify(metadataToInclude, null, 2)}
\`\`\`
</response_metadata>

### Sources
${sourcesText}`;

    return {
      content: [{
        type: 'text',
        text: formattedAnswer
      }]
    };
  }

  /**
   * Build a simple MCP response without structured metadata
   * Use for error cases or simple responses
   */
  buildSimpleMCPResponse(text: string): { content: Array<{ type: string; text: string }> } {
    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }
}

/**
 * Calculate confidence score using the comprehensive confidence module
 */
export function calculateConfidence(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  answer: string
): number {
  const result = calculateConfidenceScore(query, analysis, results, answer);
  return result.score;
}

/**
 * Get full confidence result with factors and explanation
 */
export function getFullConfidenceResult(
  query: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  answer: string
) {
  return calculateConfidenceScore(query, analysis, results, answer);
}

/**
 * Quick confidence check without full analysis
 */
export function getQuickConfidence(results: SearchResult[]): number {
  return quickConfidenceEstimate(results);
}
