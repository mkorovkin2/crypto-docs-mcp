import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ResolveImportSchema = z.object({
  symbol: z.string().describe('Symbol to import (e.g., "MerkleTree", "Poseidon", "SmartContract")'),
  project: z.string(),
  includeRelated: z.boolean().optional().default(true).describe('Include related symbols you might also need')
});

type ResolveImportArgs = z.infer<typeof ResolveImportSchema>;

export async function resolveImport(
  args: ResolveImportArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const normalizedSymbol = args.symbol.trim();

  // Search for import statements and usage
  const results = await context.search.search(
    `import ${normalizedSymbol}`,
    { limit: 5, contentType: 'code', project: args.project }
  );

  // Also search for general documentation about the symbol
  const docsResults = await context.search.search(
    `${normalizedSymbol} usage example`,
    { limit: 3, project: args.project }
  );

  const sections: string[] = [
    `# Import: ${normalizedSymbol} (${args.project})`,
    ''
  ];

  if (results.length === 0 && docsResults.length === 0) {
    sections.push(
      `No import information found for "${normalizedSymbol}" in ${args.project} docs.`,
      '',
      'Try:',
      '- Checking the spelling of the symbol',
      '- Using `search_documentation` to find related content',
      '- Looking for code examples with `get_code_examples`'
    );

    return {
      content: [{ type: 'text', text: sections.join('\n') }]
    };
  }

  // Extract import statements from code results
  const importStatements = new Set<string>();
  for (const result of results) {
    const content = result.chunk.content;
    // Find import lines that contain the symbol
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('import') && line.includes(normalizedSymbol)) {
        importStatements.add(line.trim());
      }
    }
  }

  if (importStatements.size > 0) {
    sections.push('## Import Statements Found', '');
    sections.push('```typescript');
    for (const stmt of importStatements) {
      sections.push(stmt);
    }
    sections.push('```', '');
  }

  // Add code examples
  if (results.length > 0) {
    sections.push('## Usage Examples', '');

    for (const result of results.slice(0, 3)) {
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

  // Add related documentation
  if (args.includeRelated && docsResults.length > 0) {
    sections.push('## Related Documentation', '');

    for (const result of docsResults) {
      sections.push(`- [${result.chunk.title} - ${result.chunk.section}](${result.chunk.url})`);
    }
    sections.push('');
  }

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
