import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

export const ExplainErrorSchema = z.object({
  error: z.string().describe('The error message or description'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  context: z.string().optional().describe('What you were trying to do when the error occurred'),
  maxTokens: z.number().optional().default(2000).describe('Maximum response length (default: 2000)')
});

type ExplainErrorArgs = z.infer<typeof ExplainErrorSchema>;

export async function explainError(
  args: ExplainErrorArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Search for error-related content
  const searchQuery = args.context
    ? `${args.error} ${args.context} error fix troubleshoot`
    : `${args.error} error fix troubleshoot`;

  const results = await context.search.search(searchQuery, {
    limit: 15,
    project: args.project,
    rerank: true,
    rerankTopK: 8
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for this error in ${args.project}. The error might be:
1. A runtime environment issue (check your setup)
2. A version mismatch (check package versions)
3. Not documented yet

Try searching the project's GitHub issues or community forums.`
      }]
    };
  }

  // 2. Format context
  const contextChunks = results.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    return `${sourceLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize error explanation
  const explanation = await context.llmClient.synthesize(
    PROMPTS.explainError.system,
    PROMPTS.explainError.user(args.error, args.context || '', contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append sources
  const sources = results.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${explanation}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
