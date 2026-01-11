/**
 * README Context Extractor
 *
 * Extracts relevant context from README files to accompany code examples.
 * Finds README in same or parent directories and extracts relevant sections.
 */

export interface ReadmeContext {
  fullContent: string;
  relevantExcerpt: string; // Most relevant section for the code file
  title: string | null;
  description: string | null;
  dirPath: string; // Where the README was found
}

/**
 * Fetch README from same directory or parent directories
 */
export async function fetchReadmeContext(
  filePath: string,
  fetchFile: (path: string) => Promise<string | null>
): Promise<ReadmeContext | null> {
  const pathParts = filePath.split('/');

  // Try README in same directory, then parent directories (up to 3 levels)
  for (let i = pathParts.length - 1; i >= Math.max(0, pathParts.length - 4); i--) {
    const dirPath = pathParts.slice(0, i).join('/');
    const readmePaths = [
      dirPath ? `${dirPath}/README.md` : 'README.md',
      dirPath ? `${dirPath}/readme.md` : 'readme.md',
      dirPath ? `${dirPath}/README` : 'README',
      dirPath ? `${dirPath}/Readme.md` : 'Readme.md',
    ];

    for (const readmePath of readmePaths) {
      const content = await fetchFile(readmePath);
      if (content) {
        return parseReadme(content, filePath, dirPath);
      }
    }
  }

  return null;
}

/**
 * Parse README content and extract relevant sections
 */
function parseReadme(content: string, targetFilePath: string, dirPath: string): ReadmeContext {
  const fileName = targetFilePath.split('/').pop() || '';
  const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract description (text after title, before next heading or code block)
  const descMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##|\n```|$)/);
  const description = descMatch ? descMatch[1].trim().slice(0, 500) : null;

  // Try to find section mentioning the specific file
  let relevantExcerpt = findRelevantSection(content, fileNameWithoutExt);

  // If no specific section found, use description or beginning of README
  if (!relevantExcerpt) {
    relevantExcerpt = description || extractMeaningfulContent(content);
  }

  return {
    fullContent: content,
    relevantExcerpt: relevantExcerpt.slice(0, 1000),
    title,
    description,
    dirPath,
  };
}

/**
 * Find a section in the README that mentions the target file
 */
function findRelevantSection(content: string, fileName: string): string | null {
  // Look for section headers or paragraphs mentioning the file
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try to find a heading that mentions the file
  const headingRegex = new RegExp(`(#{1,3}[^#\\n]*${escapedFileName}[^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,3}|$)`, 'i');
  const headingMatch = content.match(headingRegex);
  if (headingMatch) {
    return headingMatch[1].slice(0, 800);
  }

  // Try to find a paragraph or list item mentioning the file
  const paragraphRegex = new RegExp(`([^\\n]*${escapedFileName}[^\\n]*(?:\\n[^#\\n]+)*)`, 'i');
  const paragraphMatch = content.match(paragraphRegex);
  if (paragraphMatch) {
    return paragraphMatch[1].slice(0, 500);
  }

  return null;
}

/**
 * Extract meaningful content from README (skip badges, links-only sections)
 */
function extractMeaningfulContent(content: string): string {
  const lines = content.split('\n');
  const meaningfulLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockCount = 0;

  for (const line of lines) {
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock) codeBlockCount++;
      // Include first code block as it's often the main example
      if (codeBlockCount <= 1) {
        meaningfulLines.push(line);
      }
      continue;
    }

    if (inCodeBlock && codeBlockCount <= 1) {
      meaningfulLines.push(line);
      continue;
    }

    // Skip badge lines (images at start)
    if (line.match(/^\s*\[!\[.*\]\(.*\)\]\(.*\)\s*$/)) {
      continue;
    }

    // Skip pure link lines
    if (line.match(/^\s*\[.*\]\(.*\)\s*$/) && !line.includes(' ')) {
      continue;
    }

    // Include meaningful content
    if (line.trim()) {
      meaningfulLines.push(line);
    } else if (meaningfulLines.length > 0) {
      // Keep paragraph breaks
      meaningfulLines.push(line);
    }

    // Stop after getting enough content
    if (meaningfulLines.join('\n').length > 1000) {
      break;
    }
  }

  return meaningfulLines.join('\n').trim();
}

/**
 * Extract usage examples from README
 */
export function extractUsageExamples(content: string): string[] {
  const examples: string[] = [];

  // Find code blocks, preferring those after "Usage", "Example", "Getting Started" headings
  const usageSectionRegex = /#{1,3}\s*(?:Usage|Example|Getting Started|Quick Start)[^\n]*\n([\s\S]*?)(?=\n#{1,3}|$)/gi;

  let match;
  while ((match = usageSectionRegex.exec(content)) !== null) {
    const section = match[1];
    const codeBlocks = section.match(/```[\s\S]*?```/g) || [];
    examples.push(...codeBlocks.map(cb => cb.replace(/```\w*\n?/g, '').trim()));
  }

  // If no examples found in usage sections, grab first code block
  if (examples.length === 0) {
    const firstCodeBlock = content.match(/```[\s\S]*?```/);
    if (firstCodeBlock) {
      examples.push(firstCodeBlock[0].replace(/```\w*\n?/g, '').trim());
    }
  }

  return examples.slice(0, 3); // Limit to 3 examples
}

/**
 * Check if README indicates this is an example/demo project
 */
export function isExampleProject(content: string): boolean {
  const lowerContent = content.toLowerCase();

  const exampleIndicators = [
    'example',
    'demo',
    'tutorial',
    'sample',
    'getting started',
    'quick start',
    'how to',
    'step by step',
    'learn',
    'template',
    'starter',
    'boilerplate',
  ];

  // Check title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (exampleIndicators.some(ind => title.includes(ind))) {
      return true;
    }
  }

  // Check for multiple indicators in content
  const indicatorCount = exampleIndicators.filter(ind => lowerContent.includes(ind)).length;
  return indicatorCount >= 2;
}
