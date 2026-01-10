---
date: 2026-01-08T12:00:00-08:00
topic: "Optimizing Crypto Docs MCP for Coding Agent Use"
tags: [research, codebase, mcp, rag, coding-agents, optimization]
status: complete
last_updated: 2026-01-08
---

# Research: Optimizing Crypto Docs MCP for Coding Agent Use

**Date**: 2026-01-08

## Research Question
Understand how this MCP server works and figure out how to improve it such that a coding agent can use it in a more helpful fashion, optimizing for quality and comprehensiveness of answers.

## Summary

This is a **Crypto Documentation MCP Server** - an LLM-powered documentation retrieval and question-answering system for blockchain developers. It uses hybrid search (Qdrant vector DB + SQLite FTS5), gpt-4o-mini reranking, and GPT-4o synthesis to provide comprehensive answers with source citations. The system covers **Mina Protocol**, **Solana**, and **Cosmos SDK** documentation.

**Key Strengths**:
- Sophisticated RAG pipeline with hybrid retrieval and RRF fusion
- LLM-powered answer synthesis with source attribution
- Dual search strategy (code + prose) for working examples
- Strong grounding constraints to prevent hallucination

**Critical Improvement Areas**:
1. **Unused Metadata**: Rich code metadata (className, methodName, filePath) is collected but never used in search or prompts
2. **Basic Chunking**: Token-based chunking breaks code semantics; AST-based chunking would be more effective
3. **No Query Understanding**: All queries treated identically regardless of type (error, how-to, concept, code lookup)
4. **Missing Context**: Prompts don't include version info, hierarchy, or blockchain-specific guidance
5. **Incomplete Code Output**: No test cases, dependency trees, or verification instructions

## Detailed Findings

### Architecture Overview

```
crypto-docs-mcp/
├── config/projects/          # Project configs (mina.json, solana.json, cosmos.json)
├── packages/
│   ├── shared/               # Core: search, embeddings, LLM client, DB interfaces
│   ├── scraper/              # Crawls docs, parses HTML, chunks, generates embeddings
│   └── server/               # MCP HTTP server with 5 tools
└── data/                     # SQLite databases
```

#### Data Flow
1. **Ingestion**: Crawl docs → Parse HTML → Chunk content → Generate embeddings → Store in Qdrant + SQLite
2. **Query**: Tool call → Hybrid search (vector + FTS) → RRF fusion → Rerank with gpt-4o-mini → Synthesize with GPT-4o → Return with sources

### MCP Tools Exposed

| Tool | Purpose | Search Strategy |
|------|---------|-----------------|
| `ask_docs` | General Q&A | 10 chunks, reranked |
| `get_working_example` | Runnable code | 15 code + 10 prose, parallel search |
| `explain_error` | Debug assistance | Query + "error fix troubleshoot" keywords |
| `search_docs` | Raw chunk search | Configurable limit |
| `list_projects` | Available projects | No search |

### Current Limitations

#### 1. Chunking (`packages/scraper/src/chunker.ts`)
- **Token-based**: 1500 max tokens, 150 overlap (lines 4-6)
- **Problem**: Breaks mid-function, loses semantic boundaries
- **Missing**: AST-aware chunking for code integrity

#### 2. Search (`packages/shared/src/search.ts`)
- **RRF k=60**: Static constant, not tuned per query type (line 111)
- **No query classification**: All queries handled identically
- **Unused filters**: Can filter by contentType/project but not by code metadata

#### 3. Metadata (`packages/shared/src/types.ts`)
Available but **not used** in search or prompts:
- `metadata.headings[]` - Document structure
- `metadata.className` - Class context for methods
- `metadata.methodName` / `functionName` - Specific code targets
- `metadata.filePath` - Source location
- `metadata.lastScraped` - Version/date context

#### 4. Prompts (`packages/server/src/prompts/index.ts`)
**Strengths**:
- Strong grounding ("ONLY use provided documentation")
- Source citation requirements
- Structured output formats

**Weaknesses**:
- No blockchain-specific guidance (costs, testnet vs mainnet)
- No test case generation
- No dependency resolution section
- No verification instructions
- No difficulty assessment

#### 5. Reranker (`packages/shared/src/reranker.ts`)
- **Limited context**: Only first 500 chars used (line 40)
- **No code awareness**: Same approach for prose and code queries

---

## Recommendations

### Priority 1: Critical Improvements (High Impact, Moderate Effort)

#### 1.1 Implement AST-Based Chunking for Code

Replace token-based chunking with tree-sitter AST parsing.

**Location**: `packages/scraper/src/chunker.ts`

**Benefits** (from cAST research):
- +4.3 points RepoEval Recall
- +2.67 points SWE-Bench Pass@1
- Maintains syntactic integrity (complete functions, classes)

