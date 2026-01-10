/**
 * Code quality validators
 */

import type { ValidationResult } from '../types.js';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const validateCode = {
  hasCodeBlock(response: string, language?: string): ValidationResult {
    const codeBlockRegex = language
      ? new RegExp(`\`\`\`${language}[\\s\\S]*?\`\`\``, 'i')
      : /```[\s\S]*?```/;

    const hasBlock = codeBlockRegex.test(response);

    return {
      rule: { type: 'has_code_block', language },
      passed: hasBlock,
      message: hasBlock
        ? `Contains ${language || 'code'} block`
        : `Missing ${language || 'code'} block`
    };
  },

  hasImport(response: string, module: string): ValidationResult {
    // Check for various import patterns across languages
    const patterns = [
      // TypeScript/JavaScript
      new RegExp(`import\\s+.*\\s+from\\s+['"\`]${escapeRegex(module)}['"\`]`, 'i'),
      new RegExp(`import\\s+['"\`]${escapeRegex(module)}['"\`]`, 'i'),
      new RegExp(`require\\s*\\(\\s*['"\`]${escapeRegex(module)}['"\`]\\s*\\)`, 'i'),
      // Rust
      new RegExp(`use\\s+${escapeRegex(module)}`, 'i'),
      // Go
      new RegExp(`import\\s+.*["']${escapeRegex(module)}["']`, 'i'),
    ];

    const found = patterns.some(p => p.test(response));

    return {
      rule: { type: 'has_import', module },
      passed: found,
      message: found
        ? `Found import for "${module}"`
        : `Missing import for "${module}"`
    };
  },

  /**
   * Validate TypeScript/JavaScript syntax (basic checks)
   */
  validateTypeScriptSyntax(code: string): ValidationResult {
    const issues: string[] = [];

    // Check for balanced braces
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    // Check for balanced brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
    }

    return {
      rule: { type: 'matches_regex', pattern: 'typescript-syntax' },
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'TypeScript syntax appears valid'
        : `Syntax issues: ${issues.join('; ')}`,
      details: { issues }
    };
  }
};
