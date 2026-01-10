import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import { formatSearchResultsAsContext, formatSourceUrls, getProjectContext } from './context-formatter.js';

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
  // 1. Search for code examples and related prose in parallel
  const [codeResults, proseResults, apiResults] = await Promise.all([
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
    }),
    // Also search API reference for complete type info
    context.search.search(`${args.task} interface type`, {
      limit: 5,
      project: args.project,
      contentType: 'api-reference',
      rerank: true,
      rerankTopK: 3
    })
  ]);

  const allResults = [...codeResults, ...proseResults, ...apiResults];

  if (allResults.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No code examples found for "${args.task}" in ${args.project}. Try different keywords or check the project name.`
      }]
    };
  }

  // 2. Format context with rich metadata for better code generation
  const contextChunks = formatSearchResultsAsContext(allResults, {
    includeMetadata: true,
    labelType: true
  });

  // 3. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 4. Synthesize complete example with project context
  const example = await context.llmClient.synthesize(
    PROMPTS.workingExample.system + projectContext,
    PROMPTS.workingExample.user(args.task, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 5. Append sources
  const sources = formatSourceUrls(allResults);

  return {
    content: [{
      type: 'text',
      text: `${example}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
