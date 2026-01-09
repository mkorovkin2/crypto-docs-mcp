import { z } from 'zod';
import type { ToolContext } from './index.js';

export const ValidateZkAppCodeSchema = z.object({
  code: z.string().describe('TypeScript/o1js code to validate'),
  checkLevel: z.enum(['errors', 'warnings', 'all']).optional().default('all')
    .describe('What to check: "errors" (critical issues only), "warnings" (potential problems), "all" (comprehensive)')
});

type ValidateZkAppCodeArgs = z.infer<typeof ValidateZkAppCodeSchema>;

interface ValidationIssue {
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  line?: number;
  fix?: string;
  documentation?: string;
}

// Validation rules
const VALIDATION_RULES: Array<{
  name: string;
  pattern: RegExp;
  check: (match: RegExpMatchArray, code: string, lines: string[]) => ValidationIssue | null;
}> = [
  // ERRORS - Code that will break
  {
    name: 'if-else-in-method',
    pattern: /@method[\s\S]*?(?:async\s+)?(\w+)\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\s*\}/g,
    check: (match, code, lines) => {
      const methodBody = match[2];
      // Look for if/else but not Provable.if
      const ifMatch = methodBody.match(/(?<!Provable\.)\bif\s*\(/);
      if (ifMatch) {
        return {
          severity: 'error',
          message: 'Using JavaScript if/else inside @method. Circuit constraints must be deterministic.',
          fix: `Use Provable.if(condition, valueIfTrue, valueIfFalse) instead of if/else`,
          documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#conditional-logic'
        };
      }
      return null;
    }
  },
  {
    name: 'regular-if-statement',
    pattern: /(?<!Provable\.)\bif\s*\(\s*([\w.]+)\s*[=!<>]/g,
    check: (match, code, lines) => {
      // Check if this is inside a @method (look backwards for @method)
      const matchIndex = code.indexOf(match[0]);
      const beforeMatch = code.slice(0, matchIndex);
      const lastMethod = beforeMatch.lastIndexOf('@method');
      const lastBrace = beforeMatch.lastIndexOf('}');

      // If @method appears after last closing brace, we're in a method
      if (lastMethod > lastBrace) {
        // Check if comparing provable types
        const varName = match[1];
        if (/Field|Bool|UInt|PublicKey/.test(varName) || varName.includes('.')) {
          return {
            severity: 'error',
            message: `Conditional on provable type "${varName}" must use Provable.if()`,
            fix: `const result = Provable.if(${varName}.equals(expected), trueValue, falseValue);`,
            documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#conditional-logic'
          };
        }
      }
      return null;
    }
  },
  {
    name: 'non-provable-loop',
    pattern: /(?:for|while)\s*\([^)]*\.(length|size|toBigInt|toNumber|toString)\s*[;)]/g,
    check: (match, code) => {
      return {
        severity: 'error',
        message: 'Loop with dynamic bound not allowed in circuits. Loops must have constant bounds.',
        fix: 'Use a fixed loop bound: for (let i = 0; i < CONSTANT_SIZE; i++)',
        documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#loops'
      };
    }
  },
  {
    name: 'array-methods-in-circuit',
    pattern: /\.(map|filter|reduce|forEach|find|some|every)\s*\(/g,
    check: (match, code) => {
      const matchIndex = code.indexOf(match[0]);
      const beforeMatch = code.slice(0, matchIndex);
      const lastMethod = beforeMatch.lastIndexOf('@method');
      const lastBrace = beforeMatch.lastIndexOf('}');

      if (lastMethod > lastBrace) {
        return {
          severity: 'error',
          message: `Array method "${match[0].slice(1, -1)}" is not provable. Use explicit loops with constant bounds.`,
          fix: 'for (let i = 0; i < FIXED_LENGTH; i++) { ... }',
          documentation: 'https://docs.minaprotocol.com/zkapps/o1js/basic-concepts#loops'
        };
      }
      return null;
    }
  },
  {
    name: 'math-random',
    pattern: /Math\.random\s*\(/g,
    check: () => ({
      severity: 'error',
      message: 'Math.random() is non-deterministic and cannot be used in circuits.',
      fix: 'Use a deterministic source of randomness or derive from inputs'
    })
  },
  {
    name: 'date-now',
    pattern: /Date\.now\s*\(|new\s+Date\s*\(/g,
    check: () => ({
      severity: 'error',
      message: 'Date/time functions are non-deterministic. Use network.blockchainLength for time-based logic.',
      fix: 'this.network.blockchainLength.requireEquals(...)'
    })
  },
  {
    name: 'state-no-get',
    pattern: /this\.(\w+)(?!\.get|\.set|\.getAndRequireEquals|\.requireEquals|\.requireNothing)/g,
    check: (match, code) => {
      // Check if it looks like state access without .get()
      const varName = match[1];
      const fullMatch = match[0];

      // Skip if it's followed by common state methods
      const afterMatch = code.slice(code.indexOf(fullMatch) + fullMatch.length, code.indexOf(fullMatch) + fullMatch.length + 30);
      if (/^\s*[.=\[]/.test(afterMatch) === false) {
        return null;
      }

      // Look for @state declaration of this variable
      const statePattern = new RegExp(`@state\\([^)]+\\)\\s+${varName}\\s*=`);
      if (statePattern.test(code)) {
        if (!/\.get\(|\.getAndRequireEquals\(/.test(afterMatch)) {
          return {
            severity: 'error',
            message: `State "${varName}" accessed without .get(). State values must be read with .get() or .getAndRequireEquals()`,
            fix: `this.${varName}.get() or this.${varName}.getAndRequireEquals()`
          };
        }
      }
      return null;
    }
  },
  {
    name: 'missing-init-super',
    pattern: /init\s*\(\s*\)\s*\{([^}]*)\}/g,
    check: (match) => {
      const body = match[1];
      if (!body.includes('super.init()')) {
        return {
          severity: 'error',
          message: 'init() must call super.init() first',
          fix: `init() { super.init(); /* then set initial state */ }`
        };
      }
      return null;
    }
  },
  {
    name: 'missing-state-init',
    pattern: /@state\([^)]+\)\s+(\w+)/g,
    check: (match, code) => {
      const stateName = match[1];
      // Check if there's an init() that sets this state
      const initMatch = code.match(/init\s*\(\s*\)\s*\{([^}]*)\}/);
      if (initMatch) {
        if (!initMatch[1].includes(`${stateName}.set`)) {
          return {
            severity: 'warning',
            message: `State "${stateName}" may not be initialized in init()`,
            fix: `this.${stateName}.set(initialValue) in init()`,
            documentation: 'https://docs.minaprotocol.com/zkapps/o1js/smart-contracts#init'
          };
        }
      }
      return null;
    }
  },

  // WARNINGS - Potential issues
  {
    name: 'missing-await-prove',
    pattern: /tx\.prove\s*\(\s*\)(?!\s*;?\s*\n?\s*await)/g,
    check: () => ({
      severity: 'warning',
      message: 'tx.prove() should be awaited',
      fix: 'await tx.prove();'
    })
  },
  {
    name: 'missing-await-send',
    pattern: /\.send\s*\(\s*\)(?!\s*;?\s*\n?\s*await)/g,
    check: () => ({
      severity: 'warning',
      message: '.send() should be awaited',
      fix: 'await tx.sign([...]).send();'
    })
  },
  {
    name: 'missing-compile',
    pattern: /zkApp\.deploy\s*\(/g,
    check: (match, code) => {
      if (!code.includes('.compile()')) {
        return {
          severity: 'warning',
          message: 'Contract should be compiled before deployment',
          fix: 'await MyContract.compile(); // Call before deploy'
        };
      }
      return null;
    }
  },
  {
    name: 'direct-bigint-comparison',
    pattern: /\.toBigInt\s*\(\s*\)\s*[<>=!]+/g,
    check: () => ({
      severity: 'warning',
      message: 'Comparing .toBigInt() result outside circuit. This comparison is not constrained.',
      fix: 'Use .greaterThan(), .lessThan(), .equals() for provable comparisons'
    })
  },
  {
    name: 'no-fund-new-account',
    pattern: /zkApp\.deploy|new\s+\w+\s*\([^)]*PublicKey/g,
    check: (match, code) => {
      if (!code.includes('fundNewAccount')) {
        return {
          severity: 'warning',
          message: 'Deploying contract or creating new account may need AccountUpdate.fundNewAccount()',
          fix: 'AccountUpdate.fundNewAccount(sender); // Inside transaction'
        };
      }
      return null;
    }
  },
  {
    name: 'unconstrained-witness',
    pattern: /Provable\.witness\s*\([^)]+,\s*\(\)\s*=>\s*\{?[^}]*\}?\s*\)/g,
    check: (match, code) => {
      // Check if the witness is followed by an assertion
      const matchEnd = code.indexOf(match[0]) + match[0].length;
      const after = code.slice(matchEnd, matchEnd + 200);
      if (!/(assertEquals|assertTrue|assertFalse|assert)/.test(after)) {
        return {
          severity: 'warning',
          message: 'Witness value should be constrained. Add an assertion to verify the witness.',
          fix: 'const w = Provable.witness(Type, () => compute()); w.assertEquals(expected);'
        };
      }
      return null;
    }
  },

  // SUGGESTIONS - Best practices
  {
    name: 'prefer-getAndRequireEquals',
    pattern: /this\.(\w+)\.get\(\)/g,
    check: (match, code) => {
      const stateName = match[1];
      // Check if followed by requireEquals
      const matchEnd = code.indexOf(match[0]) + match[0].length;
      const after = code.slice(matchEnd, matchEnd + 100);
      if (!after.includes('.requireEquals')) {
        return {
          severity: 'suggestion',
          message: `Consider using .getAndRequireEquals() instead of .get() for state "${stateName}" to ensure state hasn't changed`,
          fix: `this.${stateName}.getAndRequireEquals()`
        };
      }
      return null;
    }
  },
  {
    name: 'missing-fetchAccount',
    pattern: /zkApp\.\w+\s*\(/g,
    check: (match, code) => {
      if (!code.includes('fetchAccount') && !code.includes('LocalBlockchain')) {
        return {
          severity: 'suggestion',
          message: 'When interacting with deployed contracts, call fetchAccount() first to get latest state',
          fix: 'await fetchAccount({ publicKey: zkAppAddress });'
        };
      }
      return null;
    }
  },
  {
    name: 'hardcoded-private-key',
    pattern: /PrivateKey\.fromBase58\s*\(\s*["'`][^"'`]+["'`]\s*\)/g,
    check: () => ({
      severity: 'suggestion',
      message: 'Hardcoded private key detected. Use environment variables in production.',
      fix: 'PrivateKey.fromBase58(process.env.PRIVATE_KEY!)'
    })
  },
  {
    name: 'large-state-count',
    pattern: /@state\s*\(/g,
    check: (match, code) => {
      const stateCount = (code.match(/@state\s*\(/g) || []).length;
      if (stateCount > 8) {
        return {
          severity: 'warning',
          message: `${stateCount} @state fields declared. Maximum is 8 fields (each field = 1 Field).`,
          fix: 'Reduce state or use off-chain storage with Merkle roots',
          documentation: 'https://docs.minaprotocol.com/zkapps/o1js/smart-contracts#on-chain-state'
        };
      }
      if (stateCount === 8) {
        return {
          severity: 'suggestion',
          message: 'Using all 8 state fields. Consider reserving some for future upgrades.',
          fix: 'Consider combining related state into Structs'
        };
      }
      return null;
    }
  },
  {
    name: 'missing-method-decorator',
    pattern: /async\s+(\w+)\s*\([^)]*(?:Field|Bool|UInt|PublicKey)[^)]*\)/g,
    check: (match, code) => {
      const methodName = match[1];
      const methodIndex = code.indexOf(match[0]);
      const before = code.slice(Math.max(0, methodIndex - 50), methodIndex);

      // Check if this is in a SmartContract and missing @method
      if (code.includes('extends SmartContract') && !before.includes('@method')) {
        if (methodName !== 'init' && methodName !== 'deploy') {
          return {
            severity: 'warning',
            message: `Method "${methodName}" takes provable types but is missing @method decorator`,
            fix: `@method async ${methodName}(...)`
          };
        }
      }
      return null;
    }
  }
];

// Additional pattern checks for common mistakes
const QUICK_CHECKS: Array<{
  pattern: RegExp;
  issue: ValidationIssue;
}> = [
  {
    pattern: /console\.log\s*\(/,
    issue: {
      severity: 'suggestion',
      message: 'console.log does not work in circuits. Use Provable.log() for debugging during proof generation.',
      fix: 'Provable.log("message:", value);'
    }
  },
  {
    pattern: /throw\s+new\s+Error/,
    issue: {
      severity: 'warning',
      message: 'throw Error does not work in circuits. Use assertions that cause proof failure.',
      fix: 'someCondition.assertTrue("error message");'
    }
  },
  {
    pattern: /JSON\.parse|JSON\.stringify/,
    issue: {
      severity: 'warning',
      message: 'JSON methods are not provable. Use Struct.toJSON/fromJSON outside circuits.',
      fix: 'Define proper serialization using Struct methods'
    }
  },
  {
    pattern: /async\s*\*|yield\s/,
    issue: {
      severity: 'error',
      message: 'Generators are not supported in circuits.',
      fix: 'Use regular async functions instead'
    }
  },
  {
    pattern: /\beval\s*\(/,
    issue: {
      severity: 'error',
      message: 'eval() is not allowed and cannot be proven.',
      fix: 'Remove eval and use static code'
    }
  }
];

export async function validateZkAppCode(
  args: ValidateZkAppCodeArgs,
  context: ToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { code, checkLevel } = args;
  const issues: ValidationIssue[] = [];
  const lines = code.split('\n');

  // Run quick checks
  for (const check of QUICK_CHECKS) {
    if (check.pattern.test(code)) {
      if (checkLevel === 'all' ||
          (checkLevel === 'errors' && check.issue.severity === 'error') ||
          (checkLevel === 'warnings' && check.issue.severity !== 'suggestion')) {
        issues.push(check.issue);
      }
    }
  }

  // Run detailed validation rules
  for (const rule of VALIDATION_RULES) {
    // Reset lastIndex for global patterns
    rule.pattern.lastIndex = 0;

    let match;
    const seenMessages = new Set<string>();

    while ((match = rule.pattern.exec(code)) !== null) {
      const issue = rule.check(match, code, lines);

      if (issue && !seenMessages.has(issue.message)) {
        seenMessages.add(issue.message);

        if (checkLevel === 'all' ||
            (checkLevel === 'errors' && issue.severity === 'error') ||
            (checkLevel === 'warnings' && issue.severity !== 'suggestion')) {
          issues.push(issue);
        }
      }
    }
  }

  // Build response
  const sections: string[] = ['# zkApp Code Validation', ''];

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const suggestions = issues.filter(i => i.severity === 'suggestion');

  // Summary
  if (issues.length === 0) {
    sections.push(
      '## Result: ✓ No issues found',
      '',
      'The code passes all validation checks.',
      '',
      '**Note:** This validates common patterns but cannot guarantee correctness.',
      'Always test with `Provable.runAndCheck()` and on LocalBlockchain.'
    );
  } else {
    sections.push(
      `## Summary`,
      '',
      `- **Errors:** ${errors.length}`,
      `- **Warnings:** ${warnings.length}`,
      `- **Suggestions:** ${suggestions.length}`,
      ''
    );

    if (errors.length > 0) {
      sections.push('## ❌ Errors (Must Fix)', '');
      for (const error of errors) {
        sections.push(`### ${error.message}`);
        if (error.fix) {
          sections.push('', '**Fix:**', '```typescript', error.fix, '```');
        }
        if (error.documentation) {
          sections.push('', `📖 [Documentation](${error.documentation})`);
        }
        sections.push('');
      }
    }

    if (warnings.length > 0 && checkLevel !== 'errors') {
      sections.push('## ⚠️ Warnings (Should Fix)', '');
      for (const warning of warnings) {
        sections.push(`### ${warning.message}`);
        if (warning.fix) {
          sections.push('', '**Fix:**', '```typescript', warning.fix, '```');
        }
        if (warning.documentation) {
          sections.push('', `📖 [Documentation](${warning.documentation})`);
        }
        sections.push('');
      }
    }

    if (suggestions.length > 0 && checkLevel === 'all') {
      sections.push('## 💡 Suggestions (Consider)', '');
      for (const suggestion of suggestions) {
        sections.push(`- **${suggestion.message}**`);
        if (suggestion.fix) {
          sections.push(`  Fix: \`${suggestion.fix}\``);
        }
      }
      sections.push('');
    }
  }

  sections.push(
    '---',
    '',
    '**Next steps:**',
    '- Test with `Provable.runAndCheck()` to verify constraints',
    '- Deploy to LocalBlockchain before testnet',
    '- Use `Provable.log()` for debugging circuit execution'
  );

  return {
    content: [{ type: 'text', text: sections.join('\n') }]
  };
}
