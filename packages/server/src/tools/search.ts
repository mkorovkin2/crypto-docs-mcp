import { z } from 'zod';
import type { ToolContext } from './index.js';

export const SearchDocumentationSchema = z.object({
  query: z.string(),
  project: z.string(),
  contentType: z.enum(['prose', 'code', 'api-reference']).optional(),
  limit: z.number().optional().default(5)
});

type SearchDocumentationArgs = z.infer<typeof SearchDocumentationSchema>;

export async function searchDocumentation(
  args: SearchDocumentationArgs,
  context: ToolContext
) {
  const results = await context.search.search(args.query, {
    limit: args.limit,
    contentType: args.contentType,
    project: args.project
  });

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `No documentation found for "${args.query}" in ${args.project} docs. Try rephrasing your query or using different keywords.`
      }]
    };
  }

  const formattedResults = results.map((result, index) => {
    const { chunk } = result;
    return [
      `## Result ${index + 1}: ${chunk.title}`,
      `**Section:** ${chunk.section}`,
      `**URL:** ${chunk.url}`,
      `**Type:** ${chunk.contentType}`,
      '',
      chunk.contentType === 'code'
        ? '```' + (chunk.metadata.codeLanguage || 'typescript') + '\n' + chunk.content + '\n```'
        : chunk.content,
      '',
      '---'
    ].join('\n');
  });

  return {
    content: [{
      type: 'text' as const,
      text: [
        `# Search Results for "${args.query}" (${args.project})`,
        `Found ${results.length} relevant sections:`,
        '',
        ...formattedResults
      ].join('\n')
    }]
  };
}
