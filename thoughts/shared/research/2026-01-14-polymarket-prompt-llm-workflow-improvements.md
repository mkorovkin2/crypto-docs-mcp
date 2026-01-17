---
date: 2026-01-14T14:00:00-08:00
topic: "Improving Polymarket RAG: Prompt Quality and LLM Workflow for Abstract Questions"
tags: [research, polymarket, rag, prompts, llm-workflow, abstract-questions, optimization]
status: complete
last_updated: 2026-01-14
---

# Research: Improving Polymarket RAG Prompt Quality and LLM Workflow

**Date**: 2026-01-14

## Research Question
How can we improve the system to get a lot of Polymarket docs and make the RAG really effective for abstract questions, with focus on improving prompt quality and LLM workflow?

## Summary

The current system has solid infrastructure but needs targeted improvements in **4 key areas** for high-quality abstract question handling:

1. **Prompt Engineering** - Add concept-specific prompts with structured explanation formats
2. **LLM Workflow** - Implement multi-hop retrieval, query decomposition, and chain-of-thought synthesis
3. **Context Assembly** - Improve how retrieved chunks are formatted for conceptual understanding
4. **Documentation Coverage** - Expand from 2 SDK sources to 15+ including official docs and tutorials

**Key Insight**: The system already has query-type-aware reranking and adjacent chunk expansion. The gap is in **prompt templates** that don't leverage query type for synthesis, and **lack of conceptual documentation** to retrieve.

---

## Detailed Findings

### Current System Strengths

The codebase already implements:

1. **Query Classification** (`query-analyzer.ts:133-158`)
   - 6 query types: `error`, `howto`, `concept`, `code_lookup`, `api_reference`, `general`
   - Pattern-based detection with regex matching

2. **Query-Type-Aware Reranking** (`reranker.ts:82-138`)
   - Concept queries get 3000 char preview (vs 2000 standard)
   - Type-specific scoring guidelines for each query type
   - Deprioritizes API-only docs for conceptual queries

3. **Adjacent Chunk Expansion** (`adjacent-chunks.ts:50-186`)
   - Fetches surrounding context automatically
   - Concept queries get larger windows (prose: 3, code: 2)

4. **Agentic Evaluation Loop** (`evaluation-orchestrator.ts:86-574`)
   - Iterative refinement when confidence is low
   - Can query more docs or refine answers

### Current System Weaknesses

**1. Prompt Templates Ignore Query Type for Synthesis**

`prompts/index.ts` has only ONE synthesis prompt (`askDocs.system`) used for ALL query types:

```typescript
// Current: Same prompt for "What is market resolution?" and "Show me createOrder code"
const initialAnswer = await context.llmClient.synthesize(
  PROMPTS.askDocs.system + projectContext,
  PROMPTS.askDocs.user(args.question, contextChunks, args.project),
  { maxTokens: args.maxTokens }
);
```

**Problem**: A concept query needs explanation structure (What/How/Why/Example), but the prompt just says "provide a complete, actionable answer."

**2. `getQueryTypePromptSuffix()` Exists But Is Never Called**

At `prompts/index.ts:203-243`, there's a function that adds query-type-specific focus instructions:

```typescript
export function getQueryTypePromptSuffix(queryType: string): string {
  switch (queryType) {
    case 'concept':
      return `FOCUS: This appears to be a conceptual query. Prioritize:
- Clear explanations
- How components relate to each other
- When and why to use specific features`;
    // ...
  }
}
```

But **this is never used** in `ask-docs.ts` or any other tool file.

**3. No Concept-Specific Output Format**

Current prompt just says "Start with a direct answer." For abstract questions, this leads to:
- Missing definitions
- Missing "Why does this exist?" context
- No examples section
- No related concepts

**4. Limited Polymarket Documentation**

Only 2 SDK sources indexed (`config/sources/project-sources.json:53-57`):
- `polymarket-py-clob-client` - Python SDK
- `polymarket-clob-client` - TypeScript SDK

Missing:
- docs.polymarket.com (official docs)
- Fee structure documentation
- Market resolution documentation
- Order types and trading mechanics
- Community tutorials and examples

---

## Priority Improvements: Prompt Quality

