import { z } from 'zod';
import type { ToolContext } from './index.js';

export const DebugHelperSchema = z.object({
  error: z.string(),
  context: z.string().optional()
});

type DebugHelperArgs = z.infer<typeof DebugHelperSchema>;

// Common error patterns and solutions
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  solution: string;
}> = [
  {
    pattern: /Field\.assert|assertEquals.*failed|assertion failed/i,
    title: 'Assertion Failed in Circuit',
    solution: `**Cause:** A Field assertion (like \`assertEquals\`, \`assertGreaterThan\`) failed during proof generation.

**Solutions:**
1. Check that your inputs satisfy the constraint
2. Use \`Provable.log()\` to debug values during proof generation:
   \`\`\`typescript
   Provable.log('value:', myField);
   \`\`\`
3. Verify state values match on-chain state with \`requireEquals()\`
4. Check for off-by-one errors in comparisons`
  },
  {
    pattern: /cannot read properties of undefined|undefined is not|null/i,
    title: 'Undefined/Null Value',
    solution: `**Cause:** Accessing a property or method on an undefined value.

**Common causes in o1js:**
1. State not initialized - ensure \`init()\` sets all @state fields
2. Forgot to call \`.get()\` on state: \`this.value.get()\` not \`this.value\`
3. Missing await on async operations
4. Contract not deployed before interaction

**Fix:**
\`\`\`typescript
init() {
  super.init();
  this.myState.set(Field(0)); // Initialize all state
}
\`\`\``
  },
  {
    pattern: /proof verification failed|verify.*failed|invalid proof/i,
    title: 'Proof Verification Failed',
    solution: `**Cause:** The proof doesn't match the expected verification key.

**Common causes:**
1. Contract code changed after deployment - redeploy the contract
2. Using wrong network or contract address
3. State mismatch between local and on-chain values

**Solutions:**
1. Recompile the contract: \`await MyContract.compile()\`
2. Verify you're using the correct contract address
3. Fetch fresh state before proving:
   \`\`\`typescript
   await fetchAccount({ publicKey: contractAddress });
   \`\`\`
4. Check verification key matches deployed contract`
  },
  {
    pattern: /nonce/i,
    title: 'Nonce Error',
    solution: `**Cause:** Transaction nonce is out of sync.

**Solutions:**
1. Wait for pending transactions to confirm before sending new ones
2. Fetch latest account state:
   \`\`\`typescript
   await fetchAccount({ publicKey: senderAddress });
   \`\`\`
3. If using Local Blockchain, ensure you're not reusing accounts incorrectly
4. Check for duplicate transactions in flight`
  },
  {
    pattern: /insufficient.*balance|not enough|balance/i,
    title: 'Insufficient Balance',
    solution: `**Cause:** Account doesn't have enough MINA.

**Required MINA for:**
- Transaction fee: ~0.1 MINA
- Account creation fee: 1 MINA (for new accounts)
- Value transfers: amount being sent

**Solutions:**
1. Fund your account from the faucet (testnet): https://faucet.minaprotocol.com
2. Check balance:
   \`\`\`typescript
   const account = await fetchAccount({ publicKey });
   console.log(account.account?.balance.toString());
   \`\`\``
  },
  {
    pattern: /circuit|constraint|compile/i,
    title: 'Circuit/Constraint Error',
    solution: `**Cause:** Invalid circuit construction.

**Common issues:**
1. **Non-deterministic code**: Circuits must be deterministic
   - Don't use \`Math.random()\` or \`Date.now()\`
   - Don't use variable-length loops

2. **Using non-provable types**: Only provable types in @method
   - Use \`Field\`, \`Bool\`, \`UInt64\`, etc.
   - Not regular \`number\`, \`string\`, \`boolean\`

3. **Conditional branches**: Use \`Provable.if()\` instead of if/else:
   \`\`\`typescript
   // Wrong
   if (condition) { x = a; } else { x = b; }

   // Right
   const x = Provable.if(condition, a, b);
   \`\`\`

4. **Circuit too large**: Split into multiple methods or use recursion`
  },
  {
    pattern: /timeout|took too long|memory/i,
    title: 'Performance/Timeout Issue',
    solution: `**Cause:** Proof generation is taking too long.

**Solutions:**
1. Reduce circuit complexity - fewer constraints = faster proofs
2. Use \`LocalBlockchain\` for testing (faster than real network)
3. Compile once and reuse:
   \`\`\`typescript
   // Compile once at startup
   const { verificationKey } = await MyContract.compile();
   // Reuse for all transactions
   \`\`\`
4. Consider splitting into multiple transactions
5. For large computations, use recursive proofs`
  },
  {
    pattern: /deploy|deployment/i,
    title: 'Deployment Issue',
    solution: `**Deployment checklist:**

1. **Compile first:**
   \`\`\`typescript
   await MyContract.compile();
   \`\`\`

2. **Create deploy transaction:**
   \`\`\`typescript
   const tx = await Mina.transaction(sender, async () => {
     AccountUpdate.fundNewAccount(sender);
     await zkApp.deploy();
   });
   await tx.prove();
   await tx.sign([senderKey, zkAppKey]).send();
   \`\`\`

3. **Wait for confirmation:**
   \`\`\`typescript
   await tx.wait();
   \`\`\`

**Common issues:**
- Forgot \`AccountUpdate.fundNewAccount()\` for new contract
- Didn't sign with both sender and zkApp private key
- Network mismatch (devnet vs mainnet)`
  }
];

