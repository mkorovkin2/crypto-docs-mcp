#!/usr/bin/env npx ts-node --esm
/**
 * Test script for Bedrock/Kimi K2 integration
 *
 * Usage:
 *   npx ts-node --esm scripts/test-bedrock.ts
 *
 * Requires AWS credentials configured (env vars, profile, or IAM role)
 */

import { LLMClient } from '../packages/shared/dist/llm.js';

async function main() {
  console.log('Testing Bedrock with Kimi K2...\n');

  // Check for AWS credentials
  const hasCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_ROLE_ARN
  );

  if (!hasCredentials) {
    console.log('⚠️  No AWS credentials detected in environment.');
    console.log('   Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE\n');
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`AWS Region: ${region}`);
  console.log(`Model: moonshot.kimi-k2-thinking\n`);

  try {
    // Initialize client
    const client = new LLMClient({
      provider: 'bedrock',
      model: 'moonshot.kimi-k2-thinking',
      awsRegion: region,
      maxTokens: 1000,
      temperature: 0.3,
    });

    console.log('✓ LLMClient initialized');
    console.log(`  Provider: ${client.getProvider()}`);
    console.log(`  Model: ${client.getModel()}\n`);

    // Test synthesis
    console.log('Sending test prompt...\n');
    const startTime = Date.now();

    const response = await client.synthesize(
      'You are a helpful assistant. Be concise.',
      'What is 2 + 2? Answer in one sentence.'
    );

    const duration = Date.now() - startTime;

    console.log('─'.repeat(50));
    console.log('Response:');
    console.log(response);
    console.log('─'.repeat(50));
    console.log(`\n✓ Success! (${duration}ms)`);

  } catch (error: any) {
    console.error('\n✗ Error:', error.message);

    if (error.name === 'AccessDeniedException') {
      console.error('\n  Your AWS credentials may not have Bedrock access.');
      console.error('  Ensure the IAM policy includes bedrock:InvokeModel');
    } else if (error.name === 'ResourceNotFoundException') {
      console.error('\n  Model not found. Check if Kimi K2 is available in your region.');
      console.error('  Try enabling the model in AWS Bedrock console.');
    } else if (error.name === 'ValidationException') {
      console.error('\n  Request validation failed. Check model ID format.');
    } else if (error.code === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      console.error('\n  AWS credentials not found. Set one of:');
      console.error('    - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY');
      console.error('    - AWS_PROFILE');
      console.error('    - Run on EC2/Lambda with IAM role');
    }

    if (process.env.DEBUG) {
      console.error('\nFull error:', error);
    }

    process.exit(1);
  }
}

main();