### 1. Add Concept-Specific Synthesis Prompt

**Create new prompt in `prompts/index.ts`:**

```typescript
askDocsConcept: {
  system: `You are an expert documentation assistant explaining blockchain/trading concepts.

YOUR JOB: Transform documentation chunks into clear, educational explanations that help developers UNDERSTAND concepts, not just use them.

OUTPUT STRUCTURE - You MUST follow this format:

## [Concept Name]

### What Is It?
[One clear sentence definition. No jargon. A junior developer should understand.]

### How Does It Work?
[Mechanical explanation - what happens step by step]
[Use numbered steps if a process]
[Reference the underlying technology/protocol]

### Why Does It Exist?
[The problem it solves]
[What would happen without it]
[When you would use it vs alternatives]

### Example
[Concrete scenario with real numbers/values]
[Code snippet if applicable, with comments]

### Important Details
- [Gotcha 1]
- [Gotcha 2]
- [Edge case to know]

### Related Concepts
- [Related concept 1] - [one line on relationship]
- [Related concept 2] - [one line on relationship]

### Sources
[Source N] citations

CRITICAL RULES:
1. EXPLAIN, don't just quote. Synthesize the documentation into understanding.
2. Use analogies when helpful ("Think of it like...")
3. If documentation is incomplete, SAY SO explicitly: "The documentation doesn't explain [X], but based on [Y]..."
4. Include the "why" - developers need context, not just facts
5. BE THOROUGH - include ALL relevant concepts, relationships, and edge cases`,

  user: (query: string, context: string, project: string) => `
PROJECT: ${project}

DOCUMENTATION CHUNKS:
${context}

QUESTION: ${query}

Explain this concept comprehensively. Follow the output structure exactly.`
}
```

### 2. Use Query Type to Select Prompt

**Modify `ask-docs.ts:196-203`:**

```typescript
// Select prompt based on query type
let systemPrompt: string;
let userPrompt: string;

switch (analysis.type) {
  case 'concept':
    systemPrompt = PROMPTS.askDocsConcept.system + projectContext;
    userPrompt = PROMPTS.askDocsConcept.user(args.question, contextChunks, args.project);
    break;
  case 'howto':
    systemPrompt = PROMPTS.askDocsHowTo.system + projectContext;
    userPrompt = PROMPTS.askDocsHowTo.user(args.question, contextChunks, args.project);
    break;
  case 'error':
    systemPrompt = PROMPTS.explainError.system + projectContext;
    userPrompt = PROMPTS.explainError.user(args.question, '', contextChunks, args.project);
    break;
  default:
    // General and code_lookup use standard prompt
    systemPrompt = PROMPTS.askDocs.system + projectContext + getQueryTypePromptSuffix(analysis.type);
    userPrompt = PROMPTS.askDocs.user(args.question, contextChunks, args.project);
}

const initialAnswer = await context.llmClient.synthesize(
  systemPrompt,
  userPrompt,
  { maxTokens: args.maxTokens }
);
```

### 3. Add How-To Specific Prompt

```typescript
askDocsHowTo: {
  system: `You are an expert documentation assistant helping developers accomplish tasks.

OUTPUT STRUCTURE - Follow this format:

## How to [Task]

### Overview
[1-2 sentences on what we're doing and end result]

### Prerequisites
- [ ] [Requirement 1 with version]
- [ ] [Requirement 2]
- [ ] [Any accounts/keys needed]

### Step 1: [Action]
[Explanation]
\`\`\`[language]
// Code with comments
\`\`\`

### Step 2: [Action]
...

### Complete Example
\`\`\`[language]
// Full working code with ALL imports
\`\`\`

### Verify It Works
- Expected output: [what success looks like]
- How to test: [command or check]

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| [Error] | [Why] | [Solution] |

### Sources
[Source N] citations

CRITICAL RULES:
1. Code must be COMPLETE - all imports, all types
2. Explain each step, don't just show code
3. Include error handling in examples
4. Mention versions explicitly`,

  user: (task: string, context: string, project: string) => `
PROJECT: ${project}

DOCUMENTATION CHUNKS:
${context}

TASK: ${task}

Provide step-by-step instructions to accomplish this task.`
}
```

### 4. Enhance Context Formatter for Concepts

**Modify `context-formatter.ts` to add document relationships:**

```typescript
/**
 * Format search results with concept relationships highlighted
 */
