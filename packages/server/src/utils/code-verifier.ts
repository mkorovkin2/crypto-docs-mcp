/**
 * Code Verifier Module
 *
 * Validates generated code for common issues without requiring
 * external parser dependencies. Uses heuristic-based detection.
 *
 * Checks for:
 * - Mismatched braces/brackets/parentheses
 * - Unterminated strings
 * - Placeholder code (...)
 * - Missing imports for used identifiers
 * - Incomplete function bodies
 */

export interface VerificationResult {
  /** Whether the code appears syntactically valid */
  valid: boolean;
  /** Critical errors that likely break the code */
  errors: string[];
  /** Potential issues that may cause problems */
  warnings: string[];
  /** Detected code language */
  language: string;
}

export interface CodeBlock {
  code: string;
  language: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract code blocks from markdown text
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'unknown',
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return blocks;
}

/**
 * Verify a single code block for common issues
 */
export function verifyCode(code: string, language: string): VerificationResult {
  const result: VerificationResult = {
    valid: true,
    errors: [],
    warnings: [],
    language: language.toLowerCase()
  };

  // Skip verification for non-code languages
  const codeLanguages = ['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx', 'rust', 'go', 'python', 'py'];
  if (!codeLanguages.includes(result.language)) {
    return result;
  }

  // Check for placeholder code
  checkForPlaceholders(code, result);

  // Check brace matching
  checkBraceMatching(code, result);

  // Check string termination
  checkStringTermination(code, result);

  // Check for common patterns indicating incomplete code
  checkForIncompleteCode(code, result);

  // Check imports vs usage (for JS/TS)
  if (['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(result.language)) {
    checkImportsVsUsage(code, result);
  }

  // Set overall validity
  result.valid = result.errors.length === 0;

  return result;
}

/**
 * Check for placeholder patterns
 */
function checkForPlaceholders(code: string, result: VerificationResult): void {
  const placeholderPatterns = [
    /\.\.\./g,                          // Spread operator misuse as placeholder
    /\/\/\s*TODO/gi,                    // TODO comments
    /\/\*\s*\.\.\.\s*\*\//g,            // Comment placeholders
    /['"]\.\.\.['"]|['"]\s*\.\.\.\s*['"]/, // String placeholders
    /\{\s*\/\*.*?\*\/\s*\}/g,           // Empty blocks with comments
    /\/\/\s*your\s+code\s+here/gi,      // Common placeholder
    /\/\/\s*implement/gi,               // Implementation placeholder
    /throw\s+new\s+Error\s*\(\s*['"]not\s+implemented/gi
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(code)) {
      result.warnings.push('Code contains placeholder or TODO - may need completion');
      break;
    }
  }
}

/**
 * Check for matching braces, brackets, and parentheses
 */
function checkBraceMatching(code: string, result: VerificationResult): void {
  // Remove strings and comments to avoid false positives
  const codeWithoutStrings = removeStringsAndComments(code);

  const pairs: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')'
  };

  const stack: string[] = [];

  for (const char of codeWithoutStrings) {
    if (char in pairs) {
      stack.push(pairs[char]);
    } else if (Object.values(pairs).includes(char)) {
      if (stack.length === 0 || stack.pop() !== char) {
        result.errors.push(`Mismatched bracket: unexpected '${char}'`);
        return;
      }
    }
  }

  if (stack.length > 0) {
    result.errors.push(`Mismatched brackets: missing closing '${stack[stack.length - 1]}'`);
  }
}

/**
 * Check for unterminated strings
 */
function checkStringTermination(code: string, result: VerificationResult): void {
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Template literals can span multiple lines
    if (inString && stringChar !== '`') {
      result.warnings.push(`Potential unterminated string on line ${i + 1}`);
    }
  }
}

/**
 * Check for patterns that indicate incomplete code
 */
function checkForIncompleteCode(code: string, result: VerificationResult): void {
  // Empty function bodies
  if (/function\s+\w+\s*\([^)]*\)\s*\{\s*\}/.test(code)) {
    result.warnings.push('Empty function body detected');
  }

  // Arrow functions with no body
  if (/=>\s*;/.test(code) || /=>\s*$/.test(code)) {
    result.warnings.push('Arrow function may be missing body');
  }

  // Async without await
  if (/async\s+/.test(code) && !/await\s+/.test(code)) {
    result.warnings.push('Async function without await - may be incomplete');
  }

  // Export without definition
  if (/export\s+(const|let|var|function|class)\s+\w+\s*;/.test(code)) {
    result.warnings.push('Export statement may be incomplete');
  }

  // Type annotations with any
  if (/:\s*any\b/.test(code)) {
    result.warnings.push('Uses "any" type - consider adding specific types');
  }
}

