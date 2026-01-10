/**
 * Conversation Context Manager
 *
 * Manages conversation history and context for multi-turn interactions.
 * Enables follow-up queries to benefit from prior context.
 *
 * Features:
 * - Per-project context storage
 * - Recent query/keyword tracking
 * - Follow-up detection
 * - Query enhancement with context
 * - TTL-based cleanup
 */

interface ConversationTurn {
  query: string;
  queryType: string;
  timestamp: number;
  keywords: string[];
  project: string;
}

interface ProjectContext {
  turns: ConversationTurn[];
  lastAccess: number;
}

// Configuration
const MAX_TURNS = 5;
const CONTEXT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FOLLOW_UP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Singleton conversation context manager
 */
class ConversationContextManager {
  private contexts: Map<string, ProjectContext> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Add a turn to the conversation context
   */
  addTurn(
    project: string,
    query: string,
    queryType: string,
    keywords: string[]
  ): void {
    const ctx = this.getOrCreateContext(project);

    ctx.turns.push({
      query,
      queryType,
      timestamp: Date.now(),
      keywords,
      project
    });

    // Keep only recent turns
    if (ctx.turns.length > MAX_TURNS) {
      ctx.turns.shift();
    }

    ctx.lastAccess = Date.now();
  }

  /**
   * Get context information for query expansion
   */
  getContextForExpansion(project: string): {
    recentKeywords: string[];
    recentTopics: string[];
    lastQueryType: string | null;
    isFollowUp: boolean;
  } {
    const ctx = this.contexts.get(project);

    if (!ctx || ctx.turns.length === 0) {
      return {
        recentKeywords: [],
        recentTopics: [],
        lastQueryType: null,
        isFollowUp: false
      };
    }

    // Collect unique keywords from recent turns
    const recentKeywords = [...new Set(
      ctx.turns.flatMap(t => t.keywords).slice(-10)
    )];

    // Extract topics (first few words of each query)
    const recentTopics = ctx.turns.map(t =>
      t.query.split(' ').slice(0, 3).join(' ')
    );

    const lastTurn = ctx.turns[ctx.turns.length - 1];
    const isFollowUp = Date.now() - lastTurn.timestamp < FOLLOW_UP_WINDOW_MS;

    return {
      recentKeywords,
      recentTopics,
      lastQueryType: lastTurn.queryType,
      isFollowUp
    };
  }

  /**
   * Enhance a query with conversation context
   * Only adds context keywords if it's a follow-up query
   */
  enhanceQuery(project: string, query: string): string {
    const context = this.getContextForExpansion(project);

    // Don't enhance if not a follow-up or no keywords
    if (!context.isFollowUp || context.recentKeywords.length === 0) {
      return query;
    }

    const queryLower = query.toLowerCase();

    // Find relevant keywords not already in the query
    const relevantKeywords = context.recentKeywords
      .filter(k => !queryLower.includes(k.toLowerCase()))
      .slice(0, 2);

    if (relevantKeywords.length === 0) {
      return query;
    }

    // Add context hint
    return `${query} (related: ${relevantKeywords.join(', ')})`;
  }

  /**
   * Check if the current query seems like a follow-up
   * Based on timing and query similarity
   */
  isLikelyFollowUp(project: string, query: string): boolean {
    const ctx = this.contexts.get(project);
    if (!ctx || ctx.turns.length === 0) return false;

    const lastTurn = ctx.turns[ctx.turns.length - 1];
    const timeSinceLastTurn = Date.now() - lastTurn.timestamp;

    // Too much time has passed
    if (timeSinceLastTurn > FOLLOW_UP_WINDOW_MS) return false;

    // Check for follow-up indicators
    const followUpIndicators = [
      'also', 'and', 'but', 'what about', 'how about',
      'another', 'more', 'else', 'instead', 'alternatively',
      'same', 'similar', 'like', 'as well'
    ];

    const queryLower = query.toLowerCase();
    const hasFollowUpIndicator = followUpIndicators.some(ind =>
      queryLower.includes(ind)
    );

    // Check for pronoun references
    const pronouns = ['it', 'this', 'that', 'these', 'those'];
    const hasPronounReference = pronouns.some(p =>
      queryLower.startsWith(p + ' ') || queryLower.includes(' ' + p + ' ')
    );

    // Check for keyword overlap with recent queries
    const lastKeywords = lastTurn.keywords.map(k => k.toLowerCase());
    const queryWords = query.toLowerCase().split(/\s+/);
    const hasKeywordOverlap = queryWords.some(w =>
      lastKeywords.includes(w) && w.length > 3
    );

    return hasFollowUpIndicator || hasPronounReference || hasKeywordOverlap;
  }

  /**
   * Get recent queries for the project
   */
  getRecentQueries(project: string, limit: number = 3): string[] {
    const ctx = this.contexts.get(project);
    if (!ctx) return [];

    return ctx.turns
      .slice(-limit)
      .map(t => t.query);
  }

  /**
   * Clear context for a specific project
   */
  clearProjectContext(project: string): void {
    this.contexts.delete(project);
  }

  /**
   * Clear all context
   */
  clearAllContext(): void {
    this.contexts.clear();
  }

  private getOrCreateContext(project: string): ProjectContext {
    let ctx = this.contexts.get(project);
    if (!ctx) {
      ctx = { turns: [], lastAccess: Date.now() };
      this.contexts.set(project, ctx);
    }
    return ctx;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [project, ctx] of this.contexts.entries()) {
      if (now - ctx.lastAccess > CONTEXT_TTL_MS) {
        this.contexts.delete(project);
      }
    }
  }

  /**
   * Shutdown cleanup interval (for testing)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const conversationContext = new ConversationContextManager();
