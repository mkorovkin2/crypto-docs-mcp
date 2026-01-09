import { z } from 'zod';
import type { ToolContext } from './index.js';

export const SearchDocsSchema = z.object({
  query: z.string().describe('Search query'),
  project: z.string().describe('Project to search (e.g., "mina", "solana", "cosmos")'),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional().describe('Filter by content type'),
  limit: z.number().optional().default(10).describe('Maximum results (default: 10)')
});

type SearchDocsArgs = z.infer<typeof SearchDocsSchema>;

export async function searchDocs(
  args: SearchDocsArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const results = await context.search.search(args.query, {
    limit: args.limit,
    project: args.project,
    contentType: args.contentType,
    rerank: true,
    rerankTopK: args.limit
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No results found for "${args.query}" in ${args.project}.`
      }]
    };
  }

  const formatted = results.map((r, i) => {
    const content = r.chunk.contentType === 'code'
      ? '```' + (r.chunk.metadata.codeLanguage || '') + '\n' + r.chunk.content + '\n```'
      : r.chunk.content;

    return `## ${i + 1}. ${r.chunk.title} - ${r.chunk.section}
**Type:** ${r.chunk.contentType} | **URL:** ${r.chunk.url}

${content}`;
  }).join('\n\n---\n\n');

  return {
    content: [{
      type: 'text',
      text: `# Search Results: "${args.query}" (${args.project})\n\n${formatted}`
    }]
  };
}
