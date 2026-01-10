import { z } from 'zod';
import type { ToolContext } from './index.js';
import { PROMPTS } from '../prompts/index.js';
import { analyzeQuery } from '@mina-docs/shared';
import { formatSearchResultsAsContext, formatSourceUrls, getProjectContext } from './context-formatter.js';

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
  // 1. Analyze query to optimize search
  const analysis = analyzeQuery(args.question);

  // 2. Retrieve with optimized parameters based on query type
  const results = await context.search.search(analysis.expandedQuery, {
    limit: analysis.suggestedLimit,
    project: args.project,
    contentType: analysis.suggestedContentType,
    rerank: true,
    rerankTopK: Math.min(analysis.suggestedLimit, 10)
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No documentation found for your question in ${args.project}. Try rephrasing or check if the project name is correct.`
      }]
    };
  }

  // 3. Format chunks with rich metadata for better code generation
  const contextChunks = formatSearchResultsAsContext(results, {
    includeMetadata: true,
    labelType: true
  });

  // 4. Get project-specific context
  const projectContext = getProjectContext(args.project);

  // 5. Synthesize answer with project context
  const answer = await context.llmClient.synthesize(
    PROMPTS.askDocs.system + projectContext,
    PROMPTS.askDocs.user(args.question, contextChunks, args.project),
    { maxTokens: args.maxTokens }
  );

  // 6. Append source URLs at the end for reference
  const sources = formatSourceUrls(results);

  return {
    content: [{
      type: 'text',
      text: `${answer}\n\n---\n### Source URLs\n${sources}`
    }]
  };
}
