#!/usr/bin/env node
/**
 * Sanity check for the evaluation suite
 *
 * Tests the LLM judge with known-good and known-bad responses
 * to verify it's making reasonable judgments.
 *
 * Run: npm run sanity-check -w @crypto-docs/evaluator
 */

import { judgeResponseQuality, judgeCodeQuality } from '../dist/validators/llm-judge.js';

const GOOD_RESPONSE = `
A zkApp (zero-knowledge application) is a smart contract on the Mina blockchain that uses
zero-knowledge proofs to verify computations without revealing the underlying data.

Key characteristics:
- **State**: zkApps can store up to 8 Field elements (each 32 bytes) on-chain
- **Privacy**: Computations happen off-chain, only proofs are submitted
- **Verification**: The network verifies proofs, not the computation itself

To create a zkApp, you extend the SmartContract class from o1js:

\`\`\`typescript
import { SmartContract, state, State, method, Field } from 'o1js';

class MyZkApp extends SmartContract {
  @state(Field) value = State<Field>();

  @method async update(newValue: Field) {
    this.value.set(newValue);
  }
}
\`\`\`

Sources: [Mina zkApp Documentation](https://docs.minaprotocol.com/zkapps)
`;

const BAD_RESPONSE = `
A zkApp is similar to an Ethereum smart contract. You can use Solidity to write zkApps
and deploy them using Hardhat. The main difference is that Mina uses proof-of-stake.

To create a zkApp:
1. Install Hardhat
2. Write your Solidity contract
3. Deploy to Mina testnet

The gas fees on Mina are very low compared to Ethereum.
`;

const IRRELEVANT_RESPONSE = `
Blockchain technology has revolutionized the way we think about decentralized systems.
There are many different consensus mechanisms including proof-of-work, proof-of-stake,
and delegated proof-of-stake. Bitcoin was the first cryptocurrency, created by Satoshi
Nakamoto in 2009. Since then, thousands of cryptocurrencies have been created.
`;

const GOOD_CODE = `
Here's how to create a basic zkApp:

\`\`\`typescript
import { SmartContract, state, State, method, Field, Mina, PrivateKey } from 'o1js';

class Counter extends SmartContract {
  @state(Field) count = State<Field>();

  init() {
    super.init();
    this.count.set(Field(0));
  }

  @method async increment() {
    const current = this.count.get();
    this.count.requireEquals(current);
    this.count.set(current.add(1));
  }
}

// Deploy
const zkAppKey = PrivateKey.random();
const zkAppAddress = zkAppKey.toPublicKey();
const zkApp = new Counter(zkAppAddress);

await Counter.compile();
const tx = await Mina.transaction(() => zkApp.deploy());
await tx.prove();
await tx.sign([zkAppKey]).send();
\`\`\`

This creates a simple counter that can be incremented. The state is verified using
zero-knowledge proofs.
`;

const BAD_CODE = `
Here's how to create a zkApp:

\`\`\`javascript
const zkApp = new ZkApp();
zkApp.deploy("mainnet");
zkApp.setState({ count: 0 });
\`\`\`

That's it! Very simple.
`;

