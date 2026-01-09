/**
 * GitHub Source Scraper
 *
 * Fetches and parses source code from GitHub to extract:
 * - Class definitions and methods
 * - Type signatures
 * - JSDoc comments
 * - Function definitions
 */

import { randomUUID } from 'crypto';
import type { DocumentChunk, GitHubSourceConfig } from '@mina-docs/shared';
import { minimatch } from 'minimatch';

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

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubScraperOptions {
  config: GitHubSourceConfig;
  token?: string;
  project: string;
}

export class GitHubSourceScraper {
  private baseApiUrl: string;
  private headers: Record<string, string>;
  private config: GitHubSourceConfig;
  private project: string;

  constructor(private options: GitHubScraperOptions) {
    this.config = options.config;
    this.project = options.project;
    this.baseApiUrl = `https://api.github.com/repos/${this.config.repo}`;
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'crypto-docs-scraper'
    };

    if (options.token) {
      this.headers['Authorization'] = `token ${options.token}`;
    }
  }

  /**
   * List all files in the repository using the Git Tree API
   */
  async listAllFiles(): Promise<string[]> {
    try {
      const url = `${this.baseApiUrl}/git/trees/${this.config.branch}?recursive=1`;
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        console.error(`  Failed to list files: ${response.status}`);
        return [];
      }

      const data = await response.json() as GitHubTreeResponse;

      // Filter to only files (not directories)
      return data.tree
        .filter(item => item.type === 'blob')
        .map(item => item.path);
    } catch (error) {
      console.error('  Error listing files:', error);
      return [];
    }
  }

  /**
   * Check if a file path matches the include/exclude patterns
   */
  matchesPatterns(path: string): boolean {
    // Check if path matches any include pattern
    const included = this.config.include.some(pattern =>
      minimatch(path, pattern, { matchBase: true })
    );

    if (!included) return false;

    // Check if path matches any exclude pattern
    const excluded = this.config.exclude.some(pattern =>
      minimatch(path, pattern, { matchBase: true })
    );

    return !excluded;
  }

  /**
   * Fetch file content from GitHub
   */
  async fetchFile(path: string): Promise<string | null> {
    try {
      const url = `${this.baseApiUrl}/contents/${path}?ref=${this.config.branch}`;
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
   * Detect language from file extension
   */
  detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'rs': 'rust',
      'go': 'go',
      'py': 'python',
      'sol': 'solidity',
      'move': 'move',
    };
    return langMap[ext] || ext;
  }

  /**
   * Parse source file into chunks (generic, works with multiple languages)
   */
  parseSourceFile(path: string, content: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;
    const language = this.detectLanguage(path);
    const repoName = this.config.repo.split('/').pop() || this.config.repo;

    // For TypeScript/JavaScript, extract classes, functions, types
    if (language === 'typescript' || language === 'javascript') {
      chunks.push(...this.parseTypeScriptFile(path, content, repoName));
    }
    // For Rust, extract structs, impls, functions
    else if (language === 'rust') {
      chunks.push(...this.parseRustFile(path, content, repoName));
    }
    // For Go, extract types and functions
    else if (language === 'go') {
      chunks.push(...this.parseGoFile(path, content, repoName));
    }
    // For other languages, just store the whole file as a chunk
    else {
      if (content.length > 100) {
        chunks.push({
          id: randomUUID(),
          url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
          title: `${repoName}: ${fileName}`,
          section: fileName,
          content: content.slice(0, 5000), // Limit size
          contentType: 'code',
          project: this.project,
          metadata: {
            headings: [repoName, 'Source Code', fileName],
            codeLanguage: language,
            sourceType: 'github',
            filePath: path,
            lastScraped: new Date().toISOString()
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Parse TypeScript/JavaScript file
   */
  private parseTypeScriptFile(path: string, content: string, repoName: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;

    // Extract class definitions
    const classRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?class\s+(\w+)(?:\s+extends\s+[\w<>,\s]+)?(?:\s+implements\s+[\w<>,\s]+)?\s*\{/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[2];
      const classStart = match.index;

      // Find JSDoc
      const beforeClass = content.slice(0, classStart);
      const jsDocMatch = beforeClass.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? jsDocMatch[0].trim() : '';

      // Find class end
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

      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Source: ${className}`,
        section: fileName,
        content: this.formatClassContent(className, jsDoc, classBody),
        contentType: 'code',
        project: this.project,
        metadata: {
          headings: [repoName, 'Source Code', className],
          codeLanguage: 'typescript',
          sourceType: 'github',
          className,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });

      // Extract methods
      const methodChunks = this.extractTypeScriptMethods(className, classBody, path, repoName);
      chunks.push(...methodChunks);
    }

    // Extract standalone functions
    const functionRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(async\s+)?function\s+(\w+)\s*(<[\s\S]*?>)?\s*\([^)]*\)(?:\s*:\s*[\w<>\[\],\s|]+)?\s*\{/g;

    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[3];
      const funcStart = match.index;

      const beforeFunc = content.slice(0, funcStart);
      const jsDocMatch = beforeFunc.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? jsDocMatch[0].trim() : '';

      const signatureLine = content.slice(funcStart, content.indexOf('{', funcStart));

      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Function: ${funcName}`,
        section: fileName,
        content: this.formatFunctionContent(funcName, jsDoc, signatureLine),
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Functions', funcName],
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
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Type: ${typeName}`,
        section: fileName,
        content: typeContent,
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Types', typeName],
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
   * Parse Rust file
   */
  private parseRustFile(path: string, content: string, repoName: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;

    // Extract struct definitions
    const structRegex = /(?:\/\/\/[^\n]*\n)*(?:#\[[\s\S]*?\]\s*)*pub\s+struct\s+(\w+)(?:<[\s\S]*?>)?\s*(?:\{[\s\S]*?\}|;)/g;

    let match;
    while ((match = structRegex.exec(content)) !== null) {
      const structName = match[1];
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Struct: ${structName}`,
        section: fileName,
        content: match[0],
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Structs', structName],
          codeLanguage: 'rust',
          sourceType: 'github',
          typeName: structName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    // Extract pub fn definitions
    const fnRegex = /(?:\/\/\/[^\n]*\n)*pub\s+(?:async\s+)?fn\s+(\w+)(?:<[\s\S]*?>)?\s*\([^)]*\)(?:\s*->\s*[\w<>\[\],\s&']+)?/g;

    while ((match = fnRegex.exec(content)) !== null) {
      const fnName = match[1];
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Function: ${fnName}`,
        section: fileName,
        content: match[0],
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Functions', fnName],
          codeLanguage: 'rust',
          sourceType: 'github',
          functionName: fnName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    return chunks;
  }

  /**
   * Parse Go file
   */
  private parseGoFile(path: string, content: string, repoName: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;

    // Extract type definitions
    const typeRegex = /(?:\/\/[^\n]*\n)*type\s+(\w+)\s+(?:struct|interface)\s*\{[\s\S]*?\n\}/g;

    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Type: ${typeName}`,
        section: fileName,
        content: match[0],
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Types', typeName],
          codeLanguage: 'go',
          sourceType: 'github',
          typeName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    // Extract exported functions
    const fnRegex = /(?:\/\/[^\n]*\n)*func\s+(?:\([^)]+\)\s+)?([A-Z]\w*)\s*\([^)]*\)(?:\s*(?:\([^)]*\)|[\w*]+))?/g;

    while ((match = fnRegex.exec(content)) !== null) {
      const fnName = match[1];
      chunks.push({
        id: randomUUID(),
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${repoName} Function: ${fnName}`,
        section: fileName,
        content: match[0],
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, 'Functions', fnName],
          codeLanguage: 'go',
          sourceType: 'github',
          functionName: fnName,
          filePath: path,
          lastScraped: new Date().toISOString()
        }
      });
    }

    return chunks;
  }

  /**
   * Extract methods from a TypeScript class body
   */
  private extractTypeScriptMethods(className: string, classBody: string, path: string, repoName: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const fileName = path.split('/').pop() || path;

    const methodRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(static\s+)?(async\s+)?(\w+)\s*(<[\s\S]*?>)?\s*\([^)]*\)(?:\s*:\s*[\w<>\[\],\s|]+)?(?:\s*\{)/g;

    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const isStatic = !!match[1];
      const isAsync = !!match[2];
      const methodName = match[3];

      if (methodName === 'constructor' || methodName.startsWith('_')) {
        continue;
      }

      const beforeMethod = classBody.slice(0, match.index);
      const jsDocMatch = beforeMethod.match(/\/\*\*[\s\S]*?\*\/\s*$/);
      const jsDoc = jsDocMatch ? this.parseJsDoc(jsDocMatch[0]) : '';

      const signatureLine = match[0].slice(0, -1).trim();

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
        url: `https://github.com/${this.config.repo}/blob/${this.config.branch}/${path}`,
        title: `${className}.${methodName}`,
        section: `${className} methods`,
        content: content.join('\n'),
        contentType: 'api-reference',
        project: this.project,
        metadata: {
          headings: [repoName, className, methodName],
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
    let text = jsDoc
      .replace(/\/\*\*/, '')
      .replace(/\*\//, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();

    const params: string[] = [];
    const paramRegex = /@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s*-?\s*(.*)/g;
    let paramMatch;

    while ((paramMatch = paramRegex.exec(text)) !== null) {
      const type = paramMatch[1] || '';
      const name = paramMatch[2];
      const desc = paramMatch[3];
      params.push(`- \`${name}\`${type ? ` (${type})` : ''}: ${desc}`);
    }

    const returnsMatch = text.match(/@returns?\s+(?:\{([^}]+)\}\s*)?(.*)/);
    const returns = returnsMatch
      ? `**Returns:** ${returnsMatch[2]}${returnsMatch[1] ? ` (${returnsMatch[1]})` : ''}`
      : '';

    const exampleMatch = text.match(/@example\s*([\s\S]*?)(?=@|$)/);
    const example = exampleMatch
      ? '**Example:**\n```typescript\n' + exampleMatch[1].trim() + '\n```'
      : '';

    const mainDesc = text.split(/@\w+/)[0].trim();

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
   * Scrape source files matching the patterns
   */
  async *scrape(): AsyncGenerator<{ path: string; chunks: DocumentChunk[] }> {
    console.log(`\nFetching file list from ${this.config.repo}...`);

    const allFiles = await this.listAllFiles();
    const matchingFiles = allFiles.filter(f => this.matchesPatterns(f));

    console.log(`  Found ${matchingFiles.length} files matching patterns`);

    for (const filePath of matchingFiles) {
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
  options: GitHubScraperOptions
): Promise<DocumentChunk[]> {
  const scraper = new GitHubSourceScraper(options);
  const allChunks: DocumentChunk[] = [];

  for await (const { chunks } of scraper.scrape()) {
    allChunks.push(...chunks);
  }

  return allChunks;
}