**Implementation**:
```typescript
// New file: packages/scraper/src/ast-chunker.ts
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

export function chunkWithAST(code: string, language: string): Chunk[] {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  const tree = parser.parse(code);
  // Split on function/class boundaries
  // Target ~4000 non-whitespace characters
}
```

**Reference**: [cAST Implementation](https://github.com/yilinjz/astchunk)

#### 1.2 Include Code Metadata in Prompts

Add class/method context to chunk formatting for better code generation.

**Location**: `packages/server/src/tools/working-example.ts:47-56`

**Current format**:
```
[Source N] [CODE] ${title} - ${section}
URL: ${url}
```

**Improved format**:
```
[Source N] [CODE] ${title} - ${section}
Class: ${metadata.className || 'N/A'}
Method: ${metadata.methodName || metadata.functionName || 'N/A'}
File: ${metadata.filePath || 'N/A'}
Language: ${metadata.codeLanguage}
URL: ${url}
```

#### 1.3 Add Query Type Detection

Route queries to specialized handling based on intent.

**Location**: New file `packages/shared/src/query-analyzer.ts`

**Query Types**:
- **Error**: Contains stack traces, "error", "failed", exception names → boost error-related docs
- **How-to**: Starts with "how", "create", "deploy" → prioritize tutorials
- **Concept**: "what is", "explain", "difference" → prioritize prose
- **Code lookup**: Contains backticks, function signatures → filter to code chunks

**Implementation**:
```typescript
export type QueryType = 'error' | 'howto' | 'concept' | 'code_lookup' | 'general';

export function classifyQuery(query: string): QueryType {
  if (query.includes('error') || query.includes('failed') || /\bat line \d+\b/.test(query)) {
    return 'error';
  }
  if (/^(how|create|deploy|setup|build|implement)/i.test(query)) {
    return 'howto';
  }
  if (/^(what is|explain|difference|why)/i.test(query)) {
    return 'concept';
  }
  if (/`[^`]+`/.test(query) || /\w+\(.*\)/.test(query)) {
    return 'code_lookup';
  }
  return 'general';
}
```

#### 1.4 Enhance Prompts with Completeness Checklist

Add explicit checklist for code completeness.

**Location**: `packages/server/src/prompts/index.ts` (workingExample prompt)

**Add after line 42**:
```typescript
COMPLETENESS CHECKLIST:
□ All imports with exact package paths
□ All type definitions used in the code
□ Error handling (try/catch where needed)
□ Input validation at boundaries
□ Comments for complex logic
□ Environment variables or config needed
□ Installation commands with versions
□ Test example to verify it works

VERIFICATION SECTION (required):
### How to Verify
- Expected console output
- Test command to run
- What success looks like
```

---

### Priority 2: Medium Impact Improvements

#### 2.1 Apply Contextual Retrieval (Anthropic's Technique)

Prepend chunk-specific context before embedding.

**Location**: `packages/scraper/src/index.ts` (before embedding generation)

**Implementation**:
```typescript
async function addChunkContext(chunk: DocumentChunk): Promise<string> {
  const contextPrefix = await llm.synthesize({
    system: "Generate a 50-100 word context prefix for this documentation chunk. Include: what section it's from, what concepts it relates to, and key identifiers.",
    user: `Project: ${chunk.project}\nTitle: ${chunk.title}\nSection: ${chunk.section}\nContent: ${chunk.content.slice(0, 1000)}`
  });
  return `${contextPrefix}\n\n${chunk.content}`;
}
```

**Expected impact**: 35-67% reduction in retrieval failures (per Anthropic research)

**Cost**: ~$1/million tokens with prompt caching

#### 2.2 Increase Reranker Context Window

Currently only uses first 500 chars, losing critical code context.

**Location**: `packages/shared/src/reranker.ts:40`

**Change**:
```typescript
// From:
preview: r.chunk.content.slice(0, 500)
// To:
preview: r.chunk.content.slice(0, 2000) // For code chunks
// Or use full content for top 10 candidates
```

#### 2.3 Add Blockchain-Specific Prompt Sections

**Location**: `packages/server/src/prompts/index.ts`

**Add to all prompts**:
```typescript
BLOCKCHAIN-SPECIFIC CONSIDERATIONS:
- Mention transaction costs/gas if applicable
- Specify testnet vs mainnet differences
- Note on-chain vs off-chain execution
- Include environment requirements (Browser vs Node.js)
- Warn about async operations (proof generation time)

