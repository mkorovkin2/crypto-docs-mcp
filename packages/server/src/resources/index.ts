import type { FullTextDB } from '@mina-docs/shared';

export interface ResourceContext {
  ftsDb: FullTextDB;
}

export function getResourceDefinitions() {
  return [];
}

export async function handleResourceRead(
  uri: string,
  context: ResourceContext
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  // Parse the URI to determine what content to fetch
  const match = uri.match(/^mina:\/\/docs\/(.+)$/);

  if (!match) {
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: `# Error\n\nInvalid resource URI: ${uri}`
      }]
    };
  }

  const path = match[1];
  const searchTerms = path.replace(/\//g, ' ').replace(/-/g, ' ');

  // Search for content matching this path
  const results = await context.ftsDb.search(searchTerms, {
    limit: 10
  });

  if (results.length === 0) {
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: `# Resource Not Found\n\nNo content found for: ${uri}\n\nTry using the \`search_documentation\` tool to find what you're looking for.`
      }]
    };
  }

  // Combine matching chunks into a single document
  const title = path.split('/').pop()?.replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || 'Documentation';

  const content = results
    .map(r => [
      `## ${r.chunk.section}`,
      '',
      r.chunk.contentType === 'code'
        ? '```' + (r.chunk.metadata.codeLanguage || 'typescript') + '\n' + r.chunk.content + '\n```'
        : r.chunk.content,
      '',
      `*Source: [${r.chunk.title}](${r.chunk.url})*`
    ].join('\n'))
    .join('\n\n---\n\n');

  return {
    contents: [{
      uri,
      mimeType: 'text/markdown',
      text: [
        `# ${title}`,
        '',
        content
      ].join('\n')
    }]
  };
}
