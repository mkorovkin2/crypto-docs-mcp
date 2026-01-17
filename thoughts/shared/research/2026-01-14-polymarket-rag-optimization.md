---
date: 2026-01-14T10:00:00-08:00
topic: "Improving Polymarket RAG for High-Quality Abstract Question Answering"
tags: [research, polymarket, rag, documentation, optimization, abstract-questions]
status: complete
last_updated: 2026-01-14
---

# Research: Improving Polymarket RAG for High-Quality Abstract Question Answering

**Date**: 2026-01-14

## Research Question
How can we improve this system to get a lot more Polymarket documentation and make the RAG really effective for abstract questions, enabling high-quality answers?

## Summary

The current system has **2 Polymarket sources** (Python and TypeScript CLOB clients) but is missing significant documentation. To enable high-quality answers for abstract questions, improvements are needed across three dimensions:

1. **Documentation Coverage** - Expand from 2 to 15+ sources including official docs, API specs, community examples, and tutorials
2. **Retrieval Quality** - Improve chunking, add contextual retrieval, and enhance reranking for abstract queries
3. **Answer Synthesis** - Optimize prompts for conceptual questions and add knowledge graph traversal

**Key Gap**: Abstract questions like "How does Polymarket handle market resolution?" fail because the system lacks conceptual documentation and treats all queries identically.

## Detailed Findings

### Current Polymarket Coverage

**Existing Sources** (from `config/sources/project-sources.json:53-57`):
1. `polymarket-py-clob-client` - Python SDK for CLOB API
2. `polymarket-clob-client` - TypeScript SDK for CLOB API

