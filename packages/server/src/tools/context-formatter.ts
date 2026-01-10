/**
 * Context Formatter - Formats search results for LLM prompts
 *
 * Includes rich metadata for code chunks to help the LLM:
 * - Generate more accurate code with correct imports
 * - Understand class/method relationships
 * - Reference source file locations
 */

import type { SearchResult } from '@mina-docs/shared';

export interface FormatOptions {
  includeMetadata?: boolean;
  maxContentLength?: number;
  labelType?: boolean;
}

/**
 * Format a single chunk with rich metadata for code comprehension
 */
export function formatChunkWithMetadata(
  result: SearchResult,
  index: number,
  options: FormatOptions = {}
): string {
  const { includeMetadata = true, maxContentLength, labelType = false } = options;
  const { chunk } = result;

  const sourceLabel = `[Source ${index + 1}]`;
  const typeLabel = labelType
    ? (chunk.contentType === 'code' ? '[CODE]' : chunk.contentType === 'api-reference' ? '[API]' : '[DOCS]')
    : '';

  // Build metadata section for code chunks
  let metadataSection = '';
  if (includeMetadata && chunk.contentType === 'code') {
    const metaParts: string[] = [];

    if (chunk.metadata.codeLanguage) {
      metaParts.push(`Language: ${chunk.metadata.codeLanguage}`);
    }
    if (chunk.metadata.className) {
      metaParts.push(`Class: ${chunk.metadata.className}`);
    }
    if (chunk.metadata.methodName) {
      metaParts.push(`Method: ${chunk.metadata.methodName}`);
    }
    if (chunk.metadata.functionName) {
      metaParts.push(`Function: ${chunk.metadata.functionName}`);
    }
    if (chunk.metadata.typeName) {
      metaParts.push(`Type: ${chunk.metadata.typeName}`);
    }
    if (chunk.metadata.filePath) {
      metaParts.push(`File: ${chunk.metadata.filePath}`);
    }
    if (chunk.metadata.sourceType === 'github') {
      metaParts.push(`Source: GitHub`);
    }

    if (metaParts.length > 0) {
      metadataSection = metaParts.join(' | ') + '\n';
    }
  }

  // Include headings context if available
  let headingsContext = '';
  if (includeMetadata && chunk.metadata.headings && chunk.metadata.headings.length > 0) {
    headingsContext = `Headings: ${chunk.metadata.headings.slice(0, 3).join(' > ')}\n`;
  }

  // Truncate content if needed
  let content = chunk.content;
  if (maxContentLength && content.length > maxContentLength) {
    content = content.slice(0, maxContentLength) + '\n... [truncated]';
  }

  return `${sourceLabel} ${typeLabel} ${chunk.title} - ${chunk.section}
${metadataSection}${headingsContext}URL: ${chunk.url}
Content:
${content}
---`;
}

/**
 * Format all search results as context for LLM
 */
export function formatSearchResultsAsContext(
  results: SearchResult[],
  options: FormatOptions = {}
): string {
  return results
    .map((r, i) => formatChunkWithMetadata(r, i, options))
    .join('\n\n');
}

/**
 * Format source URLs for reference section
 */
export function formatSourceUrls(results: SearchResult[]): string {
  return results
    .map((r, i) => `[Source ${i + 1}]: ${r.chunk.url}`)
    .join('\n');
}

/**
 * Get project-specific context for prompts
 */
export function getProjectContext(project: string): string {
  const contexts: Record<string, string> = {
    mina: `
MINA-SPECIFIC NOTES:
- zkApps use o1js library (formerly SnarkyJS)
- Proof generation is async and can take ~30 seconds
- Use Mina testnet (Berkeley) for development: \`Mina.Network('https://api.minascan.io/node/berkeley/v1/graphql')\`
- Browser and Node.js have different setup requirements
- Field, CircuitString, and Bool are core types for zkApp state`,

    solana: `
SOLANA-SPECIFIC NOTES:
- Programs are written in Rust using Anchor framework
- Use devnet for development: \`https://api.devnet.solana.com\`
- Compute units are limited per transaction (200K default)
- PDAs (Program Derived Addresses) are key for account management
- Token accounts are separate from SOL accounts`,

    cosmos: `
COSMOS-SPECIFIC NOTES:
- Modules follow standard patterns: keeper, types, handler
- Use testnet chain-id for development
- Transactions require gas estimation
- IBC is used for cross-chain communication
- State is stored using multistore with prefixed keys`
  };

  return contexts[project.toLowerCase()] || '';
}
