/**
 * Quality Assessor Module
 *
 * Evaluates code files for indexing worthiness through:
 * 1. Documentation score - presence of README, JSDoc, comments
 * 2. LLM relevance score - whether this is a useful example
 */

import OpenAI from 'openai';

export interface DocumentationScore {
  score: number; // 0-100
  hasReadme: boolean;
  hasJsDoc: boolean;
  hasInlineComments: boolean;
  commentDensity: number; // comments per line of code
}

export interface LLMRelevanceResult {
  score: number; // 0-100
  isUsefulExample: boolean;
  exampleDescription: string; // What this code demonstrates
  prerequisites: string[]; // Inferred prerequisites
  versionHint: string | null; // Inferred version compatibility
  reasoning: string; // Why this score
}

/**
 * Assess documentation quality of a code file
 */
export function assessDocumentation(
  content: string,
  readmeContent: string | null,
  language: string
): DocumentationScore {
  const lines = content.split('\n');
  const codeLines = lines.filter(l => l.trim() && !isComment(l, language)).length;
  const commentLines = lines.filter(l => isComment(l, language)).length;

  const hasJsDoc = /\/\*\*[\s\S]*?\*\//.test(content);
  const hasRustDoc = /\/\/\/.*/.test(content);
  const hasGoDoc = /\/\/\s+\w+\s+/.test(content); // Go doc comments
  const hasInlineComments = commentLines > 0;
  const commentDensity = codeLines > 0 ? commentLines / codeLines : 0;

  let score = 0;

  // README presence is a strong signal
  if (readmeContent) {
    score += 40;
  }

  // Language-specific doc comments
  if (hasJsDoc || hasRustDoc || hasGoDoc) {
    score += 30;
  }

  // Comment density scoring
  if (commentDensity > 0.05) score += 10;
  if (commentDensity > 0.1) score += 10;
  if (commentDensity > 0.2) score += 10;

  return {
    score: Math.min(100, score),
    hasReadme: !!readmeContent,
    hasJsDoc: hasJsDoc || hasRustDoc || hasGoDoc,
    hasInlineComments,
    commentDensity,
  };
}

/**
 * Check if a line is a comment based on language
 */
function isComment(line: string, language: string): boolean {
  const trimmed = line.trim();

  if (language === 'typescript' || language === 'javascript') {
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  }
  if (language === 'rust') {
    return trimmed.startsWith('//') || trimmed.startsWith('///') || trimmed.startsWith('//!');
  }
  if (language === 'go') {
    return trimmed.startsWith('//');
  }
  if (language === 'python') {
    return trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''");
  }

  // Default: check common comment patterns
  return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*');
}

/**
 * Use LLM to assess if code is a useful, index-worthy example
 */
