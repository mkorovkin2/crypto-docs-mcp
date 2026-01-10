/**
 * AST-Aware Code Chunker
 *
 * Chunks code based on semantic boundaries (functions, classes, methods)
 * rather than arbitrary token counts. This preserves code integrity
 * and improves retrieval quality.
 *
 * Research shows AST-based chunking improves:
 * - RepoEval Recall: +4.3 points
 * - SWE-Bench Pass@1: +2.67 points
 *
 * This implementation uses regex-based structure detection for portability.
 * Can be enhanced with tree-sitter for more accurate parsing if needed.
 */

import type { DocumentChunk } from '@mina-docs/shared';
import { randomUUID } from 'crypto';

// Target ~4000 non-whitespace characters (research optimal)
const TARGET_CHUNK_SIZE = 4000;
const MIN_CHUNK_SIZE = 200;
const MAX_CHUNK_SIZE = 8000;

interface CodeStructure {
  type: 'class' | 'function' | 'method' | 'interface' | 'type' | 'const' | 'import_block' | 'other';
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  className?: string; // For methods
}

/**
 * Language-specific patterns for detecting code structures
 */
const LANGUAGE_PATTERNS: Record<string, {
  class: RegExp;
  function: RegExp;
  method: RegExp;
  interface: RegExp;
  type: RegExp;
  const: RegExp;
  import: RegExp;
}> = {
  typescript: {
    class: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    function: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    method: /^\s*(?:public|private|protected|static|async|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/,
    interface: /^(?:export\s+)?interface\s+(\w+)/,
    type: /^(?:export\s+)?type\s+(\w+)/,
    const: /^(?:export\s+)?const\s+(\w+)/,
    import: /^import\s+/
  },
  javascript: {
    class: /^(?:export\s+)?class\s+(\w+)/,
    function: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    method: /^\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
    interface: /(?!)/, // JS doesn't have interfaces
    type: /(?!)/,
    const: /^(?:export\s+)?const\s+(\w+)/,
    import: /^import\s+/
  },
  rust: {
    class: /^(?:pub\s+)?struct\s+(\w+)/,
    function: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
    method: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
    interface: /^(?:pub\s+)?trait\s+(\w+)/,
    type: /^(?:pub\s+)?type\s+(\w+)/,
    const: /^(?:pub\s+)?const\s+(\w+)/,
    import: /^use\s+/
  },
  go: {
    class: /^type\s+(\w+)\s+struct/,
    function: /^func\s+(\w+)\s*\(/,
    method: /^func\s+\([^)]+\)\s+(\w+)\s*\(/,
    interface: /^type\s+(\w+)\s+interface/,
    type: /^type\s+(\w+)\s+/,
    const: /^(?:const|var)\s+(\w+)/,
    import: /^import\s+/
  },
  python: {
    class: /^class\s+(\w+)/,
    function: /^(?:async\s+)?def\s+(\w+)/,
    method: /^\s+(?:async\s+)?def\s+(\w+)/,
    interface: /(?!)/, // Python doesn't have interfaces
    type: /(?!)/,
    const: /^(\w+)\s*=/,
    import: /^(?:import|from)\s+/
  }
};

/**
 * Detect language from file extension or content
 */
function detectLanguage(content: string, language?: string): string {
  if (language) {
    const normalized = language.toLowerCase();
    if (['ts', 'tsx', 'typescript'].includes(normalized)) return 'typescript';
    if (['js', 'jsx', 'javascript'].includes(normalized)) return 'javascript';
    if (['rs', 'rust'].includes(normalized)) return 'rust';
    if (['go', 'golang'].includes(normalized)) return 'go';
    if (['py', 'python'].includes(normalized)) return 'python';
  }

  // Heuristic detection
  if (content.includes(': string') || content.includes(': number') || content.includes('interface ')) {
    return 'typescript';
  }
  if (content.includes('fn ') && content.includes('->')) {
    return 'rust';
  }
  if (content.includes('func ') && content.includes(':=')) {
    return 'go';
  }
  if (content.includes('def ') && content.includes(':')) {
    return 'python';
  }

  return 'javascript'; // Default fallback
}

/**
 * Count non-whitespace characters (research-recommended metric)
 */
function countNonWhitespace(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Find the end of a code block by tracking braces/indentation
 */
function findBlockEnd(lines: string[], startLine: number, language: string): number {
  let braceCount = 0;
  let started = false;

  // Python uses indentation
  if (language === 'python') {
    const startIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      if (indent <= startIndent && line.trim() !== '') {
        return i - 1;
      }
    }
    return lines.length - 1;
  }

  // Brace-based languages
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i;
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Extract code structures from source code
 */
function extractStructures(code: string, language: string): CodeStructure[] {
  const structures: CodeStructure[] = [];
  const lines = code.split('\n');
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;

  let currentClass: string | undefined;
  let importBlock: string[] = [];
  let importStartLine = -1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      // End import block if we have one
      if (importBlock.length > 0) {
        structures.push({
          type: 'import_block',
          name: 'imports',
          startLine: importStartLine,
          endLine: i - 1,
          content: importBlock.join('\n')
        });
        importBlock = [];
        importStartLine = -1;
      }
      i++;
      continue;
    }

    // Collect imports
    if (patterns.import.test(trimmedLine)) {
      if (importStartLine === -1) importStartLine = i;
      importBlock.push(line);
      i++;
      continue;
    } else if (importBlock.length > 0) {
      structures.push({
        type: 'import_block',
        name: 'imports',
        startLine: importStartLine,
        endLine: i - 1,
        content: importBlock.join('\n')
      });
      importBlock = [];
      importStartLine = -1;
    }

    // Check for class
    const classMatch = trimmedLine.match(patterns.class);
    if (classMatch) {
      const endLine = findBlockEnd(lines, i, language);
      const content = lines.slice(i, endLine + 1).join('\n');
      structures.push({
        type: 'class',
        name: classMatch[1],
        startLine: i,
        endLine,
        content
      });
      currentClass = classMatch[1];
      i = endLine + 1;
      continue;
    }

    // Check for interface
    const interfaceMatch = trimmedLine.match(patterns.interface);
    if (interfaceMatch) {
      const endLine = findBlockEnd(lines, i, language);
      const content = lines.slice(i, endLine + 1).join('\n');
      structures.push({
        type: 'interface',
        name: interfaceMatch[1],
        startLine: i,
        endLine,
        content
      });
      i = endLine + 1;
      continue;
    }

    // Check for type alias
    const typeMatch = trimmedLine.match(patterns.type);
    if (typeMatch && !trimmedLine.includes('struct') && !trimmedLine.includes('interface')) {
      // Type aliases are usually single lines or end at semicolon/newline
      let endLine = i;
      if (!trimmedLine.includes(';') && !trimmedLine.includes('=')) {
        endLine = findBlockEnd(lines, i, language);
      }
      const content = lines.slice(i, endLine + 1).join('\n');
      structures.push({
        type: 'type',
        name: typeMatch[1],
        startLine: i,
        endLine,
        content
      });
      i = endLine + 1;
      continue;
    }

    // Check for function
    const functionMatch = trimmedLine.match(patterns.function);
    if (functionMatch) {
      const endLine = findBlockEnd(lines, i, language);
      const content = lines.slice(i, endLine + 1).join('\n');
      structures.push({
        type: 'function',
        name: functionMatch[1],
        startLine: i,
        endLine,
        content
      });
      i = endLine + 1;
      continue;
    }

    // Check for const
    const constMatch = trimmedLine.match(patterns.const);
    if (constMatch) {
      // Check if it's a function expression or object
      let endLine = i;
      if (trimmedLine.includes('{') || trimmedLine.includes('=>')) {
        endLine = findBlockEnd(lines, i, language);
      }
      const content = lines.slice(i, endLine + 1).join('\n');
      structures.push({
        type: 'const',
        name: constMatch[1],
        startLine: i,
        endLine,
        content
      });
      i = endLine + 1;
      continue;
    }

    i++;
  }

  // Don't forget trailing imports
  if (importBlock.length > 0) {
    structures.push({
      type: 'import_block',
      name: 'imports',
      startLine: importStartLine,
      endLine: lines.length - 1,
      content: importBlock.join('\n')
    });
  }

  return structures;
}

/**
 * Merge small adjacent structures to avoid tiny chunks
 */
function mergeSmallStructures(structures: CodeStructure[]): CodeStructure[] {
  if (structures.length === 0) return [];

  const merged: CodeStructure[] = [];
  let current: CodeStructure | null = null;

  for (const struct of structures) {
    const size = countNonWhitespace(struct.content);

    if (!current) {
      current = { ...struct };
      continue;
    }

    const currentSize = countNonWhitespace(current.content);

    // Merge if both are small and combined is under target
    if (currentSize < MIN_CHUNK_SIZE && size < MIN_CHUNK_SIZE &&
        currentSize + size < TARGET_CHUNK_SIZE) {
      current = {
        ...current,
        endLine: struct.endLine,
        content: current.content + '\n\n' + struct.content,
        name: `${current.name}, ${struct.name}`
      };
    } else {
      if (currentSize >= MIN_CHUNK_SIZE) {
        merged.push(current);
      }
      current = { ...struct };
    }
  }

  if (current && countNonWhitespace(current.content) >= MIN_CHUNK_SIZE) {
    merged.push(current);
  }

  return merged;
}

/**
 * Split large structures while preserving some context
 */
function splitLargeStructure(structure: CodeStructure, language: string): CodeStructure[] {
  const size = countNonWhitespace(structure.content);
  if (size <= MAX_CHUNK_SIZE) return [structure];

  const chunks: CodeStructure[] = [];
  const lines = structure.content.split('\n');

  // Try to split at method/function boundaries within a class
  if (structure.type === 'class') {
    const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
    let currentChunk: string[] = [];
    let currentStart = 0;
    let partNum = 1;

    for (let i = 0; i < lines.length; i++) {
      currentChunk.push(lines[i]);
      const chunkContent = currentChunk.join('\n');
      const chunkSize = countNonWhitespace(chunkContent);

      // Check if next line starts a method
      const nextLine = lines[i + 1]?.trim() || '';
      const isMethodBoundary = patterns.method.test(nextLine);

      if (chunkSize >= TARGET_CHUNK_SIZE && (isMethodBoundary || i === lines.length - 1)) {
        chunks.push({
          ...structure,
          name: `${structure.name} (Part ${partNum})`,
          startLine: structure.startLine + currentStart,
          endLine: structure.startLine + i,
          content: chunkContent
        });
        currentChunk = [];
        currentStart = i + 1;
        partNum++;
      }
    }

    if (currentChunk.length > 0) {
      const content = currentChunk.join('\n');
      if (countNonWhitespace(content) >= MIN_CHUNK_SIZE) {
        chunks.push({
          ...structure,
          name: `${structure.name} (Part ${partNum})`,
          startLine: structure.startLine + currentStart,
          endLine: structure.startLine + lines.length - 1,
          content
        });
      }
    }

    return chunks.length > 0 ? chunks : [structure];
  }

  // For non-classes, split by lines
  let currentChunk: string[] = [];
  let currentStart = 0;
  let partNum = 1;

  for (let i = 0; i < lines.length; i++) {
    currentChunk.push(lines[i]);
    const chunkSize = countNonWhitespace(currentChunk.join('\n'));

    if (chunkSize >= TARGET_CHUNK_SIZE) {
      chunks.push({
        ...structure,
        name: `${structure.name} (Part ${partNum})`,
        startLine: structure.startLine + currentStart,
        endLine: structure.startLine + i,
        content: currentChunk.join('\n')
      });
      currentChunk = [];
      currentStart = i + 1;
      partNum++;
    }
  }

  if (currentChunk.length > 0) {
    const content = currentChunk.join('\n');
    if (countNonWhitespace(content) >= MIN_CHUNK_SIZE) {
      chunks.push({
        ...structure,
        name: `${structure.name} (Part ${partNum})`,
        startLine: structure.startLine + currentStart,
        endLine: structure.startLine + lines.length - 1,
        content
      });
    }
  }

  return chunks.length > 0 ? chunks : [structure];
}

/**
 * Main AST chunking function
 * Converts code into semantically meaningful chunks
 */
export function chunkCodeWithAST(chunk: DocumentChunk): DocumentChunk[] {
  const language = detectLanguage(chunk.content, chunk.metadata.codeLanguage);
  const structures = extractStructures(chunk.content, language);

  // Merge small structures
  const merged = mergeSmallStructures(structures);

  // Split large structures
  const chunks: DocumentChunk[] = [];
  for (const struct of merged) {
    const splitStructs = splitLargeStructure(struct, language);

    for (const s of splitStructs) {
      chunks.push({
        ...chunk,
        id: randomUUID(),
        section: s.name !== 'imports' ? `${chunk.section} - ${s.name}` : chunk.section,
        content: s.content,
        metadata: {
          ...chunk.metadata,
          // Add structure metadata for better retrieval
          className: s.className || (s.type === 'class' ? s.name : undefined),
          functionName: s.type === 'function' ? s.name : undefined,
          methodName: s.type === 'method' ? s.name : undefined,
          typeName: s.type === 'type' || s.type === 'interface' ? s.name : undefined
        }
      });
    }
  }

  // If no structures found, return original chunk
  if (chunks.length === 0) {
    return [chunk];
  }

  return chunks;
}

/**
 * Check if content appears to be code worth AST parsing
 */
export function shouldUseASTChunking(content: string): boolean {
  const lines = content.split('\n');
  const codeIndicators = [
    /^(import|export|const|let|var|function|class|interface|type|def|fn|func)\s/,
    /\{[\s\S]*\}/,
    /\([^)]*\)\s*(=>|{)/,
    /(public|private|protected)\s+/
  ];

  let codeLineCount = 0;
  for (const line of lines) {
    if (codeIndicators.some(p => p.test(line.trim()))) {
      codeLineCount++;
    }
  }

  // Consider it code if >30% of lines look like code
  return codeLineCount / lines.length > 0.3;
}
