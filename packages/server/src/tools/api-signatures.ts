import { z } from 'zod';
import type { ToolContext } from './index.js';

export const GetApiSignatureSchema = z.object({
  className: z.string().describe('Class name (e.g., "Field", "SmartContract", "MerkleTree")'),
  project: z.string(),
  methodName: z.string().optional().describe('Specific method name (optional - omit to get class overview)')
});

type GetApiSignatureArgs = z.infer<typeof GetApiSignatureSchema>;

export async function getApiSignature(
  args: GetApiSignatureArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Build search query
  const searchQuery = args.methodName
    ? `${args.className} ${args.methodName} API method signature`
    : `${args.className} API reference class`;

  // Search documentation for API info
  const results = await context.search.search(searchQuery, {
    limit: 5,
    contentType: 'api-reference',
    project: args.project
  });

  // Also search code for usage examples
  const codeResults = await context.search.search(
    args.methodName
      ? `${args.className}.${args.methodName}`
      : args.className,
    { limit: 3, contentType: 'code', project: args.project }
  );

  const sections: string[] = [];

  if (args.methodName) {
    sections.push(`# ${args.className}.${args.methodName} (${args.project})`);
  } else {
    sections.push(`# ${args.className} (${args.project})`);
  }
  sections.push('');

  if (results.length === 0 && codeResults.length === 0) {
    sections.push(
      `No API documentation found for "${args.className}"${args.methodName ? `.${args.methodName}` : ''} in ${args.project} docs.`,
      '',
      'Try:',
      '- Checking the spelling of the class/method name',
      '- Using `search_documentation` for broader results',
      '- Looking for code examples with `get_code_examples`'
    );

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  // Add API reference results
  if (results.length > 0) {
    sections.push('## API Reference', '');

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
        sections.push(result.chunk.content);
      }

      sections.push('', `[Source](${result.chunk.url})`, '');
    }
  }

  // Add code examples
  if (codeResults.length > 0) {
    sections.push('## Code Examples', '');

    for (const result of codeResults) {
      const language = result.chunk.metadata.codeLanguage || 'typescript';
      sections.push(
        `### From: ${result.chunk.title}`,
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

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
