/**
 * GitHub Source Scraper
 *
 * Fetches and parses o1js source code from GitHub to extract:
 * - Class definitions and methods
 * - Type signatures
 * - JSDoc comments
 * - Example code from tests
 */

import { randomUUID } from 'crypto';
import type { DocumentChunk } from '@mina-docs/shared';

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

interface GitHubContent {
  content: string;
  encoding: string;
}

// Files to prioritize for scraping (most useful for API reference)
const PRIORITY_FILES = [
  // Core types
  'src/lib/provable/field.ts',
  'src/lib/provable/bool.ts',
  'src/lib/provable/int.ts',
  'src/lib/provable/string.ts',
  'src/lib/provable/group.ts',
  'src/lib/provable/scalar.ts',
  'src/lib/provable/bytes.ts',

  // Data structures
  'src/lib/provable/merkle-tree.ts',
  'src/lib/provable/merkle-map.ts',
  'src/lib/provable/merkle-list.ts',

  // Crypto
  'src/lib/provable/crypto/poseidon.ts',
  'src/lib/provable/crypto/signature.ts',
  'src/lib/provable/crypto/encryption.ts',

  // Smart contracts
  'src/lib/mina/zkapp.ts',
  'src/lib/mina/state.ts',
  'src/lib/mina/account-update.ts',
  'src/lib/mina/transaction.ts',
  'src/lib/mina/mina.ts',
  'src/lib/mina/token.ts',

  // Keys
  'src/lib/provable/crypto/signature.ts',
  'src/lib/mina/account.ts',

  // Provable utilities
  'src/lib/provable/provable.ts',
  'src/lib/provable/types/struct.ts',
  'src/lib/provable/types/witness.ts',

  // ZkProgram
  'src/lib/proof-system/zkprogram.ts',
  'src/lib/proof-system/proof.ts',

  // Actions/Reducer
  'src/lib/mina/actions/reducer.ts',
  'src/lib/mina/actions/offchain-state.ts',

  // Foreign field/curve (ECDSA)
  'src/lib/provable/foreign-field.ts',
  'src/lib/provable/foreign-curve.ts',
  'src/lib/provable/crypto/foreign-ecdsa.ts',

  // Gadgets
  'src/lib/provable/gadgets/gadgets.ts',
  'src/lib/provable/gadgets/sha256.ts',
  'src/lib/provable/gadgets/bitwise.ts'
];

// Test files to extract examples from
const TEST_FILES = [
  'src/examples/',
  'src/tests/vk-regression/'
];

export interface GitHubSourceOptions {
  repo: string;  // e.g., 'o1-labs/o1js'
  branch: string;
  token?: string;  // GitHub token for higher rate limits
}

export class GitHubSourceScraper {
  private baseApiUrl: string;
  private headers: Record<string, string>;

  constructor(private options: GitHubSourceOptions) {
    this.baseApiUrl = `https://api.github.com/repos/${options.repo}`;
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'mina-docs-scraper'
    };

