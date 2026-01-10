import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import { formatSearchResultsAsContext, formatSourceUrls, getProjectContext } from './context-formatter.js';

export const ExplainErrorSchema = z.object({
  error: z.string().describe('The error message or description'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  context: z.string().optional().describe('What you were trying to do when the error occurred'),
  codeSnippet: z.string().optional().describe('The code that caused the error'),
  maxTokens: z.number().optional().default(4000).describe('Maximum response length (default: 4000)')
});

type ExplainErrorArgs = z.infer<typeof ExplainErrorSchema>;

export async function explainError(
  args: ExplainErrorArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. Build comprehensive search query
  const queryParts = [args.error];
  if (args.context) queryParts.push(args.context);
  queryParts.push('error fix troubleshoot solution');

  // Extract potential identifiers from error message
  const identifiers = args.error.match(/`[^`]+`|'[^']+'|"[^"]+"/g);
  if (identifiers) {
    queryParts.push(...identifiers.map(s => s.replace(/[`'"]/g, '')));
  }

  const searchQuery = queryParts.join(' ');

  const results = await context.search.search(searchQuery, {
    limit: 15,
    project: args.project,
    rerank: true,
    rerankTopK: 10
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

  // 2. Format context with metadata
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  // 3. Build enhanced error context
  let errorContext = args.context || 'Not provided';
  if (args.codeSnippet) {
    errorContext += `\n\nCode that caused the error:\n\`\`\`\n${args.codeSnippet}\n\`\`\``;
  }

  // 4. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 5. Synthesize error explanation
  const explanation = await context.llmClient.synthesize(
    PROMPTS.explainError.system + projectContext,
    PROMPTS.explainError.user(args.error, errorContext, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 6. Append sources
  const sources = formatSourceUrls(results);

  return {
    content: [{
      type: 'text',
      text: `${explanation}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