/**
 * Check if imported modules are actually used
 */
function checkImportsVsUsage(code: string, result: VerificationResult): void {
  // Extract imports
  const importPattern = /import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from/g;
  const imports = new Set<string>();

  let match;
  while ((match = importPattern.exec(code)) !== null) {
    if (match[1]) {
      // Named imports: { a, b, c }
      match[1].split(',').forEach(name => {
        const cleaned = name.trim().split(/\s+as\s+/).pop()?.trim();
        if (cleaned) imports.add(cleaned);
      });
    } else if (match[2]) {
      // Namespace import: * as name
      imports.add(match[2]);
    } else if (match[3]) {
      // Default import
      imports.add(match[3]);
    }
  }

  // Check usage (simple heuristic - look for identifier usage)
  const codeWithoutImports = code.replace(/import\s+[\s\S]+?from\s+['"][^'"]+['"];?\n?/g, '');

  for (const imp of imports) {
    // Check if the import is used anywhere in the code
    const usagePattern = new RegExp(`\\b${imp}\\b`);
    if (!usagePattern.test(codeWithoutImports)) {
      result.warnings.push(`Import '${imp}' may be unused`);
    }
  }

  // Check for used but not imported identifiers (common ones)
  const commonIdentifiers = [
    'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', // React
    'console', 'process', 'Buffer', // Node.js globals (OK to use)
    'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', // Built-ins
    'JSON', 'Math', 'Date', 'Error', 'Map', 'Set', 'Symbol' // More built-ins
  ];

  const identifierPattern = /\b([A-Z][a-zA-Z0-9]*)\s*[.(]/g;
  while ((match = identifierPattern.exec(codeWithoutImports)) !== null) {
    const identifier = match[1];
    if (!imports.has(identifier) &&
        !commonIdentifiers.includes(identifier) &&
        !code.includes(`class ${identifier}`) &&
        !code.includes(`function ${identifier}`) &&
        !code.includes(`const ${identifier}`) &&
        !code.includes(`interface ${identifier}`) &&
        !code.includes(`type ${identifier}`)) {
      // This might be a missing import
      result.warnings.push(`'${identifier}' is used but may not be imported`);
    }
  }
}

/**
 * Remove string literals and comments from code for analysis
 */
function removeStringsAndComments(code: string): string {
  // Remove single-line comments
  let result = code.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove string literals (simplified - doesn't handle all edge cases)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, '``');

  return result;
}

/**
 * Verify all code blocks in a markdown response
 */
export function verifyResponseCode(response: string): {
  allValid: boolean;
  results: Array<{
    language: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  summary: string;
} {
  const blocks = extractCodeBlocks(response);

  if (blocks.length === 0) {
    return {
      allValid: true,
      results: [],
      summary: 'No code blocks found'
    };
  }

  const results = blocks.map(block => {
    const verification = verifyCode(block.code, block.language);
    return {
      language: block.language,
      valid: verification.valid,
      errors: verification.errors,
      warnings: verification.warnings
    };
  });

  const allValid = results.every(r => r.valid);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  let summary: string;
  if (allValid && totalWarnings === 0) {
    summary = `${blocks.length} code block(s) verified - no issues found`;
  } else if (allValid) {
    summary = `${blocks.length} code block(s) verified - ${totalWarnings} warning(s)`;
  } else {
    summary = `${blocks.length} code block(s) - ${totalErrors} error(s), ${totalWarnings} warning(s)`;
  }

  return { allValid, results, summary };
}

/**
 * Get a simple verification summary for the response builder
 */
export function getVerificationSummary(response: string): {
  hasIssues: boolean;
  message: string;
} {
  const { allValid, results, summary } = verifyResponseCode(response);

  if (results.length === 0) {
    return { hasIssues: false, message: '' };
  }

  const errors = results.flatMap(r => r.errors);
  const warnings = results.flatMap(r => r.warnings);

  if (errors.length > 0) {
    return {
      hasIssues: true,
      message: `Code may have syntax issues: ${errors[0]}`
    };
  }

  if (warnings.length > 0) {
    return {
      hasIssues: true,
      message: `Code warning: ${warnings[0]}`
    };
  }

  return { hasIssues: false, message: summary };
}