export function formatSearchResultsAsContext(
  results: SearchResult[],
  options: FormatOptions = {}
): string {
  const { includeMetadata = true, labelType = true, queryType } = options;

  // For concept queries, group related chunks
  if (queryType === 'concept') {
    return formatConceptualContext(results, options);
  }

  // Standard formatting for other types
  return results
    .map((result, index) => formatChunkWithMetadata(result, index, options))
    .join('\n\n');
}

function formatConceptualContext(results: SearchResult[], options: FormatOptions): string {
  // Group by document to show document structure
  const byDocument = new Map<string, SearchResult[]>();

  for (const result of results) {
    const docId = result.chunk.metadata.documentId || result.chunk.url;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId)!.push(result);
  }

  // Format with document grouping and section relationships
  let output = '';
  let globalIndex = 0;

  for (const [docId, chunks] of byDocument) {
    // Sort chunks by their position in document
    chunks.sort((a, b) =>
      (a.chunk.metadata.chunkIndex || 0) - (b.chunk.metadata.chunkIndex || 0)
    );

    output += `=== Document: ${chunks[0].chunk.title} ===\n`;
    output += `Sections covered: ${[...new Set(chunks.map(c => c.chunk.section))].join(' → ')}\n\n`;

    for (const chunk of chunks) {
      output += formatChunkWithMetadata(chunk, globalIndex++, options);
      output += '\n\n';
    }
  }

  return output;
}
```

---

## Priority Improvements: LLM Workflow

### 1. Implement Query Decomposition for Complex Questions

**Create `packages/shared/src/query-decomposer.ts`:**

```typescript
/**
 * Decompose complex abstract queries into sub-questions
 *
 * "How does Polymarket handle market resolution?" becomes:
 * 1. "What is market resolution on Polymarket?"
 * 2. "How are Polymarket market outcomes determined?"
 * 3. "What is the UMA oracle in Polymarket?"
 * 4. "How does Polymarket settlement work?"
 */

const DECOMPOSITION_PROMPT = `You are a question decomposer for documentation search.

Given a complex question, break it into 2-4 simpler sub-questions that, when answered together, fully address the original.

RULES:
1. Each sub-question should be answerable independently
2. Include "what is" questions for key concepts mentioned
3. Include "how does" questions for processes mentioned
4. Include prerequisite concepts the user may not know
5. Don't create redundant questions
6. Order from foundational to advanced

OUTPUT: JSON array of strings
["sub-question 1", "sub-question 2", ...]

EXAMPLES:

Q: "How does Polymarket handle market resolution?"
["What is market resolution on Polymarket?", "Who determines the outcome of Polymarket markets?", "What is the UMA oracle and how does it work?", "How does settlement happen after resolution?"]

Q: "What's the difference between maker and taker fees?"
["What are maker fees on Polymarket?", "What are taker fees on Polymarket?", "When do you pay maker vs taker fees?"]

Q: "How do I deploy a zkApp on Mina?"
["What is a zkApp?", "What are the prerequisites for deploying a zkApp?", "How do I compile a zkApp?", "How do I deploy to Mina testnet?"]`;

export async function decomposeQuery(
  query: string,
  queryType: QueryType,
  llmClient: LLMClient
): Promise<string[]> {
  // Only decompose concept and howto queries
  if (!['concept', 'howto', 'general'].includes(queryType)) {
    return [query];
  }

  // Simple queries don't need decomposition
  const wordCount = query.split(/\s+/).length;
  if (wordCount < 6) {
    return [query];
  }

  const response = await llmClient.synthesize(
    DECOMPOSITION_PROMPT,
    `Q: "${query}"`,
    { maxTokens: 500, temperature: 0.3 }
  );

  try {
    const subQueries = JSON.parse(response);
    // Always include original query first
    return [query, ...subQueries.filter((q: string) => q !== query)];
  } catch {
    return [query];
  }
}
```

### 2. Implement Multi-Hop Retrieval

**Modify `ask-docs.ts` to use query decomposition:**

```typescript
// After query analysis, check if we need decomposition
let searchQueries: string[];

