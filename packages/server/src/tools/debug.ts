import { z } from 'zod';
import type { ToolContext } from './index.js';

export const DebugHelperSchema = z.object({
  error: z.string(),
  project: z.string(),
  context: z.string().optional()
});

type DebugHelperArgs = z.infer<typeof DebugHelperSchema>;

export async function debugHelper(
  args: DebugHelperArgs,
  context: ToolContext
) {
  // Search documentation for error-related content
  const searchQuery = args.context
    ? `${args.error} ${args.context}`
    : args.error;

  const results = await context.search.search(
    `error troubleshoot ${searchQuery}`,
    { limit: 5, project: args.project }
  );

  const sections: string[] = [
    `# Debugging: ${args.error.slice(0, 80)}${args.error.length > 80 ? '...' : ''} (${args.project})`,
    ''
  ];

  if (args.context) {
    sections.push(`**Context:** ${args.context}`, '');
  }

  // Add relevant documentation
  if (results.length > 0) {
    sections.push(
      '## Related Documentation',
      ''
    );

    for (const result of results) {
      const preview = result.chunk.content.slice(0, 400) +
        (result.chunk.content.length > 400 ? '...' : '');

      sections.push(
        `### ${result.chunk.title} - ${result.chunk.section}`,
        '',
        preview,
        '',
        `[Read more](${result.chunk.url})`,
        ''
      );
    }
  } else {
    sections.push(
      'No specific documentation found for this error.',
      '',
      'Try:',
      '- Rephrasing the error message',
      '- Using `search_documentation` for broader results',
      `- Checking the ${args.project} documentation directly`
    );
  }

  return {
    content: [{
      type: 'text' as const,
      text: sections.join('\n')
    }]
  };
}
