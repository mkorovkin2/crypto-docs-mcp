import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

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
  // 1. Retrieve with reranking for quality
  const results = await context.search.search(args.question, {
    limit: 10,
    project: args.project,
    rerank: true,
    rerankTopK: 10
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
      }]
    };
  }

  // 2. Format chunks as context with source numbers
  const contextChunks = results.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    return `${sourceLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize answer
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append source URLs at the end for reference
  const sources = results.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${answer}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
