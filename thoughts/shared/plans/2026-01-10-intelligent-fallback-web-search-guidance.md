# Intelligent Fallback with Web Search Guidance Implementation Plan

## Overview

Enhance the MCP server to gracefully handle questions it cannot answer by:
1. Detecting when retrieved documentation is insufficient
2. Extracting what concepts/terms it DOES understand from the query
3. Generating specific, actionable web search queries based on that understanding
4. Returning a structured "I don't know" response with targeted search guidance

This transforms unhelpful "I couldn't find anything" responses into actionable guidance that helps coding agents continue making progress.

## Current State Analysis

### What Exists Now

**Query Analysis** (`packages/shared/src/query-analyzer.ts`):
- `analyzeQuery()` extracts keywords, classifies query type (error, howto, concept, etc.)
- `extractKeywords()` pulls out technical terms (backticked, CamelCase, function-like)
- Query type determines search strategy and expansion keywords

**Confidence Scoring** (`packages/shared/src/confidence.ts`):
- `calculateConfidenceScore()` returns 0-100 with factor breakdown
- Factors: retrieval quality, keyword coverage, answer quality, source consistency
- `evaluateRetrievalQuality()` for quick quality checks ('high'|'medium'|'low')

**Corrective RAG** (`packages/shared/src/corrective-rag.ts`):
- `shouldApplyCorrectiveRAG()` checks if initial results are poor
- `generateAlternativeQueries()` creates query-type-specific alternatives
- `correctiveSearch()` retries with expanded queries up to 2 times

**Current Fallback Handling** (`packages/server/src/tools/ask-docs.ts:92-114`):
- No results: Generic "Try rephrasing" suggestions
- Low confidence (<40): Adds warning but still returns LLM synthesis
- No extraction of WHAT was understood from the query

### Key Discoveries
- The system already extracts keywords at `query-analyzer.ts:214-236`
- Confidence factors are already calculated individually at `confidence.ts:61-66`
- The LLM prompt at `prompts/index.ts:8` already says to admit incomplete information
- `ResponseBuilder` at `response-builder.ts:66-68` supports structured suggestions

### Gap
When results are poor, the system:
1. Does NOT extract what it understood vs what was missing
2. Does NOT generate specific web search queries
3. Returns generic suggestions without leveraging its query understanding
4. The LLM tries to synthesize an answer even from poor results

## Desired End State

After implementation:
1. **Intelligent Detection**: Server detects when it genuinely can't answer (not just low results, but low RELEVANCE to the query)
2. **Understanding Extraction**: Extracts what it DID understand (blockchain/project context, specific concepts, query intent)
3. **Specific Search Queries**: Generates 2-4 targeted web search queries based on:
   - The blockchain/project being asked about
   - The specific technical concept or error
   - The query type (how-to, error fix, API reference, etc.)
4. **Structured Response**: Returns machine-readable response with:
   - Clear "I don't know" admission
   - What it understood from the query
   - Specific web search queries to run
   - Why each query might help

### Verification
- When asked about an undocumented feature, server returns specific search queries
- Search queries include project name and extracted technical terms
- Response metadata includes `searchGuidance` field with structured queries
- Coding agents can directly use suggested queries

## What We're NOT Doing

- Adding actual web search capability to the MCP server (that's the coding agent's job)
- Changing how the LLM synthesizes answers when results ARE good
- Modifying the core search algorithm
- Adding new external API dependencies

## Implementation Approach

