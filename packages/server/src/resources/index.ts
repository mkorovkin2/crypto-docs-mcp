import type { FullTextDB } from '@mina-docs/shared';

export interface ResourceContext {
  ftsDb: FullTextDB;
}

export function getResourceDefinitions() {
  return [
    {
      uri: 'mina://docs/zkapps/overview',
      name: 'zkApps Overview',
      description: 'Introduction to building zkApps on Mina Protocol',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/o1js/introduction',
      name: 'o1js Introduction',
      description: 'Getting started with the o1js TypeScript framework for zero-knowledge proofs',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/tutorials/hello-world',
      name: 'Hello World Tutorial',
      description: 'Build your first zkApp step by step',
      mimeType: 'text/markdown'
    },
    {
      uri: 'mina://docs/tutorials/deploying',
      name: 'Deployment Guide',
      description: 'How to deploy zkApps to Mina networks',
      mimeType: 'text/markdown'
    }
  ];
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