    if (options.token) {
      this.headers['Authorization'] = `token ${options.token}`;
    }
  }

  /**
   * Fetch file content from GitHub
   */
  async fetchFile(path: string): Promise<string | null> {
    try {
      const url = `${this.baseApiUrl}/contents/${path}?ref=${this.options.branch}`;
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        console.error(`  Failed to fetch ${path}: ${response.status}`);
        return null;
      }

      const data = await response.json() as GitHubContent;

      if (data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return data.content;
    } catch (error) {
      console.error(`  Error fetching ${path}:`, error);
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listDirectory(path: string): Promise<GitHubFile[]> {
    try {
      const url = `${this.baseApiUrl}/contents/${path}?ref=${this.options.branch}`;
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        return [];
      }

      return await response.json() as GitHubFile[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse TypeScript source file into chunks
   */
  parseSourceFile(path: string, content: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const lines = content.split('\n');
    const fileName = path.split('/').pop() || path;

    // Extract class definitions with their methods
    const classRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?class\s+(\w+)(?:\s+extends\s+[\w<>,\s]+)?(?:\s+implements\s+[\w<>,\s]+)?\s*\{/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[2];
      const classStart = match.index;

      // Find the JSDoc comment before the class
      const beforeClass = content.slice(0, classStart);
      const jsDocMatch = beforeClass.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? jsDocMatch[0].trim() : '';

      // Find class end (matching braces)
      let braceCount = 0;
      let classEnd = classStart;
      let foundFirstBrace = false;

      for (let i = classStart; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          foundFirstBrace = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (foundFirstBrace && braceCount === 0) {
            classEnd = i + 1;
            break;
          }
        }
      }

      const classBody = content.slice(classStart, classEnd);

      // Create chunk for the class
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.options.repo}/blob/${this.options.branch}/${path}`,
        title: `o1js Source: ${className}`,
        section: fileName,
        content: this.formatClassContent(className, jsDoc, classBody),
        contentType: 'code',
        metadata: {
          headings: ['o1js', 'Source Code', className],
          codeLanguage: 'typescript',
          sourceType: 'github',
          className,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });

      // Extract method signatures from the class
      const methodChunks = this.extractMethods(className, classBody, path);
      chunks.push(...methodChunks);
    }

    // Extract standalone functions
    const functionRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(async\s+)?function\s+(\w+)\s*(<[\s\S]*?>)?\s*\([^)]*\)(?:\s*:\s*[\w<>\[\],\s|]+)?\s*\{/g;

    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[3];
      const funcStart = match.index;

      // Find JSDoc
      const beforeFunc = content.slice(0, funcStart);
      const jsDocMatch = beforeFunc.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? jsDocMatch[0].trim() : '';

      // Find function end
      let braceCount = 0;
      let funcEnd = funcStart;
      let foundFirstBrace = false;

      for (let i = funcStart; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          foundFirstBrace = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (foundFirstBrace && braceCount === 0) {
            funcEnd = i + 1;
            break;
          }
        }
      }

      // Just get the signature, not full body
      const signatureLine = content.slice(funcStart, content.indexOf('{', funcStart));

      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.options.repo}/blob/${this.options.branch}/${path}`,
        title: `o1js Function: ${funcName}`,
        section: fileName,
        content: this.formatFunctionContent(funcName, jsDoc, signatureLine),
        contentType: 'api-reference',
        metadata: {
          headings: ['o1js', 'Functions', funcName],
          sourceType: 'github',
          functionName: funcName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    // Extract type/interface definitions
    const typeRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(type|interface)\s+(\w+)(?:<[\s\S]*?>)?\s*=?\s*[\s\S]*?(?:;|\{[\s\S]*?\})/g;

    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[3];
      const typeContent = match[0];

      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.options.repo}/blob/${this.options.branch}/${path}`,
        title: `o1js Type: ${typeName}`,
        section: fileName,
        content: typeContent,
        contentType: 'api-reference',
        metadata: {
          headings: ['o1js', 'Types', typeName],
          codeLanguage: 'typescript',
          sourceType: 'github',
          typeName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    return chunks;
  }

  /**
   * Extract method definitions from a class body
   */
  private extractMethods(className: string, classBody: string, path: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;

    // Match method definitions
    const methodRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(static\s+)?(async\s+)?(\w+)\s*(<[\s\S]*?>)?\s*\([^)]*\)(?:\s*:\s*[\w<>\[\],\s|]+)?(?:\s*\{)/g;

    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const isStatic = !!match[1];
      const isAsync = !!match[2];
      const methodName = match[3];

      // Skip constructor and private methods
      if (methodName === 'constructor' || methodName.startsWith('_')) {
        continue;
      }

      // Find JSDoc before method
      const beforeMethod = classBody.slice(0, match.index);
      const jsDocMatch = beforeMethod.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? this.parseJsDoc(jsDocMatch[0]) : '';

      // Get the signature line
      const signatureLine = match[0].slice(0, -1).trim(); // Remove opening brace

      const content = [
        `## ${className}.${methodName}`,
        '',
        '```typescript',
        `${isStatic ? 'static ' : ''}${isAsync ? 'async ' : ''}${signatureLine}`,
        '```',
        ''
      ];

      if (jsDoc) {
        content.push(jsDoc, '');
      }

      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.options.repo}/blob/${this.options.branch}/${path}`,
        title: `${className}.${methodName}`,
        section: `${className} methods`,
        content: content.join('\n'),
        contentType: 'api-reference',
        metadata: {
          headings: ['o1js', className, methodName],
          sourceType: 'github',
          className,
          methodName,
          isStatic,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    return chunks;
  }

  /**
   * Parse JSDoc comment into readable text
   */
  private parseJsDoc(jsDoc: string): string {
    // Remove comment delimiters
    let text = jsDoc
      .replace(/\/\*\*/, '')
      .replace(/\*\//, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();

    // Parse @param tags
    const params: string[] = [];
    const paramRegex = /@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s*-?\s*(.*)/g;
    let paramMatch;

    while ((paramMatch = paramRegex.exec(text)) !== null) {
      const type = paramMatch[1] || '';
      const name = paramMatch[2];
      const desc = paramMatch[3];
      params.push(`- \`${name}\`${type ? ` (${type})` : ''}: ${desc}`);
    }

    // Parse @returns tag
    const returnsMatch = text.match(/@returns?\s+(?:\{([^}]+)\}\s*)?(.*)/);
    const returns = returnsMatch
      ? `**Returns:** ${returnsMatch[2]}${returnsMatch[1] ? ` (${returnsMatch[1]})` : ''}`
      : '';

    // Parse @example tag
    const exampleMatch = text.match(/@example\s*([\s\S]*?)(?=@|$)/);
    const example = exampleMatch
      ? '**Example:**\n```typescript\n' + exampleMatch[1].trim() + '\n```'
      : '';

    // Get main description (before any @ tags)
    const mainDesc = text.split(/@\w+/)[0].trim();

    // Build final text
    const parts = [mainDesc];
    if (params.length > 0) {
      parts.push('', '**Parameters:**', ...params);
    }
    if (returns) {
      parts.push('', returns);
    }
    if (example) {
      parts.push('', example);
    }

    return parts.join('\n');
  }

  /**
   * Format class content for storage
   */
  private formatClassContent(className: string, jsDoc: string, classBody: string): string {
    const sections = [`# Class: ${className}`, ''];

    if (jsDoc) {
      sections.push(this.parseJsDoc(jsDoc), '');
    }

    // Get first ~100 lines of class body for overview
    const bodyLines = classBody.split('\n').slice(0, 100);
    sections.push('```typescript', ...bodyLines, '```');

    return sections.join('\n');
  }

  /**
   * Format function content for storage
   */
  private formatFunctionContent(funcName: string, jsDoc: string, signature: string): string {
    const sections = [`# Function: ${funcName}`, ''];

    sections.push('```typescript', signature.trim(), '```', '');

    if (jsDoc) {
      sections.push(this.parseJsDoc(jsDoc));
    }

    return sections.join('\n');
  }

  /**
   * Scrape all priority source files
   */
  async *scrape(): AsyncGenerator<{ path: string; chunks: DocumentChunk[] }> {
    console.log(`\nScraping o1js source from ${this.options.repo}...`);

    for (const filePath of PRIORITY_FILES) {
      console.log(`  Fetching: ${filePath}`);

      const content = await this.fetchFile(filePath);
      if (!content) {
        continue;
      }

      const chunks = this.parseSourceFile(filePath, content);
      if (chunks.length > 0) {
        console.log(`    → Extracted ${chunks.length} chunks`);
        yield { path: filePath, chunks };
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// Export for use in main scraper
export async function scrapeGitHubSource(
  options: GitHubSourceOptions
): Promise<DocumentChunk[]> {
  const scraper = new GitHubSourceScraper(options);
  const allChunks: DocumentChunk[] = [];

  for await (const { chunks } of scraper.scrape()) {
    allChunks.push(...chunks);
  }

  return allChunks;
}