Build incrementally:
1. First, create the understanding extraction module (what did we learn from the query?)
2. Then, create the search query generation module (how to find what's missing?)
3. Finally, integrate into ask-docs.ts flow and update response format

---

## Phase 1: Understanding Extraction Module

### Overview
Create a module that analyzes a query and search results to extract what was understood vs what's missing.

### Changes Required:

#### 1. Create Understanding Extractor
**File**: `packages/shared/src/understanding-extractor.ts` (NEW)
**Changes**: Extract query understanding for fallback responses

```typescript
import type { QueryAnalysis } from './query-analyzer.js';
import type { SearchResult } from './types.js';
import { ConfidenceResult } from './confidence.js';

/**
 * Represents what the system understood from a query
 */
export interface QueryUnderstanding {
  /** The blockchain/project being asked about */
  project: string;
  /** Query type classification */
  queryType: string;
  /** Technical terms extracted from the query */
  technicalTerms: string[];
  /** Concepts that WERE found in documentation (partial matches) */
  coveredConcepts: string[];
  /** Concepts that were NOT found in documentation */
  uncoveredConcepts: string[];
  /** The core intent/action the user is trying to accomplish */
  intent: string;
  /** Confidence that we understood the query correctly (not answer confidence) */
  understandingConfidence: number;
}

/**
 * Extract understanding from query and search results
 */
export function extractQueryUnderstanding(
  query: string,
  project: string,
  analysis: QueryAnalysis,
  results: SearchResult[],
  confidenceResult: ConfidenceResult
): QueryUnderstanding {
  // Extract technical terms from query
  const technicalTerms = analysis.keywords;

  // Check which terms appear in results
  const resultContent = results
    .map(r => r.chunk.content.toLowerCase())
    .join(' ');

  const coveredConcepts = technicalTerms.filter(term =>
    resultContent.includes(term.toLowerCase())
  );

  const uncoveredConcepts = technicalTerms.filter(term =>
    !resultContent.includes(term.toLowerCase())
  );

  // Extract intent based on query type
  const intent = extractIntent(query, analysis.type);

  // Calculate understanding confidence (separate from answer confidence)
  // High if we at least understand what they're asking for
  const understandingConfidence = calculateUnderstandingConfidence(
    query,
    analysis,
    technicalTerms
  );

  return {
    project,
    queryType: analysis.type,
    technicalTerms,
    coveredConcepts,
    uncoveredConcepts,
    intent,
    understandingConfidence
  };
}

/**
 * Extract the user's intent from the query
 */
function extractIntent(query: string, queryType: string): string {
  const lowerQuery = query.toLowerCase();

  switch (queryType) {
    case 'error':
      // Extract what operation was failing
      const errorMatch = query.match(/(?:when|while|trying to|cannot)\s+(\w+(?:\s+\w+){0,3})/i);
      return errorMatch
        ? `fix error when ${errorMatch[1]}`
        : 'fix error or exception';

    case 'howto':
      // Extract the action they want to accomplish
      const howtoMatch = query.match(/(?:how to|how do i|how can i)\s+(.+?)(?:\?|$)/i);
      return howtoMatch
        ? howtoMatch[1].trim()
        : query.replace(/^how\s+(do|to|can|should)\s+(i\s+)?/i, '').split('?')[0].trim();

    case 'concept':
      // Extract what they want to understand
      const conceptMatch = query.match(/(?:what is|explain|what does)\s+(.+?)(?:\?|$)/i);
      return conceptMatch
        ? `understand ${conceptMatch[1].trim()}`
        : 'understand concept';

    case 'code_lookup':
      // Extract what code/API they're looking for
      return `find code for ${query.replace(/`/g, '').slice(0, 50)}`;

    case 'api_reference':
      return `find API documentation for ${query.slice(0, 50)}`;

    default:
      return query.slice(0, 100);
  }
}

/**
 * Calculate how well we understood the query itself (not the answer)
 */
function calculateUnderstandingConfidence(
  query: string,
  analysis: QueryAnalysis,
  technicalTerms: string[]
): number {
  let confidence = 50; // Base confidence

  // Bonus if we identified query type (not 'general')
  if (analysis.type !== 'general') {
    confidence += 20;
  }

  // Bonus if we extracted technical terms
  if (technicalTerms.length > 0) {
    confidence += Math.min(technicalTerms.length * 10, 30);
  }

  // Penalty for very short queries
  if (query.split(' ').length < 3) {
    confidence -= 15;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Determine if we should give up and suggest web search
 * Returns true if documentation is insufficient
 */
export function shouldSuggestWebSearch(
  results: SearchResult[],
  confidence: number,
  understanding: QueryUnderstanding
): boolean {
  // No results at all - definitely suggest web search
  if (results.length === 0) {
    return true;
  }

  // Very low confidence with results - results are probably irrelevant
  if (confidence < 25 && results.length < 5) {
    return true;
  }

  // Most concepts weren't covered
  const coverageRatio = understanding.coveredConcepts.length /
    Math.max(understanding.technicalTerms.length, 1);
  if (coverageRatio < 0.3 && understanding.technicalTerms.length > 0) {
    return true;
  }

  // Low confidence AND poor coverage - don't try to synthesize
  if (confidence < 35 && coverageRatio < 0.5) {
    return true;
  }

  return false;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Unit tests pass for extraction functions
- [ ] TypeScript types are exported correctly

#### Manual Verification:
- [ ] `extractQueryUnderstanding()` correctly identifies covered vs uncovered concepts
- [ ] `shouldSuggestWebSearch()` returns true for genuinely unanswerable queries
- [ ] Intent extraction produces sensible results for different query types

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Web Search Query Generation

### Overview
Create a module that generates specific, actionable web search queries based on query understanding.

### Changes Required:

#### 1. Create Search Query Generator
**File**: `packages/shared/src/search-query-generator.ts` (NEW)
**Changes**: Generate targeted web search queries

```typescript
import type { QueryUnderstanding } from './understanding-extractor.js';

/**
 * A suggested web search query with context
 */
export interface WebSearchQuery {
  /** The actual search query string */
  query: string;
  /** Why this query might help */
  rationale: string;
  /** Search engine hint (e.g., 'google', 'github', 'stackoverflow') */
  suggestedEngine: 'google' | 'github' | 'stackoverflow' | 'docs';
  /** Priority (1 = try first) */
  priority: number;
}

/**
 * Complete search guidance for the coding agent
 */
export interface SearchGuidance {
  /** Clear statement of what the server couldn't answer */
  whatWeCouldntFind: string;
  /** What the server DID understand from the query */
  whatWeUnderstood: {
    project: string;
    intent: string;
    technicalTerms: string[];
  };
  /** Specific search queries to try */
  suggestedSearches: WebSearchQuery[];
  /** Additional tips for the coding agent */
  tips: string[];
}

/**
 * Generate search guidance based on query understanding
 */
export function generateSearchGuidance(
  understanding: QueryUnderstanding,
  originalQuery: string
): SearchGuidance {
  const searches: WebSearchQuery[] = [];

  // Generate project-specific search
  const projectQuery = generateProjectSearch(understanding);
  if (projectQuery) searches.push(projectQuery);

  // Generate query-type-specific searches
  const typeQueries = generateTypeSpecificSearches(understanding, originalQuery);
  searches.push(...typeQueries);

  // Generate technical term searches
  const termQueries = generateTermSearches(understanding);
  searches.push(...termQueries);

  // Sort by priority and limit to 4 queries
  const sortedSearches = searches
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  return {
    whatWeCouldntFind: generateGapDescription(understanding, originalQuery),
    whatWeUnderstood: {
      project: understanding.project,
      intent: understanding.intent,
      technicalTerms: understanding.technicalTerms
    },
    suggestedSearches: sortedSearches,
    tips: generateSearchTips(understanding)
  };
}

/**
 * Generate a project-specific search query
 */
function generateProjectSearch(understanding: QueryUnderstanding): WebSearchQuery | null {
  const { project, intent, technicalTerms } = understanding;

  // Get project-specific search terms
  const projectTerms = getProjectSearchTerms(project);

  // Combine with intent and technical terms
  const keyTerms = technicalTerms.slice(0, 2).join(' ');
  const searchIntent = intent.slice(0, 50);

  return {
    query: `${projectTerms.name} ${keyTerms} ${searchIntent}`.trim(),
    rationale: `Search for ${projectTerms.name}-specific documentation or tutorials about this topic`,
    suggestedEngine: 'google',
    priority: 1
  };
}

/**
 * Get project-specific search terms
 */
function getProjectSearchTerms(project: string): { name: string; sdkName: string; keywords: string[] } {
  const projectMap: Record<string, { name: string; sdkName: string; keywords: string[] }> = {
    mina: {
      name: 'Mina Protocol',
      sdkName: 'o1js',
      keywords: ['zkApp', 'zero knowledge', 'provable', 'SmartContract']
    },
    solana: {
      name: 'Solana',
      sdkName: 'Anchor',
      keywords: ['program', 'PDA', 'token', 'SPL']
    },
    cosmos: {
      name: 'Cosmos SDK',
      sdkName: 'cosmos-sdk',
      keywords: ['module', 'keeper', 'IBC', 'chain']
    }
  };

  return projectMap[project.toLowerCase()] || {
    name: project,
    sdkName: project,
    keywords: []
  };
}

/**
 * Generate query-type-specific search queries
 */
function generateTypeSpecificSearches(
  understanding: QueryUnderstanding,
  originalQuery: string
): WebSearchQuery[] {
  const { queryType, project, technicalTerms, intent } = understanding;
  const projectTerms = getProjectSearchTerms(project);
  const keyTerms = technicalTerms.slice(0, 2).join(' ');

  switch (queryType) {
    case 'error':
      return [
        {
          query: `${projectTerms.name} ${keyTerms} error fix`,
          rationale: 'Search for error solutions specific to this blockchain',
          suggestedEngine: 'stackoverflow',
          priority: 2
        },
        {
          query: `site:github.com ${projectTerms.sdkName} ${keyTerms} issue`,
          rationale: 'Check if others have reported this issue on GitHub',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    case 'howto':
      return [
        {
          query: `${projectTerms.name} tutorial ${intent}`,
          rationale: 'Search for tutorials covering this task',
          suggestedEngine: 'google',
          priority: 2
        },
        {
          query: `${projectTerms.sdkName} example ${keyTerms}`,
          rationale: 'Look for code examples in the SDK or related repos',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    case 'concept':
      return [
        {
          query: `${projectTerms.name} ${keyTerms} explained`,
          rationale: 'Search for explanations of this concept',
          suggestedEngine: 'google',
          priority: 2
        },
        {
          query: `what is ${keyTerms} ${projectTerms.name}`,
          rationale: 'Find introductory content about this concept',
          suggestedEngine: 'google',
          priority: 3
        }
      ];

    case 'code_lookup':
    case 'api_reference':
      return [
        {
          query: `${projectTerms.sdkName} ${keyTerms} API`,
          rationale: 'Search for API documentation',
          suggestedEngine: 'docs',
          priority: 2
        },
        {
          query: `site:github.com ${projectTerms.sdkName} ${keyTerms}`,
          rationale: 'Search for usage examples in GitHub code',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    default:
      return [
        {
          query: `${projectTerms.name} ${keyTerms} documentation`,
          rationale: 'General documentation search',
          suggestedEngine: 'google',
          priority: 2
        }
      ];
  }
}

/**
 * Generate searches for specific technical terms
 */
function generateTermSearches(understanding: QueryUnderstanding): WebSearchQuery[] {
  const { uncoveredConcepts, project } = understanding;
  const projectTerms = getProjectSearchTerms(project);

  // Only generate if we have uncovered concepts
  if (uncoveredConcepts.length === 0) return [];

  // Focus on the most important uncovered term
  const mainTerm = uncoveredConcepts[0];

  return [{
    query: `${projectTerms.name} ${mainTerm} documentation`,
    rationale: `"${mainTerm}" wasn't found in our indexed docs - search for official documentation`,
    suggestedEngine: 'google',
    priority: 4
  }];
}

/**
 * Generate description of what we couldn't find
 */
function generateGapDescription(
  understanding: QueryUnderstanding,
  originalQuery: string
): string {
  const { technicalTerms, uncoveredConcepts, project, queryType } = understanding;

  if (uncoveredConcepts.length > 0) {
    const terms = uncoveredConcepts.slice(0, 3).map(t => `"${t}"`).join(', ');
    return `I couldn't find documentation about ${terms} in the ${project} docs I have indexed.`;
  }

  if (technicalTerms.length === 0) {
    return `I couldn't find specific documentation matching your ${queryType} query about ${project}.`;
  }

  return `The ${project} documentation I have doesn't contain enough information to answer this ${queryType} question.`;
}

/**
 * Generate helpful tips for the coding agent
 */
function generateSearchTips(understanding: QueryUnderstanding): string[] {
  const tips: string[] = [];
  const projectTerms = getProjectSearchTerms(understanding.project);

  // Project-specific tips
  switch (understanding.project.toLowerCase()) {
    case 'mina':
      tips.push(`For o1js questions, also try searching the o1-labs GitHub org`);
      tips.push(`The Mina Discord often has answers not in official docs`);
      break;
    case 'solana':
      tips.push(`Anchor documentation at anchor-lang.com may have additional info`);
      tips.push(`Solana Cookbook (solanacookbook.com) has many practical examples`);
      break;
    case 'cosmos':
      tips.push(`Check the Cosmos SDK GitHub discussions for implementation patterns`);
      break;
  }

  // Query-type-specific tips
  if (understanding.queryType === 'error') {
    tips.push(`Include the exact error message in your search for better results`);
  }

  if (understanding.queryType === 'howto') {
    tips.push(`Look for "getting started" or "quickstart" guides for foundational context`);
  }

  return tips.slice(0, 3);
}

/**
 * Format search guidance for display in response
 */
export function formatSearchGuidanceForResponse(guidance: SearchGuidance): string {
  const lines: string[] = [];

  lines.push(`## I Don't Have Enough Information\n`);
  lines.push(guidance.whatWeCouldntFind);
  lines.push('');

  lines.push(`### What I Understood From Your Question`);
  lines.push(`- **Project**: ${guidance.whatWeUnderstood.project}`);
  lines.push(`- **What you're trying to do**: ${guidance.whatWeUnderstood.intent}`);
  if (guidance.whatWeUnderstood.technicalTerms.length > 0) {
    lines.push(`- **Key terms**: ${guidance.whatWeUnderstood.technicalTerms.join(', ')}`);
  }
  lines.push('');

  lines.push(`### Suggested Web Searches`);
  lines.push(`Run these searches to find the information:\n`);

  for (const search of guidance.suggestedSearches) {
    const engineLabel = {
      google: '🔍 Google',
      github: '🐙 GitHub',
      stackoverflow: '📚 Stack Overflow',
      docs: '📖 Docs'
    }[search.suggestedEngine];

    lines.push(`**${engineLabel}**: \`${search.query}\``);
    lines.push(`  _${search.rationale}_\n`);
  }

  if (guidance.tips.length > 0) {
    lines.push(`### Additional Tips`);
    for (const tip of guidance.tips) {
      lines.push(`- ${tip}`);
    }
  }

  return lines.join('\n');
}
```

#### 2. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Add exports for new modules

```typescript
// Add to existing exports
export * from './understanding-extractor.js';
export * from './search-query-generator.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors
- [ ] New exports are accessible from shared package

#### Manual Verification:
- [ ] Generated search queries include project name
- [ ] Different query types produce different search strategies
- [ ] Tips are project-specific and relevant

**Implementation Note**: After completing this phase, pause for manual verification that the generated searches are sensible before proceeding.

---

## Phase 3: Integration into Ask-Docs Tool

### Overview
Integrate the understanding extraction and search guidance into the ask-docs tool flow.

### Changes Required:

#### 1. Update ask-docs.ts
**File**: `packages/server/src/tools/ask-docs.ts`
**Changes**: Add intelligent fallback with search guidance

```typescript
import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import {
  analyzeQuery,
  correctiveSearch,
  shouldApplyCorrectiveRAG,
  // NEW imports
  extractQueryUnderstanding,
  shouldSuggestWebSearch,
  generateSearchGuidance,
  formatSearchGuidanceForResponse
} from '@mina-docs/shared';
import { formatSearchResultsAsContext, getProjectContext } from './context-formatter.js';
import { ResponseBuilder, calculateConfidence, getFullConfidenceResult } from '../utils/response-builder.js';
import { generateSuggestions, generateRelatedQueries } from '../utils/suggestion-generator.js';
import { conversationContext } from '../context/conversation-context.js';
import { logger } from '../utils/logger.js';

export const AskDocsSchema = z.object({
  question: z.string().describe('Your question about the documentation'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type AskDocsArgs = z.infer<typeof AskDocsSchema>;

export async function askDocs(
  args: AskDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = new ResponseBuilder();

  // 1. Analyze query to optimize search
  logger.debug('Analyzing query...');
  const analysis = analyzeQuery(args.question);
  builder.setQueryType(analysis.type);
  logger.queryAnalysis(analysis);

  // 2. Enhance query with conversation context (for follow-ups)
  const enhancedQuery = conversationContext.enhanceQuery(args.project, analysis.expandedQuery);
  const isFollowUp = conversationContext.isLikelyFollowUp(args.project, args.question);
  if (isFollowUp) {
    logger.info('Detected follow-up query, using conversation context');
  }
  if (enhancedQuery !== analysis.expandedQuery) {
    logger.debug(`Enhanced query: "${enhancedQuery}"`);
  }

  // 3. Initial retrieval
  logger.info('Performing initial search...');
  const searchStart = Date.now();
  const initialResults = await context.search.search(enhancedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });
  logger.search(enhancedQuery, initialResults.length, Date.now() - searchStart);

  // 4. Apply corrective RAG if initial results are poor
  let results = initialResults;
  let wasRetried = false;
  let alternativeQueries: string[] = [];

  if (shouldApplyCorrectiveRAG(initialResults)) {
    logger.info('Initial results poor, applying corrective RAG...');
    const correctiveStart = Date.now();
    const corrective = await correctiveSearch(
      context.search,
      args.question,
      analysis,
      args.project,
      { maxRetries: 2, mergeResults: true }
    );
    results = corrective.results;
    wasRetried = corrective.wasRetried;
    alternativeQueries = corrective.alternativeQueries;

    logger.correctiveRAG(wasRetried, corrective.retriesUsed, alternativeQueries);
    logger.info(`Corrective RAG completed in ${Date.now() - correctiveStart}ms, now have ${results.length} results`);

    if (wasRetried) {
      builder.addWarning(`Initial search had low relevance; retried with: ${alternativeQueries.join(', ')}`);
    }
  }

  // 5. Store in conversation context for future follow-ups
  conversationContext.addTurn(args.project, args.question, analysis.type, analysis.keywords);
  logger.debug('Stored query in conversation context');

  // 6. Set retrieval quality and sources
  builder.setRetrievalQuality(results);
  builder.setSources(results);

  // 7. Calculate confidence BEFORE deciding on response strategy
  const confidenceResult = getFullConfidenceResult(args.question, analysis, results, '');

  // 8. Extract understanding for potential fallback
  const understanding = extractQueryUnderstanding(
    args.question,
    args.project,
    analysis,
    results,
    confidenceResult
  );

  // 9. NEW: Check if we should suggest web search instead of synthesizing
  if (shouldSuggestWebSearch(results, confidenceResult.score, understanding)) {
    logger.info('Documentation insufficient, generating web search guidance...');

    const searchGuidance = generateSearchGuidance(understanding, args.question);
    const guidanceResponse = formatSearchGuidanceForResponse(searchGuidance);

    // Set low confidence
    builder.setConfidence(Math.min(confidenceResult.score, 20));
    builder.addWarning('Documentation insufficient for this query - web search recommended');

    // Add structured search guidance to metadata
    builder.setSearchGuidance(searchGuidance);

    // Add suggestion to use web search
    for (const search of searchGuidance.suggestedSearches.slice(0, 2)) {
      builder.addSuggestion(
        'web_search',
        search.rationale,
        { query: search.query, engine: search.suggestedEngine }
      );
    }

    return builder.buildMCPResponse(guidanceResponse);
  }

  // 10. Handle complete no results case (fallback if web search check passed somehow)
  if (results.length === 0) {
    logger.warn('No results found for query');
    builder.setConfidence(0);
    builder.addWarning('No documentation found for this query');
    builder.addSuggestion(
      'search_docs',
      'Try a broader keyword search',
      {
        query: analysis.keywords[0] || args.question.split(' ')[0],
        project: args.project
      }
    );
    builder.addSuggestion(
      'list_projects',
      'Verify the project name is correct',
      {}
    );

    return builder.buildMCPResponse(
      `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
    );
  }

  // 11. Format chunks with rich metadata for better code generation
  logger.debug(`Formatting ${results.length} chunks for LLM context`);
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  // 12. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 13. Synthesize answer with project context
  logger.info('Synthesizing answer with LLM...');
  const llmStart = Date.now();
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system + projectContext,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );
  logger.llmSynthesis(contextChunks.length, answer.length, Date.now() - llmStart);

  // 14. Recalculate confidence with actual answer
  const finalConfidence = calculateConfidence(args.question, analysis, results, answer);
  builder.setConfidence(finalConfidence);
  logger.confidence(finalConfidence);

  // 15. Add warnings based on confidence and context
  if (finalConfidence < 40) {
    logger.warn(`Low confidence score: ${finalConfidence}`);
    builder.addWarning('Low confidence - results may not fully address your question');

    // Even for low confidence, add search guidance as supplementary info
    const searchGuidance = generateSearchGuidance(understanding, args.question);
    builder.addSuggestion(
      'web_search',
      'Consider web search for more comprehensive information',
      { query: searchGuidance.suggestedSearches[0]?.query || args.question }
    );
  }
  if (isFollowUp) {
    builder.addWarning('This appears to be a follow-up question - context from previous queries was considered');
  }

  // 16. Generate contextual suggestions
  const suggestions = generateSuggestions(analysis, results, args.project);
  suggestions.forEach(s => builder.addSuggestion(s.action, s.reason, s.params));
  logger.debug(`Generated ${suggestions.length} follow-up suggestions`);

  // 17. Generate related queries
  const relatedQueries = generateRelatedQueries(args.question, analysis, results, args.project);
  relatedQueries.forEach(q => builder.addRelatedQuery(q));

  return builder.buildMCPResponse(answer);
}
```

#### 2. Update ResponseBuilder
**File**: `packages/server/src/utils/response-builder.ts`
**Changes**: Add support for search guidance in metadata

```typescript
// Add to imports
import type { SearchGuidance } from '@mina-docs/shared';