export async function debugHelper(
  args: DebugHelperArgs,
  context: ToolContext
) {
  // Check for known error patterns
  const matchedPatterns = ERROR_PATTERNS.filter(p => p.pattern.test(args.error));

  // Search documentation for error-related content
  const searchQuery = args.context
    ? `${args.error} ${args.context}`
    : args.error;

  const results = await context.search.search(
    `error troubleshoot ${searchQuery}`,
    { limit: 3 }
  );

  const sections: string[] = [
    `# Debugging: ${args.error.slice(0, 80)}${args.error.length > 80 ? '...' : ''}`,
    ''
  ];

  if (args.context) {
    sections.push(`**Context:** ${args.context}`, '');
  }

  // Add matched pattern solutions
  if (matchedPatterns.length > 0) {
    for (const pattern of matchedPatterns) {
      sections.push(
        `## ${pattern.title}`,
        '',
        pattern.solution,
        ''
      );
    }
  }

  // Add relevant documentation
  if (results.length > 0) {
    sections.push(
      '## Related Documentation',
      ''
    );

    for (const result of results) {
      const preview = result.chunk.content.slice(0, 300) +
        (result.chunk.content.length > 300 ? '...' : '');

      sections.push(
        `### ${result.chunk.title} - ${result.chunk.section}`,
        '',
        preview,
        '',
        `[Read more](${result.chunk.url})`,
        ''
      );
    }
  }

  // Add general debugging tips if no specific matches
  if (matchedPatterns.length === 0) {
    sections.push(
      '## General Debugging Tips',
      '',
      '1. **Use Provable.log()** for circuit debugging:',
      '   ```typescript',
      '   Provable.log("value:", myField);',
      '   ```',
      '',
      '2. **Test locally first** with LocalBlockchain:',
      '   ```typescript',
      '   const Local = await Mina.LocalBlockchain();',
      '   Mina.setActiveInstance(Local);',
      '   ```',
      '',
      '3. **Check state synchronization**:',
      '   ```typescript',
      '   await fetchAccount({ publicKey: contractAddress });',
      '   ```',
      '',
      '4. **Verify compilation** before deployment:',
      '   ```typescript',
      '   await MyContract.compile();',
      '   ```',
      ''
    );
  }

  sections.push(
    '## Need More Help?',
    '',
    '- [Mina Discord #zkapps-developers](https://discord.gg/minaprotocol)',
    '- [o1js GitHub Issues](https://github.com/o1-labs/o1js/issues)',
    '- [Mina Documentation](https://docs.minaprotocol.com)'
  );

  return {
    content: [{
      type: 'text' as const,
      text: sections.join('\n')
    }]
  };
}