if (['concept', 'howto'].includes(analysis.type)) {
  // Decompose complex questions
  const decomposed = await decomposeQuery(
    args.question,
    analysis.type,
    context.llmEvaluator || context.llmClient
  );
  logger.debug(`Decomposed into ${decomposed.length} sub-queries: ${JSON.stringify(decomposed)}`);

  // Combine with variations
  searchQueries = [
    ...decomposed,
    ...queryVariations.variations.filter((v: string) => !decomposed.includes(v))
  ].slice(0, 6); // Max 6 queries
} else {
  searchQueries = queryVariations.variations;
}

// Search with all queries in parallel
const searchPromises = searchQueries.map((query: string) =>
  context.search.search(query, { /* options */ })
);
```

### 3. Add Chain-of-Thought for Concept Synthesis

**Create synthesis wrapper that uses CoT:**

```typescript
/**
 * Synthesize conceptual answer with chain-of-thought
 */
async function synthesizeConceptAnswer(
  question: string,
  context: string,
  project: string,
  llmClient: LLMClient
): Promise<string> {
  const cotPrompt = `Before writing the final answer, think through these steps:

<thinking>
1. CORE CONCEPT: What is the main concept being asked about?
2. DOCUMENTATION COVERAGE: What do the sources actually explain?
3. GAPS: What aspects are NOT covered in the documentation?
4. RELATED CONCEPTS: What prerequisites or related concepts should I mention?
5. USER LEVEL: What does the user likely already know vs need explained?
</thinking>

Now write the explanation following the concept format.`;

  const response = await llmClient.synthesize(
    PROMPTS.askDocsConcept.system,
    `${cotPrompt}\n\n${PROMPTS.askDocsConcept.user(question, context, project)}`,
    { maxTokens: 4000 }
  );

  // Strip thinking block if visible (some models may include it)
  return response.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}
```

### 4. Add Answer Completeness Verification

**Create verification step before returning:**

```typescript
/**
 * Verify answer addresses all parts of the question
 */
async function verifyAnswerCompleteness(
  question: string,
  answer: string,
  queryType: QueryType,
  llmClient: LLMClient
): Promise<{ isComplete: boolean; missingAspects: string[] }> {
  const verificationPrompt = `You are verifying if an answer is complete.

QUESTION: ${question}
ANSWER: ${answer}

For a ${queryType} query, check if the answer:
${queryType === 'concept' ? `
- Defines the concept clearly
- Explains how it works
- Explains why it exists
- Provides an example
- Mentions related concepts` : ''}
${queryType === 'howto' ? `
- Lists prerequisites
- Has step-by-step instructions
- Includes complete code
- Shows how to verify success` : ''}

OUTPUT JSON:
{
  "isComplete": boolean,
  "missingAspects": ["aspect 1", "aspect 2"]
}`;

  const response = await llmClient.synthesize(
    'You are a documentation quality checker.',
    verificationPrompt,
    { maxTokens: 300, temperature: 0 }
  );

  try {
    return JSON.parse(response);
  } catch {
    return { isComplete: true, missingAspects: [] };
  }
}
```

---

## Priority Improvements: Documentation Coverage

### 1. Add Polymarket Official Docs

**Update `config/projects/polymarket.json`:**

```json
{
  "id": "polymarket",
  "name": "Polymarket",
  "baseUrl": "https://docs.polymarket.com",
  "includePatterns": ["/docs/**", "/guides/**", "/api/**"],
  "excludePatterns": ["/changelog/", "/blog/"],
  "maxPages": 500,
  "concurrency": 3,
  "delay": 1000,
  "useBrowser": false
}
```

### 2. Create Conceptual Documentation

For topics missing from official docs, create curated markdown in `docs/polymarket/concepts/`:

**`market-resolution.md`:**
```markdown
# Market Resolution on Polymarket

## What Is It?
Market resolution is the process of determining the final outcome of a prediction market and settling all positions.

## How Does It Work?
1. Event occurs in real world
2. UMA oracle receives outcome data
3. Outcome is proposed and verified
4. Market resolves to YES (1.0) or NO (0.0)
5. Positions are settled automatically

