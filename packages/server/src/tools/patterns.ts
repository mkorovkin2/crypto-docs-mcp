import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetPatternSchema = z.object({
  task: z.string().describe('Task or pattern to find (e.g., "merkle membership proof", "emit events", "deploy contract")'),
  project: z.string(),
  includeVariations: z.boolean().optional().default(true).describe('Include alternative approaches and variations')
});

type GetPatternArgs = z.infer<typeof GetPatternSchema>;

export async function getPattern(
  args: GetPatternArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Search for patterns and examples
  const results = await context.search.search(
    `${args.task} pattern example how to`,
    { limit: 5, project: args.project }
  );

  // Search specifically for code examples
  const codeResults = await context.search.search(
    args.task,
    { limit: 3, contentType: 'code', project: args.project }
  );

  const sections: string[] = [
    `# Pattern: ${args.task} (${args.project})`,
    ''
  ];

  if (results.length === 0 && codeResults.length === 0) {
    sections.push(
      `No patterns found for "${args.task}" in ${args.project} docs.`,
      '',
      'Try:',
      '- Using different keywords to describe the pattern',
      '- Using `search_documentation` for broader results',
      '- Looking for specific code examples with `get_code_examples`'
    );

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  // Add main documentation results
  if (results.length > 0) {
    sections.push('## Documentation', '');

    for (const result of results) {
      sections.push(
        `### ${result.chunk.title} - ${result.chunk.section}`,
        ''
      );

      if (result.chunk.contentType === 'code') {
        sections.push(
          '```' + (result.chunk.metadata.codeLanguage || 'typescript'),
          result.chunk.content,
          '```'
        );
      } else {
        // Truncate long prose
        const content = result.chunk.content.length > 600
          ? result.chunk.content.slice(0, 600) + '...'
          : result.chunk.content;
        sections.push(content);
      }

      sections.push('', `[Read more](${result.chunk.url})`, '');
    }
  }

  // Add code examples
  if (codeResults.length > 0) {
    sections.push('## Code Examples', '');

    for (const result of codeResults) {
      const language = result.chunk.metadata.codeLanguage || 'typescript';
      sections.push(
        `### ${result.chunk.title} - ${result.chunk.section}`,
        '',
        '```' + language,
        result.chunk.content,
        '```',
        '',
        `[Source](${result.chunk.url})`,
        ''
      );
    }
  }

  // Add related patterns if requested
  if (args.includeVariations && results.length > 0) {
    // Search for alternative approaches
    const alternativeResults = await context.search.search(
      `${args.task} alternative approach`,
      { limit: 2, project: args.project }
    );

    if (alternativeResults.length > 0) {
      sections.push('## Alternative Approaches', '');

      for (const result of alternativeResults) {
        sections.push(`- [${result.chunk.title} - ${result.chunk.section}](${result.chunk.url})`);
      }
      sections.push('');
    }
  }

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
