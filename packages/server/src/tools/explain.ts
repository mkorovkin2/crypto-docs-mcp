import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ExplainConceptSchema = z.object({
  concept: z.string(),
  project: z.string(),
  depth: z.enum(['brief', 'detailed']).optional().default('brief')
});

type ExplainConceptArgs = z.infer<typeof ExplainConceptSchema>;

export async function explainConcept(
  args: ExplainConceptArgs,
  context: ToolContext
) {
  // Search documentation for the concept
  const results = await context.search.search(
    `what is ${args.concept} definition explanation`,
    {
      limit: args.depth === 'detailed' ? 5 : 3,
      project: args.project
    }
  );

  if (results.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: `No explanation found for "${args.concept}" in ${args.project} docs. Try different keywords or use \`search_documentation\` for broader results.`
      }]
    };
  }

  const sections = results.map(r => {
    if (r.chunk.contentType === 'code') {
      return '```' + (r.chunk.metadata.codeLanguage || 'typescript') + '\n' + r.chunk.content + '\n```';
    }
    return r.chunk.content;
  }).join('\n\n---\n\n');

  const sources = results.map(r => `- [${r.chunk.title} - ${r.chunk.section}](${r.chunk.url})`);

  return {
    content: [{
      type: 'text' as const,
      text: [
        `# ${args.concept} (${args.project})`,
        '',
        sections,
        '',
        '## Sources',
        ...sources
      ].join('\n')
    }]
  };
}