For ${project} specifically:
${PROJECT_SPECIFIC_CONTEXT[project]}
```

**Project-specific context** (new config):
```typescript
const PROJECT_SPECIFIC_CONTEXT = {
  mina: 'zkApps require proof generation (~30s). Use MINA testnet faucet for testing.',
  solana: 'Consider compute unit limits. Use devnet for testing.',
  cosmos: 'Use cosmos-sdk module patterns. Configure chain-id for testnets.'
};
```

#### 2.4 Add Test Case Generation

Extend workingExample output format.

**Location**: `packages/server/src/prompts/index.ts:44-62`

**Add after "Common Variations"**:
```
### Test Example
\`\`\`[language]
// Minimal test to verify the code works
[test code]
\`\`\`

### Expected Output
[What successful execution looks like]

### Troubleshooting
- Common error: [error] → Fix: [solution]
```

---

### Priority 3: Advanced Improvements (Higher Effort)

#### 3.1 Implement Corrective RAG (CRAG)

Add retrieval quality evaluation before synthesis.

**Concept**: Score retrieval confidence → If low, augment with broader search.

**Implementation**:
```typescript
// packages/shared/src/corrective-search.ts
async function correctiveSearch(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const confidence = await evaluateRetrieval(query, results);

  if (confidence === 'high') {
    return results; // Use as-is
  } else if (confidence === 'low') {
    // Retry with broader query or web search fallback
    const expanded = await expandQuery(query);
    return search(expanded, { limit: 30 });
  } else {
    // Ambiguous: combine original + expanded
    const additional = await search(query + ' tutorial example', { limit: 15 });
    return mergeResults(results, additional);
  }
}
```

**Expected impact**: +15-35% accuracy on complex queries

#### 3.2 Graph-Based Code RAG

Build knowledge graphs for code relationships.

**Use case**: "Find all functions that modify state and call authentication"

**Reference**: [code-graph-rag](https://github.com/vitali87/code-graph-rag) - MCP server compatible

#### 3.3 Multi-Agent Architecture

Separate concerns into specialized agents.

**Agents**:
1. **Query Understanding Agent**: Classifies and expands queries
2. **Retrieval Agent**: Handles search with adaptive strategies
3. **Synthesis Agent**: Generates comprehensive answers
4. **Validation Agent**: Verifies code completeness

**When needed**: When reasoning over 10K+ documents or multiple codebases

---

## Code References

### Core Files to Modify

| File | Purpose | Priority Changes |
|------|---------|------------------|
| `packages/scraper/src/chunker.ts:4-6` | Chunk sizing | Add AST-based chunking |
| `packages/shared/src/search.ts:26-62` | Main search | Add query classification |
| `packages/shared/src/reranker.ts:40` | Reranker | Increase context window |
| `packages/server/src/prompts/index.ts` | LLM prompts | Add completeness checklist |
| `packages/server/src/tools/working-example.ts:47-56` | Context format | Include metadata |
| `packages/shared/src/types.ts:10-19` | Metadata schema | Already defined, just use it |

### Key Metrics to Track

After implementing changes:
1. **Retrieval Precision**: % of retrieved chunks used in answer
2. **Code Completeness**: % of generated code that runs without modification
3. **Source Attribution**: % of claims with valid source citations
4. **Latency**: Time from query to response
5. **Token Cost**: Total tokens consumed per query

### Evaluation Framework

Implement RAGAS metrics:
- **Faithfulness**: Are claims grounded in retrieved docs?
- **Context Precision**: Are retrieved chunks relevant?
- **Answer Relevancy**: Does answer address the question?

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
- [ ] Include code metadata in prompt context formatting
- [ ] Add completeness checklist to prompts
- [ ] Increase reranker context window to 2000 chars
- [ ] Add blockchain-specific prompt sections

### Phase 2: Core Improvements (3-5 days)
- [ ] Implement query type detection
- [ ] Add AST-based chunking for code files
- [ ] Add test case generation to workingExample
- [ ] Enhance error context structure

### Phase 3: Advanced Features (1-2 weeks)
- [ ] Implement Contextual Retrieval
- [ ] Add Corrective RAG pattern
- [ ] Build evaluation framework with RAGAS
- [ ] Consider multi-agent architecture

---

## Open Questions

1. **Version handling**: How to manage API changes across documentation versions?
2. **Real-time updates**: Strategy for incrementally updating embeddings when docs change?
3. **Cross-project queries**: Should the system support queries spanning multiple projects?
4. **User feedback loop**: How to learn from coding agent success/failure patterns?

---

## Related Research

- [Anthropic Contextual Retrieval (2024)](https://www.anthropic.com/news/contextual-retrieval)
- [cAST: AST-Based Code Chunking (2024-2025)](https://arxiv.org/html/2506.15655v1)
- [CRAG: Corrective RAG (2024)](https://arxiv.org/html/2401.15884v3)
- [code-graph-rag for MCP](https://github.com/vitali87/code-graph-rag)