async function runSanityChecks() {
  console.log('🧪 Running sanity checks on LLM judge...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set. Cannot run sanity checks.');
    process.exit(1);
  }

  const results = [];

  // Test 1: Good response should pass
  console.log('Test 1: Good response to "What is a zkApp?"');
  const good = await judgeResponseQuality(
    'What is a zkApp in Mina?',
    GOOD_RESPONSE,
    'mina'
  );
  results.push({
    name: 'Good response should PASS',
    expected: 'PASS (score >= 70)',
    actual: good.passed ? 'PASS' : 'FAIL',
    passed: good.passed === true,
    score: good.score,
    reasoning: good.reasoning
  });
  console.log(`  Score: ${good.score}/100, Passed: ${good.passed}`);
  console.log(`  Reasoning: ${good.reasoning}\n`);

  // Test 2: Bad response (wrong project info) should fail
  console.log('Test 2: Bad response with wrong project info');
  const bad = await judgeResponseQuality(
    'What is a zkApp in Mina?',
    BAD_RESPONSE,
    'mina'
  );
  results.push({
    name: 'Wrong project info should FAIL',
    expected: 'FAIL (accuracy < 50 or score < 70)',
    actual: bad.passed ? 'PASS' : 'FAIL',
    passed: bad.passed === false,
    score: bad.score,
    reasoning: bad.reasoning
  });
  console.log(`  Score: ${bad.score}/100, Passed: ${bad.passed}`);
  console.log(`  Accuracy: ${bad.accuracy}/100`);
  console.log(`  Reasoning: ${bad.reasoning}\n`);

  // Test 3: Irrelevant response should fail
  console.log('Test 3: Irrelevant response (off-topic)');
  const irrelevant = await judgeResponseQuality(
    'What is a zkApp in Mina?',
    IRRELEVANT_RESPONSE,
    'mina'
  );
  results.push({
    name: 'Irrelevant response should FAIL',
    expected: 'FAIL (relevance < 50)',
    actual: irrelevant.passed ? 'PASS' : 'FAIL',
    passed: irrelevant.passed === false,
    score: irrelevant.score,
    reasoning: irrelevant.reasoning
  });
  console.log(`  Score: ${irrelevant.score}/100, Passed: ${irrelevant.passed}`);
  console.log(`  Relevance: ${irrelevant.relevance}/100`);
  console.log(`  Reasoning: ${irrelevant.reasoning}\n`);

  // Test 4: Good code should pass
  console.log('Test 4: Good code example');
  const goodCode = await judgeCodeQuality(
    'create a basic zkApp smart contract',
    GOOD_CODE,
    'mina'
  );
  results.push({
    name: 'Good code should PASS',
    expected: 'PASS (score >= 70, would run)',
    actual: goodCode.passed ? 'PASS' : 'FAIL',
    passed: goodCode.passed === true,
    score: goodCode.score,
    reasoning: goodCode.reasoning
  });
  console.log(`  Score: ${goodCode.score}/100, Passed: ${goodCode.passed}`);
  console.log(`  Reasoning: ${goodCode.reasoning}\n`);

  // Test 5: Bad code should fail
  console.log('Test 5: Bad/broken code example');
  const badCode = await judgeCodeQuality(
    'create a basic zkApp smart contract',
    BAD_CODE,
    'mina'
  );
  results.push({
    name: 'Bad code should FAIL',
    expected: 'FAIL (accuracy < 60 or would not run)',
    actual: badCode.passed ? 'PASS' : 'FAIL',
    passed: badCode.passed === false,
    score: badCode.score,
    reasoning: badCode.reasoning
  });
  console.log(`  Score: ${badCode.score}/100, Passed: ${badCode.passed}`);
  console.log(`  Accuracy: ${badCode.accuracy}/100`);
  console.log(`  Reasoning: ${badCode.reasoning}\n`);

  // Test 6: Comparison question should allow cross-project mentions
  console.log('Test 6: Comparison question (cross-project mentions OK)');
  const comparison = await judgeResponseQuality(
    'How does Mina compare to Solana?',
    `Mina and Solana are quite different:

**Mina**: Uses zero-knowledge proofs, has a constant 22KB blockchain size, focuses on privacy
and verification. Smart contracts (zkApps) run computations off-chain.

**Solana**: Focuses on high throughput (65,000 TPS), uses proof-of-history consensus,
smart contracts run on-chain using the Solana runtime.

Key differences:
- Mina: Privacy-focused, succinct blockchain
- Solana: Speed-focused, traditional blockchain size`,
    'mina'
  );
  results.push({
    name: 'Comparison should PASS (cross-project OK)',
    expected: 'PASS (mentioning Solana is relevant here)',
    actual: comparison.passed ? 'PASS' : 'FAIL',
    passed: comparison.passed === true,
    score: comparison.score,
    reasoning: comparison.reasoning
  });
  console.log(`  Score: ${comparison.score}/100, Passed: ${comparison.passed}`);
  console.log(`  Relevance: ${comparison.relevance}/100`);
  console.log(`  Reasoning: ${comparison.reasoning}\n`);

  // Summary
  console.log('='.repeat(60));
  console.log('SANITY CHECK SUMMARY');
  console.log('='.repeat(60));

  const allPassed = results.every(r => r.passed);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   Expected: ${r.expected}`);
    console.log(`   Got: ${r.actual} (score: ${r.score})`);
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ All sanity checks passed! The LLM judge appears to be working correctly.');
  } else {
    console.log('❌ Some sanity checks failed. Review the results above.');
    console.log('   This might indicate the LLM judge needs tuning.');
  }
  console.log('='.repeat(60));
}

runSanityChecks().catch(console.error);