## Resolution Sources
- Primary: UMA optimistic oracle
- Backup: Emergency admin resolution
- Data sources: Official news, government data

## Edge Cases
- Ambiguous outcomes → Extended dispute period
- Market invalidation → All positions refunded at entry price
- Tie outcomes (rare) → Split resolution

## Related Concepts
- UMA Oracle - Decentralized truth mechanism
- Settlement - Token distribution after resolution
- Conditional tokens - The tokens representing positions
```

### 3. Index Community Sources

**Run source collector:**
```bash
npm run collect-sources -- \
  --prompt "Polymarket trading bot Python examples" \
  --count 20

npm run collect-sources -- \
  --prompt "Polymarket CLOB API tutorial" \
  --count 15
```

---

## Implementation Roadmap

### Phase 1: Prompt Engineering (Quick Wins)

| File | Change | Impact |
|------|--------|--------|
| `prompts/index.ts` | Add `askDocsConcept` prompt | Direct quality improvement for concept queries |
| `prompts/index.ts` | Add `askDocsHowTo` prompt | Direct quality improvement for how-to queries |
| `ask-docs.ts:196` | Select prompt by query type | Leverage existing query classification |
| `ask-docs.ts:200` | Call `getQueryTypePromptSuffix()` | Use existing but unused function |

### Phase 2: LLM Workflow Improvements

| File | Change | Impact |
|------|--------|--------|
| New: `query-decomposer.ts` | Query decomposition for complex questions | +30-50% completeness |
| `ask-docs.ts` | Multi-hop retrieval integration | Better coverage for abstract questions |
| New: `answer-verifier.ts` | Completeness verification | Catch incomplete answers |
| `context-formatter.ts` | Document grouping for concepts | Better context for synthesis |

### Phase 3: Documentation Expansion

| Task | Source | Expected Docs |
|------|--------|---------------|
| Index docs.polymarket.com | Official | 100+ pages |
| Create concept docs | Manual | 10-15 core concepts |
| Index community repos | GitHub | 30+ code examples |
| Index tutorials | YouTube/blogs | 10-20 guides |

---

## Code References

### Files to Modify
- `packages/server/src/prompts/index.ts:1-243` - Add concept/howto prompts
- `packages/server/src/tools/ask-docs.ts:196-203` - Select prompt by query type
- `packages/server/src/tools/context-formatter.ts:21-83` - Add concept grouping
- `config/projects/polymarket.json` - Add official docs

### Files to Create
- `packages/shared/src/query-decomposer.ts` - Query decomposition
- `packages/shared/src/answer-verifier.ts` - Completeness verification
- `docs/polymarket/concepts/*.md` - Manual concept docs

### Existing Infrastructure to Leverage
- Query type classification: `query-analyzer.ts:133-158`
- Query type prompt suffix: `prompts/index.ts:203-243` (unused!)
- Agentic evaluation: `evaluation-orchestrator.ts:86-574`
- Adjacent expansion: `adjacent-chunks.ts:50-186`
- Query variations: `query-variations.ts:52-86`

---

## Expected Impact

### Quantitative
| Metric | Before | After |
|--------|--------|-------|
| Concept query completeness | ~40% | ~80% |
| How-to query completeness | ~60% | ~90% |
| Polymarket doc coverage | 2 SDK sources | 15+ sources |
| Answer structure consistency | Low | High |

### Qualitative
- Users get "What/How/Why/Example" for every concept question
- How-to answers always include prerequisites and verification
- Abstract questions retrieve related concepts automatically
- Incomplete answers are flagged and supplemented

---

## Open Questions

1. **Should query decomposition be opt-in?** Could add latency for simple queries
2. **How to handle conflicting information?** When multiple docs disagree
3. **Community doc licensing?** Can we index GitHub repos with various licenses?
4. **Manual doc maintenance?** Who updates curated concept docs?

---

## Related Research

- `thoughts/shared/research/2026-01-14-polymarket-rag-optimization.md` - Broader RAG optimization
- `thoughts/shared/plans/2026-01-14-query-type-aware-retrieval.md` - Query-aware retrieval (implemented)
- `thoughts/shared/plans/2026-01-13-ENG-0002-agentic-evaluation-loop.md` - Agentic evaluation
