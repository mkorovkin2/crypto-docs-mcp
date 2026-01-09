import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetCodeExamplesSchema = z.object({
  topic: z.string(),
  project: z.string(),
  limit: z.number().optional().default(3)
});

type GetCodeExamplesArgs = z.infer<typeof GetCodeExamplesSchema>;

export async function getCodeExamples(
  args: GetCodeExamplesArgs,
  context: ToolContext
) {
  // Search specifically for code content
  const codeResults = await context.search.search(args.topic, {
    limit: args.limit * 2,
    contentType: 'code',
    project: args.project
  });

  // Also search prose for context
  const proseResults = await context.search.search(
    `${args.topic} example`,
    { limit: 2, contentType: 'prose', project: args.project }
  );

  const codeExamples = codeResults.slice(0, args.limit);

  if (codeExamples.length === 0) {
    // Try broader search
    const broadResults = await context.search.search(args.topic, {
      limit: args.limit,
      project: args.project
    });

    const anyCode = broadResults.filter(r =>
      r.chunk.contentType === 'code' ||
      r.chunk.content.includes('```') ||
      r.chunk.content.includes('import ')
    );

    if (anyCode.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No code examples found for "${args.topic}" in ${args.project} docs. Try searching for a more specific feature or API.`
        }]
      };
    }

    // Use broad results
    codeExamples.push(...anyCode.slice(0, args.limit));
  }

  const formattedExamples = codeExamples.map((result, index) => {
    const { chunk } = result;
    const language = chunk.metadata.codeLanguage || 'typescript';

    const content = chunk.contentType === 'code'
      ? '```' + language + '\n' + chunk.content + '\n```'
      : chunk.content;

    return [
      `## Example ${index + 1}: ${chunk.section}`,
      `**From:** ${chunk.title}`,
      `**URL:** ${chunk.url}`,
      '',
      content,
      ''
    ].join('\n');
  });

  // Add relevant prose context if available
  const contextSection = proseResults.length > 0 ? [
    '',
    '## Related Documentation',
    '',
    ...proseResults.map(r =>
      `- **${r.chunk.title}** - ${r.chunk.section}: ${r.chunk.url}`
    )
  ].join('\n') : '';

  return {
    content: [{
      type: 'text' as const,
      text: [
        `# Code Examples: ${args.topic} (${args.project})`,
        '',
        ...formattedExamples,
        contextSection
      ].join('\n')
    }]
  };
}
