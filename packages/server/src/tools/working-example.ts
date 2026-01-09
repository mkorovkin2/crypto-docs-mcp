import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';

export const GetWorkingExampleSchema = z.object({
  task: z.string().describe('What you want to accomplish (e.g., "transfer tokens", "deploy smart contract")'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type GetWorkingExampleArgs = z.infer<typeof GetWorkingExampleSchema>;

export async function getWorkingExample(
  args: GetWorkingExampleArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Search for code examples and related prose
  const [codeResults, proseResults] = await Promise.all([
    context.search.search(args.task, {
      limit: 15,
      project: args.project,
      contentType: 'code',
      rerank: true,
      rerankTopK: 8
    }),
    context.search.search(`${args.task} tutorial guide how to`, {
      limit: 10,
      project: args.project,
      contentType: 'prose',
      rerank: true,
      rerankTopK: 5
    })
  ]);

  const allResults = [...codeResults, ...proseResults];

  if (allResults.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No code examples found for "${args.task}" in ${args.project}. Try different keywords or check the project name.`
      }]
    };
  }

  // 2. Format context
  const contextChunks = allResults.map((r, i) => {
    const sourceLabel = `[Source ${i + 1}]`;
    const typeLabel = r.chunk.contentType === 'code' ? '[CODE]' : '[DOCS]';
    return `${sourceLabel} ${typeLabel} ${r.chunk.title} - ${r.chunk.section}
URL: ${r.chunk.url}
${r.chunk.contentType === 'code' ? `Language: ${r.chunk.metadata.codeLanguage || 'unknown'}` : ''}
Content:
${r.chunk.content}
---`;
  }).join('\n\n');

  // 3. Synthesize complete example
  const example = await context.llmClient.synthesize(
    PROMPTS.workingExample.system,
    PROMPTS.workingExample.user(args.task, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 4. Append sources
  const sources = allResults.map((r, i) =>
    `[Source ${i + 1}]: ${r.chunk.url}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text: `${example}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
