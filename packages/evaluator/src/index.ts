#!/usr/bin/env node

/**
 * Crypto Docs MCP Server - Evaluation Suite CLI
 *
 * Runs automated evaluations against the MCP server to measure
 * how effectively it answers questions about Mina, Solana, and Cosmos.
 *
 * Usage:
 *   npm run eval                    # Run all tests
 *   npm run eval -- --project mina  # Run only Mina tests
 *   npm run eval -- --verbose       # Show detailed output
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';

import type { TestDataset, TestResult, TestCase } from './types.js';
import { runTest, initializeMCP, checkServerHealth } from './harness.js';
import { calculateMetrics } from './metrics.js';
import { printReport, saveReport, printProgress, printError, printInfo } from './reporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('evaluator')
  .description('Evaluate Crypto Docs MCP Server quality')
  .version('1.0.0')
  .option('-p, --project <project>', 'Evaluate specific project (mina, solana, cosmos)')
  .option('-t, --tag <tag>', 'Filter tests by tag')
  .option('-d, --difficulty <level>', 'Filter by difficulty (basic, intermediate, advanced)')
  .option('-o, --output <path>', 'Save JSON report to file')
  .option('--verbose', 'Show detailed output')
  .option('--fail-fast', 'Stop on first failure')
  .option('--dry-run', 'List tests without running them')
  .option('--ci', 'Exit with code 1 if any tests fail (for CI pipelines)')
  .action(async (options) => {
    try {
      await runEvaluation(options);
    } catch (error) {
      console.error(chalk.red('Evaluation failed:'), error);
      process.exit(1);
    }
  });

async function loadDatasets(projectFilter?: string): Promise<TestDataset[]> {
  const datasetsDir = path.join(__dirname, '..', 'datasets');
  const datasets: TestDataset[] = [];

  const projects = projectFilter
    ? [projectFilter]
    : ['mina', 'solana', 'cosmos'];

  for (const project of projects) {
    const projectDir = path.join(datasetsDir, project);

    try {
      const files = await fs.readdir(projectDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const content = await fs.readFile(path.join(projectDir, file), 'utf-8');
        const dataset = parseYaml(content) as TestDataset;

        // Ensure project is set on all tests
        dataset.tests = dataset.tests.map(t => ({
          ...t,
          project: t.project || dataset.project
        }));

        datasets.push(dataset);
      }
    } catch {
      // Directory might not exist yet
      printInfo(`No datasets found for project: ${project}`);
    }
  }

  // Load cross-project tests (from root datasets directory)
  if (!projectFilter) {
    try {
      const rootFiles = await fs.readdir(datasetsDir);
      const rootYamlFiles = rootFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of rootYamlFiles) {
        const content = await fs.readFile(path.join(datasetsDir, file), 'utf-8');
        const dataset = parseYaml(content) as TestDataset;

        // Cross-project tests may have project specified per-test in input
        dataset.tests = dataset.tests.map(t => ({
          ...t,
          project: t.project || (t.input as Record<string, unknown>)?.project as string || dataset.project
        }));

        datasets.push(dataset);
      }
    } catch {
      // No root files
    }
  }

  return datasets;
}

interface EvaluationOptions {
  project?: string;
  tag?: string;
  difficulty?: string;
  output?: string;
  verbose?: boolean;
  failFast?: boolean;
  dryRun?: boolean;
  ci?: boolean;
}

async function runEvaluation(options: EvaluationOptions): Promise<void> {
  console.log(chalk.bold('\nCrypto Docs MCP Server - Evaluation Suite\n'));

  // Load datasets
  printInfo('Loading test datasets...');
  const datasets = await loadDatasets(options.project);

  if (datasets.length === 0) {
    console.log(chalk.yellow('No test datasets found.'));
    return;
  }

  // Flatten and filter tests
  let tests: TestCase[] = datasets.flatMap(d => d.tests);

  if (options.tag) {
    tests = tests.filter(t => t.tags?.includes(options.tag!));
  }

  if (options.difficulty) {
    tests = tests.filter(t => t.difficulty === options.difficulty);
  }

  console.log(chalk.dim(`Found ${tests.length} tests to run.\n`));

  if (tests.length === 0) {
    console.log(chalk.yellow('No tests match the specified filters.'));
    return;
  }

  // Dry run - just list tests
  if (options.dryRun) {
    console.log(chalk.bold('Tests that would run:\n'));
    for (const test of tests) {
      console.log(`  - ${test.id}: ${test.name} [${test.tool}] (${test.difficulty})`);
    }
    console.log(`\nTotal: ${tests.length} tests`);
    return;
  }

  // Check server health
  printInfo('Checking server health...');
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    printError('Server not responding. Start it with: npm run server');
    process.exit(1);
  }
  console.log(chalk.green('  ✓ Server is running\n'));

  // Initialize MCP
  printInfo('Connecting to MCP server...');
  try {
    await initializeMCP();
    console.log(chalk.green('  ✓ MCP connection initialized\n'));
  } catch (error) {
    printError(`Failed to initialize MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Run tests
  console.log(chalk.bold('Running tests:\n'));
  const results: TestResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = await runTest(test);
    results.push(result);

    // Print progress with inline failure details in verbose mode
    printProgress(i + 1, tests.length, `${test.id}: ${test.name}`, result.passed, result, options.verbose);

    if (options.failFast && !result.passed) {
      console.log(chalk.yellow('\n  Stopping early (--fail-fast)'));
      break;
    }
  }

  // Generate report
  const report = calculateMetrics(results);
  report.project = options.project;

  // Print report
  await printReport(report);

  // Save report
  const outputPath = options.output || path.join(
    __dirname, '..', 'reports',
    `eval-${options.project || 'all'}-${Date.now()}.json`
  );
  await saveReport(report, outputPath);

  // Exit with error code if tests failed (only in CI mode)
  if (options.ci && report.summary.failed > 0) {
    process.exit(1);
  }
}

program.parse();