export async function assessLLMRelevance(
  content: string,
  filePath: string,
  readmeContext: string | null,
  projectName: string,
  openaiApiKey: string
): Promise<LLMRelevanceResult> {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Truncate content to avoid token limits
  const truncatedContent = content.length > 4000 ? content.slice(0, 4000) + '\n... [truncated]' : content;
  const truncatedReadme = readmeContext && readmeContext.length > 1500
    ? readmeContext.slice(0, 1500) + '\n... [truncated]'
    : readmeContext;

  const prompt = `You are evaluating whether a code file should be indexed as a useful example for developers learning ${projectName}.

File: ${filePath}
${truncatedReadme ? `\nREADME context:\n${truncatedReadme}\n` : ''}
Code:
\`\`\`
${truncatedContent}
\`\`\`

Evaluate this code and respond with JSON only (no markdown):
{
  "score": <0-100, where 100 is extremely useful example>,
  "isUsefulExample": <true if this demonstrates a concept developers would want to learn>,
  "exampleDescription": "<1-2 sentence description of what this code demonstrates, or 'N/A' if not useful>",
  "prerequisites": ["<prerequisite 1>", "<prerequisite 2>"],
  "versionHint": "<inferred version like 'o1js@>=0.15.0' based on imports/syntax, or null if unknown>",
  "reasoning": "<brief explanation of your score>"
}

Scoring guidelines:
- 80-100: Complete, well-documented example that teaches a clear concept (standalone demos, tutorials with comments, real use cases)
- 60-79: Useful example but may lack context or documentation (working code with some explanation)
- 40-59: Partially useful, might help as reference but not standalone (utility with good comments)
- 20-39: Internal implementation code, not educational (SDK internals, helpers)
- 0-19: Boilerplate, config files, tests, benchmarks, or completely irrelevant

IMPORTANT - Score LOW (below 40) for:
- Benchmark/performance test files (measuring speed, not teaching concepts)
- Internal utilities that aren't meant to be used directly by developers
- Files that just re-export or aggregate other modules
- Code without any explanation of what it demonstrates
- Files in benchmark/, perf/, or similar directories

Be strict. Most internal SDK code should score below 40. Only give high scores to code that would genuinely help a developer learn a concept or pattern.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = response.choices[0].message.content || '{}';

    // Try to parse JSON, handling potential markdown code blocks
    let jsonText = responseText;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const result = JSON.parse(jsonText);

    return {
      score: typeof result.score === 'number' ? result.score : 0,
      isUsefulExample: result.isUsefulExample === true,
      exampleDescription: result.exampleDescription || 'N/A',
      prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites : [],
      versionHint: result.versionHint || null,
      reasoning: result.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('LLM relevance assessment failed:', error);
    return {
      score: 0,
      isUsefulExample: false,
      exampleDescription: 'Assessment failed',
      prerequisites: [],
      versionHint: null,
      reasoning: `LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Quick heuristic check before expensive LLM call
 * Returns false if file is obviously not worth indexing
 */
export function quickRelevanceCheck(filePath: string, content: string): { pass: boolean; reason: string } {
  const fileName = filePath.split('/').pop() || '';
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Skip test files
  if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('_test.')) {
    return { pass: false, reason: 'Test file' };
  }

  // Skip benchmark/performance files
  if (lowerPath.includes('/benchmark') || lowerPath.includes('/perf') || lowerPath.includes('benchmark.')) {
    return { pass: false, reason: 'Benchmark/performance file' };
  }

  // Skip config/build files
  const configFiles = ['package.json', 'tsconfig.json', 'cargo.toml', 'go.mod', 'jest.config', 'webpack.config', '.eslintrc', '.prettierrc'];
  if (configFiles.some(cf => lowerPath.endsWith(cf))) {
    return { pass: false, reason: 'Config/build file' };
  }

  // Skip index/barrel files that just re-export
  if (fileName === 'index.ts' || fileName === 'index.js' || fileName === 'mod.rs' || fileName === 'lib.rs') {
    const exportCount = (content.match(/export\s/g) || []).length;
    const totalLines = content.split('\n').filter(l => l.trim()).length;
    if (exportCount > 0 && totalLines < 30) {
      return { pass: false, reason: 'Barrel/index file with only exports' };
    }
  }

  // Skip very short files
  if (content.length < 200) {
    return { pass: false, reason: 'File too short (<200 chars)' };
  }

  // Skip files that are mostly imports
  const lines = content.split('\n').filter(l => l.trim());
  const importLines = lines.filter(l => l.trim().startsWith('import ') || l.trim().startsWith('use ') || l.trim().startsWith('from ')).length;
  if (importLines > lines.length * 0.5 && lines.length < 20) {
    return { pass: false, reason: 'Mostly imports with little code' };
  }

  // Skip generated files
  if (lowerContent.includes('do not edit') || lowerContent.includes('auto-generated') || lowerContent.includes('generated by')) {
    return { pass: false, reason: 'Generated file' };
  }

  return { pass: true, reason: 'Passed quick relevance check' };
}