**What's Missing**:
- Official Polymarket documentation (https://docs.polymarket.com)
- Polymarket Learn articles (conceptual explanations)
- Market resolution documentation
- Fee structure documentation
- API endpoint specifications
- Order types and trading mechanics
- Position management guides
- Community trading bots and examples
- Gamma Market Making interface docs
- Historical market data documentation

### Gap Analysis for Abstract Questions

**Why Abstract Questions Fail**:

1. **Source Gap**: Only SDK code is indexed, not conceptual documentation
2. **Chunking Issues**: Token-based chunking breaks explanatory prose at arbitrary points
3. **Query Handling**: No differentiation between "How does X work?" vs "Show me code for X"
4. **Retrieval Bias**: Vector similarity favors code matches over conceptual explanations
5. **No Context Expansion**: Adjacent chunks not retrieved for fuller understanding

**Example Failing Queries**:
- "How does Polymarket determine market outcomes?" - No resolution docs
- "What are the fees on Polymarket?" - No fee structure docs
- "How do limit orders work on Polymarket?" - Only SDK method signatures, not explanations
- "What's the difference between market maker and taker?" - No conceptual docs

---

## Recommendations

### Priority 1: Expand Polymarket Documentation Sources

#### 1.1 Add Official Documentation Site

**Action**: Add Polymarket docs to `config/projects/polymarket.json`

```json
{
  "id": "polymarket",
  "name": "Polymarket",
  "baseUrl": "https://docs.polymarket.com",
  "excludePatterns": ["/api/", "/changelog/"],
  "maxPages": 500,
  "concurrency": 3,
  "delay": 1000,
  "useBrowser": false
}
```

**Expected Yield**: 50-100+ documentation pages covering:
- Trading mechanics
- Market resolution
- API reference
- SDK guides
- Fee structure

#### 1.2 Add Polymarket Learn/Help Center

Many prediction markets have educational content. Search for and add:
- Polymarket help center URLs
- FAQ pages
- Trading guides
- Glossary/terminology pages

#### 1.3 Add Community GitHub Sources

Use the `collect-sources` script to discover:

```bash
npm run collect-sources -- \
  --prompt "Polymarket trading bot examples github" \
  --count 30

npm run collect-sources -- \
  --prompt "Polymarket API integration tutorial" \
  --count 20
```

**Expected Additional Sources**:
- Trading bot implementations
- Market analysis tools
- Order execution examples
- Position tracking utilities
- Arbitrage scripts
- Data analysis notebooks

#### 1.4 Add Gamma Market Making Docs

Polymarket uses Gamma for market making. Add:
- Gamma documentation
- Liquidity provision guides
- Market making strategy docs

#### 1.5 Create Manual Conceptual Documents

For topics lacking public documentation, create curated docs:

**File**: `docs/polymarket/concepts/market-resolution.md`
```markdown
# Polymarket Market Resolution

## How Markets Resolve
[Curated explanation of resolution process]

## Resolution Sources
[UMA oracle, emergency resolution, etc.]

## Edge Cases
[Tie handling, invalidation, etc.]
```

**Topics to Cover**:
- Market lifecycle (creation → trading → resolution → settlement)
- Order types (limit, market, conditional)
- Fee structure (maker, taker, withdrawal)
- Position management (buying, selling, redeeming)
- Price mechanics (LMSR, order book)

### Priority 2: Improve Retrieval for Abstract Questions

#### 2.1 Implement Query Type-Aware Retrieval

**Current State**: All queries use same search parameters
**Improvement**: Adjust retrieval based on query classification

**Location**: `packages/shared/src/query-analyzer.ts`

```typescript
export function getOptimizedSearchOptions(query: string): SearchOptions {
  const type = classifyQuery(query);

  switch (type) {
    case 'concept':
      return {
        limit: 15,           // More chunks for comprehensive explanation
        contentType: 'prose', // Prioritize explanatory text
        rerank: true,
        rerankTopK: 12,
        expandAdjacent: true, // Get surrounding context
        adjacentWindow: 3,    // Larger window for concepts
      };

    case 'howto':
      return {
        limit: 12,
        contentType: undefined, // Mix of prose and code
        rerank: true,
        rerankTopK: 10,
        expandAdjacent: true,
        adjacentWindow: 2,
      };

    case 'code_lookup':
      return {
        limit: 8,
        contentType: 'code',
        rerank: true,
        rerankTopK: 8,
        expandAdjacent: false, // Code is self-contained
      };

    default:
      return { limit: 10, rerank: true, rerankTopK: 10 };
  }
}
```

#### 2.2 Add Contextual Retrieval (Anthropic Technique)

**Impact**: 35-67% reduction in retrieval failures

**Implementation**: Prepend LLM-generated context to chunks before embedding

**Location**: `packages/scraper/src/index.ts` (before embedding)

```typescript
async function addContextualPrefix(chunk: DocumentChunk): Promise<DocumentChunk> {
  // Only for prose/concept chunks
  if (chunk.contentType !== 'prose') return chunk;

  const prefix = await llm.synthesize({
    system: `Generate a 2-3 sentence context prefix explaining what this chunk covers,
             what concepts it relates to, and how it fits in the broader documentation.`,
    user: `Project: ${chunk.project}
           Title: ${chunk.title}
           Section: ${chunk.section}
           Content preview: ${chunk.content.slice(0, 800)}`
  });

  return {
    ...chunk,
    content: `${prefix}\n\n${chunk.content}`,
    metadata: { ...chunk.metadata, hasContextualPrefix: true }
  };
}
```

#### 2.3 Enhance Reranker for Conceptual Queries

**Current**: Uses 500 chars preview, same for all query types
**Improvement**: Query-type-aware reranking

**Location**: `packages/shared/src/reranker.ts`

```typescript
// Adjust preview length by query type
const previewLength = queryType === 'concept' ? 3000 :
                      queryType === 'howto' ? 2000 :
                      1500;

// Adjust scoring prompt for concepts
const conceptScoringInstructions = `
For conceptual/explanatory queries, prioritize:
1. Documents that EXPLAIN the concept, not just mention it
2. Documents with definitions, examples, and context
3. Documents that cover related concepts for fuller understanding
4. Comprehensive sections over brief mentions

Deprioritize:
- API reference docs that only show method signatures
- Code snippets without explanatory context
- Changelog entries or version notes
`;
```

#### 2.4 Implement Semantic Chunking for Prose

**Current**: Token-based chunking (1500 tokens, 150 overlap)
**Problem**: Breaks explanatory content mid-paragraph

**Improvement**: Semantic chunking that respects document structure

```typescript
function semanticChunkProse(content: string, headings: string[]): DocumentChunk[] {
  // Split on heading boundaries first
  const sections = splitByHeadings(content);

  // Then apply token limits within sections
  return sections.flatMap(section => {
    if (estimateTokens(section.content) <= 2000) {
      return [section]; // Keep section intact
    }
    // Split large sections by paragraph with overlap
    return splitByParagraphsWithOverlap(section, 2000, 200);
  });
}
```

### Priority 3: Improve Answer Synthesis for Abstract Questions

#### 3.1 Add Concept-Specific Prompt Templates

**Location**: `packages/server/src/prompts/index.ts`

```typescript
export const conceptExplanationPrompt = `
You are explaining blockchain/trading concepts to a developer.

INSTRUCTIONS:
1. Start with a clear, one-sentence definition
2. Explain HOW it works mechanically
3. Explain WHY it exists (the problem it solves)
4. Give a concrete example
5. Note any edge cases or common misconceptions
6. Reference related concepts the developer should understand

FORMAT:
## What is [Concept]?
[Definition]

## How It Works
[Mechanical explanation]

## Why It Matters
[Problem solved, use cases]

## Example
[Concrete scenario]

## Related Concepts
[Links to other topics]

## Sources
[Citations from provided documentation]
`;
```

#### 3.2 Implement Multi-Hop Retrieval for Complex Questions

**Problem**: Abstract questions often require synthesizing multiple documents

**Solution**: Query decomposition and iterative retrieval

```typescript
async function multiHopRetrieval(query: string): Promise<SearchResult[]> {
  // Step 1: Decompose query into sub-questions
  const subQueries = await decomposeQuery(query);
  // "How does Polymarket handle market resolution?" →
  // ["What are Polymarket markets?", "What is resolution?", "Who resolves markets?"]

  // Step 2: Retrieve for each sub-query
  const allResults = await Promise.all(
    subQueries.map(sq => hybridSearch.search(sq))
  );

  // Step 3: Merge and deduplicate with RRF
  return mergeWithRRF(allResults);
}
```

#### 3.3 Add Knowledge Graph for Concept Relationships

**High Effort, High Impact** for abstract questions

**Concept**: Build a graph connecting related concepts

```
Market Resolution → connects to → UMA Oracle
Market Resolution → connects to → Settlement
Position → connects to → Market Resolution
Order Types → connects to → Position
```

**Benefit**: When user asks about "market resolution", also retrieve "settlement" and "UMA oracle" docs automatically.

### Priority 4: Create Evaluation Framework

#### 4.1 Build Abstract Question Test Suite

Create test cases specifically for conceptual questions:

```typescript
const abstractQuestionTests = [
  {
    query: "How does Polymarket determine market outcomes?",
    expectedConcepts: ["resolution", "oracle", "UMA"],
    expectedSourceTypes: ["prose"],
    minimumChunks: 3,
  },
  {
    query: "What's the difference between limit and market orders?",
    expectedConcepts: ["limit order", "market order", "execution"],
    expectedSourceTypes: ["prose", "api-reference"],
    minimumChunks: 2,
  },
  {
    query: "How do fees work on Polymarket?",
    expectedConcepts: ["maker", "taker", "fee structure"],
    expectedSourceTypes: ["prose"],
    minimumChunks: 2,
  }
];
```

#### 4.2 Implement RAGAS Metrics

Track retrieval quality with standard metrics:
- **Context Precision**: Are retrieved chunks relevant to the query?
- **Context Recall**: Are all necessary concepts covered?
- **Faithfulness**: Is the answer grounded in retrieved docs?
- **Answer Relevancy**: Does the answer address the question?

---

## Implementation Roadmap

### Phase 1: Expand Documentation (1-2 days)
- [ ] Add Polymarket docs site to project config
- [ ] Run `collect-sources` for community examples
- [ ] Create 3-5 manual conceptual documents for missing topics
- [ ] Re-run scraper: `npm run scraper -- --project polymarket --reindex`

### Phase 2: Improve Retrieval (2-3 days)
- [ ] Implement query-type-aware search options
- [ ] Increase reranker context window to 2000+ chars
- [ ] Add adjacent chunk expansion with larger window for concepts
- [ ] Test with abstract question suite

### Phase 3: Enhance Synthesis (2-3 days)
- [ ] Add concept-specific prompt templates
- [ ] Implement query decomposition for complex questions
- [ ] Add multi-hop retrieval pipeline
- [ ] Test end-to-end with abstract questions

### Phase 4: Evaluate & Iterate (ongoing)
- [ ] Build abstract question test suite
- [ ] Implement RAGAS metrics
- [ ] Measure before/after quality
- [ ] Iterate based on failures

---

## Code References

### Key Files to Modify

| File | Purpose | Changes |
|------|---------|---------|
| `config/projects/polymarket.json` | Project config | Add doc site URL |
| `config/sources/project-sources.json:53-57` | Source registry | Add new sources |
| `packages/shared/src/query-analyzer.ts` | Query classification | Add concept-aware options |
| `packages/shared/src/search.ts:30-78` | Hybrid search | Query-type-aware params |
| `packages/shared/src/reranker.ts:32-174` | LLM reranking | Longer context, concept scoring |
| `packages/server/src/prompts/index.ts:1-243` | LLM prompts | Add concept explanation template |
| `packages/scraper/src/chunker.ts:115-182` | Prose chunking | Semantic chunking |

### Existing Infrastructure to Leverage

- **Adjacent chunk retrieval**: Already implemented at `packages/shared/src/adjacent-chunks.ts`
- **Query variations**: Already in `packages/shared/src/query-variations.ts`
- **Corrective RAG**: Already in `packages/shared/src/corrective-rag.ts`
- **Agentic evaluation**: Already in `packages/shared/src/evaluation-orchestrator.ts`
- **Source collector**: Plan exists at `thoughts/shared/plans/2026-01-13-collect-sources-for-project.md`

---

## Expected Impact

### Quantitative Improvements
- **Source coverage**: 2 → 15+ Polymarket sources
- **Conceptual docs**: 0 → 50+ prose documentation pages
- **Retrieval precision for concepts**: +30-50% with query-aware retrieval
- **Answer completeness**: +40-60% with multi-hop retrieval

### Qualitative Improvements
- Users can ask "Why does X happen?" not just "How do I code X?"
- Answers include context and related concepts
- Better handling of ambiguous or high-level questions
- Reduced "no documentation found" failures

---

## Open Questions

1. **Polymarket API docs access**: Is there an official API documentation site?
2. **Rate limits**: What are Polymarket doc site crawl limits?
3. **Community content licensing**: Can we index community bot repositories?
4. **Curation effort**: Who will create/maintain manual conceptual docs?

---

## Related Research

- `thoughts/shared/research/2026-01-08-coding-agent-optimization.md` - Original RAG improvement recommendations
- `thoughts/shared/plans/2026-01-13-collect-sources-for-project.md` - Source collector implementation
- `thoughts/shared/plans/2026-01-13-ENG-0001-adjacent-chunk-retrieval.md` - Adjacent chunk expansion
- `thoughts/shared/plans/2026-01-13-ENG-0002-agentic-evaluation-loop.md` - Agentic answer refinement
- `thoughts/shared/research/2026-01-11-polymarket-onboarding-compatibility.md` - Initial Polymarket research