// Add to AgentResponseMetadata type (or ensure it exists in shared/types.ts)
// searchGuidance?: SearchGuidance;

// Add to ResponseBuilder class
export class ResponseBuilder {
  // ... existing properties ...
  private searchGuidance?: SearchGuidance;

  // Add new method
  setSearchGuidance(guidance: SearchGuidance): this {
    this.searchGuidance = guidance;
    return this;
  }

  // Update build() method to include searchGuidance
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
        searchGuidance: this.searchGuidance // NEW
      },
      sources: this.sources
    };
  }
}
```

#### 3. Update Types
**File**: `packages/shared/src/types.ts`
**Changes**: Add SearchGuidance to metadata type

```typescript
// Add import
import type { SearchGuidance } from './search-query-generator.js';

// Update AgentResponseMetadata interface
export interface AgentResponseMetadata {
  confidence: number;
  retrievalQuality: 'high' | 'medium' | 'low' | 'none';
  sourcesUsed: number;
  queryType: string;
  suggestions: Array<{
    action: string;
    reason: string;
    params?: Record<string, string>;
  }>;
  relatedQueries?: string[];
  warnings?: string[];
  processingTimeMs: number;
  searchGuidance?: SearchGuidance; // NEW: Structured search guidance when docs are insufficient
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compiles without errors
- [ ] No breaking changes to existing functionality

#### Manual Verification:
- [ ] Query about undocumented topic returns search guidance
- [ ] Search guidance includes project-specific queries
- [ ] Low confidence responses include supplementary search suggestion
- [ ] Well-answered queries (high confidence) don't trigger search guidance

**Implementation Note**: After completing this phase, test with various query types before proceeding.

---

## Phase 4: Testing and Edge Cases

### Overview
Test the implementation with various scenarios and handle edge cases.

### Test Cases to Verify:

#### 1. Clear "I Don't Know" Scenarios
- Query about feature not in indexed docs
- Query about different blockchain project
- Query with made-up technical terms
- Empty project (no docs indexed)

#### 2. Borderline Scenarios
- Low confidence but some relevant results
- High results count but low relevance
- Follow-up question with no prior context

#### 3. Should NOT Trigger Search Guidance
- Query with high confidence answer
- Query that matches documentation well
- Simple concept questions with good coverage

### Changes Required:

#### 1. Add Integration Tests
**File**: `packages/server/src/__tests__/intelligent-fallback.test.ts` (NEW)
**Changes**: Test the intelligent fallback behavior

```typescript
import { extractQueryUnderstanding, shouldSuggestWebSearch, generateSearchGuidance } from '@mina-docs/shared';
import { analyzeQuery, calculateConfidenceScore } from '@mina-docs/shared';

describe('Intelligent Fallback', () => {
  describe('shouldSuggestWebSearch', () => {
    it('returns true for no results', () => {
      const results: any[] = [];
      const confidence = 0;
      const understanding = {
        project: 'mina',
        queryType: 'howto',
        technicalTerms: ['zkApp'],
        coveredConcepts: [],
        uncoveredConcepts: ['zkApp'],
        intent: 'deploy zkApp',
        understandingConfidence: 70
      };

      expect(shouldSuggestWebSearch(results, confidence, understanding)).toBe(true);
    });

    it('returns false for high confidence results', () => {
      const results = [{ chunk: { content: 'zkApp deployment...' }, score: 0.8 }];
      const confidence = 75;
      const understanding = {
        project: 'mina',
        queryType: 'howto',
        technicalTerms: ['zkApp'],
        coveredConcepts: ['zkApp'],
        uncoveredConcepts: [],
        intent: 'deploy zkApp',
        understandingConfidence: 90
      };

      expect(shouldSuggestWebSearch(results as any, confidence, understanding)).toBe(false);
    });
  });

  describe('generateSearchGuidance', () => {
    it('generates project-specific search queries', () => {
      const understanding = {
        project: 'mina',
        queryType: 'howto',
        technicalTerms: ['recursiveProof', 'zkProgram'],
        coveredConcepts: [],
        uncoveredConcepts: ['recursiveProof', 'zkProgram'],
        intent: 'create recursive proofs',
        understandingConfidence: 60
      };

      const guidance = generateSearchGuidance(understanding, 'how to create recursive proofs in o1js');

      expect(guidance.suggestedSearches.length).toBeGreaterThan(0);
      expect(guidance.suggestedSearches[0].query).toContain('Mina');
      expect(guidance.whatWeUnderstood.project).toBe('mina');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All new tests pass: `npm test`
- [ ] No regressions in existing tests
- [ ] Build succeeds with test coverage

#### Manual Verification:
- [ ] Test with real queries that should trigger fallback
- [ ] Test with queries that should NOT trigger fallback
- [ ] Verify search guidance is actionable and specific

---

## Testing Strategy

### Unit Tests:
- Understanding extraction with various query types
- Search query generation for different projects
- shouldSuggestWebSearch threshold behavior
- Coverage calculation accuracy

### Integration Tests:
- End-to-end ask-docs with fallback triggered
- Verify MCP response format includes searchGuidance
- Verify suggestions include web_search action

### Manual Testing Steps:
1. Ask about a feature not in indexed docs (e.g., "How do I use the new XYZ feature in o1js?")
2. Verify response includes specific search queries mentioning "Mina Protocol" or "o1js"
3. Ask about documented feature and verify NO search guidance is shown
4. Check that low confidence answers include supplementary search suggestion

## Performance Considerations

- Understanding extraction is lightweight (string operations only)
- Search query generation adds minimal latency (<5ms)
- No additional API calls - all logic is local
- Early exit path (shouldSuggestWebSearch) avoids LLM call when docs are insufficient

## Migration Notes

1. **No breaking changes**: All new functionality is additive
2. **Metadata extension**: `searchGuidance` field is optional in response
3. **Backward compatible**: Existing integrations continue to work unchanged
4. **Gradual adoption**: Coding agents can choose to use searchGuidance or ignore it

## References

- Query analyzer: `packages/shared/src/query-analyzer.ts`
- Confidence scoring: `packages/shared/src/confidence.ts`
- Corrective RAG: `packages/shared/src/corrective-rag.ts`
- Ask-docs tool: `packages/server/src/tools/ask-docs.ts`
- Response builder: `packages/server/src/utils/response-builder.ts`
- Types: `packages/shared/src/types.ts`
