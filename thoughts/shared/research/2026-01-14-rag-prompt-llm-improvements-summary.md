---
date: 2026-01-14
topic: "RAG Prompt and LLM Workflow Improvements - Goal Summary"
tags: [summary, rag, prompts, llm-workflow]
status: complete
---

# Goal Summary: RAG Prompt and LLM Workflow Improvements

## Original Request

> "How can I improve this to get a lot of polymarket docs and make the RAG really effective for abstract questions? I want it to be able to answer in a very high quality way. Focus specifically on improving prompt quality and LLM workflow."

## Research Phase

Spawned 6 parallel agents to analyze:
- RAG architecture and retrieval patterns
- Prompt templates and LLM workflows
- Query analysis and reranking logic
- Polymarket-specific code
- Existing research in thoughts/
- MCP server implementations

## Key Findings

1. **Unused Infrastructure**: `getQueryTypePromptSuffix()` existed but was never called
2. **Single Prompt Problem**: All query types used the same generic synthesis prompt
3. **No Query Decomposition**: Complex questions weren't broken into searchable sub-queries

## What Was Implemented

| Change | File |
|--------|------|
| Concept-specific prompt (What/How/Why/Example format) | `prompts/index.ts` |
| How-to specific prompt (step-by-step with verification) | `prompts/index.ts` |
| Query-type-aware prompt selection | `ask-docs.ts` |
| Query decomposition for multi-hop retrieval | `query-decomposer.ts` (new) |
| Document grouping for concept queries | `context-formatter.ts` |
| Comprehensive project contexts (Mina, Solana, Cosmos, Polymarket) | `context-formatter.ts` |
