/**
 * Report generation and console output
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { EvaluationReport, TestResult, ValidationResult } from './types.js';

export async function printReport(report: EvaluationReport): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log(chalk.bold.blue('  Crypto Docs MCP Server - Evaluation Report'));
  console.log('='.repeat(70));

  // Summary
  console.log('\n' + chalk.bold('Summary:'));
  console.log(`  Total Tests:       ${report.summary.totalTests}`);
  console.log(`  Passed:            ${chalk.green(report.summary.passed.toString())}`);
  console.log(`  Failed:            ${chalk.red(report.summary.failed.toString())}`);
  console.log(`  Pass Rate:         ${formatPassRate(report.summary.passRate)}`);
  console.log(`  Avg Confidence:    ${report.summary.averageConfidence}%`);
  console.log(`  Avg Response Time: ${report.summary.averageProcessingTime}ms`);

  // By Difficulty
  console.log('\n' + chalk.bold('By Difficulty:'));
  for (const [diff, stats] of Object.entries(report.byDifficulty)) {
    if (stats.total > 0) {
      console.log(`  ${diff.padEnd(15)} ${stats.passed}/${stats.total} (${formatPassRate(stats.passRate)})`);
    }
  }

  // By Tool
  console.log('\n' + chalk.bold('By Tool:'));
  for (const [tool, stats] of Object.entries(report.byTool)) {
    if (stats.total > 0) {
      console.log(`  ${tool.padEnd(22)} ${stats.passed}/${stats.total} (${formatPassRate(stats.passRate)})`);
    }
  }

  // Failures - now with detailed explanations
  if (report.failures.length > 0) {
    console.log('\n' + chalk.bold.red(`Failures (${report.failures.length}):`));
    for (const failure of report.failures) {
      printFailureDetail(failure);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Report generated: ${report.timestamp}`);
  if (report.project) {
    console.log(`  Project filter: ${report.project}`);
  }
  console.log('='.repeat(70) + '\n');
}

/**
 * Print detailed failure information for debugging
 */
function printFailureDetail(failure: EvaluationReport['failures'][0]): void {
  console.log('\n' + chalk.red('─'.repeat(70)));
  console.log(chalk.red.bold(`  ✗ FAILED: ${failure.testId}`));
  console.log(chalk.red(`    ${failure.testName}`));
  console.log(chalk.dim(`    Project: ${failure.project} | Tool: ${failure.tool} | Difficulty: ${failure.difficulty}`));

  // Show what was asked
  if (failure.input) {
    console.log('\n' + chalk.yellow('  Question/Task:'));
    const question = failure.input.question || failure.input.task || failure.input.error;
    if (question) {
      console.log(chalk.white(`    "${question}"`));
    }
    if (failure.input.context) {
      console.log(chalk.dim(`    Context: ${failure.input.context}`));
    }
  }

  // Show what failed and why
  console.log('\n' + chalk.yellow('  Why it failed:'));

  for (const validation of failure.failedValidations) {
    const details = validation.details as Record<string, unknown> | undefined;

    // Check if this is an LLM judge result
    if (details && typeof details.score === 'number') {
      // LLM Judge failure - show detailed breakdown
      console.log(chalk.red(`\n    LLM Judge Score: ${details.score}/100 ${details.score >= 70 ? '' : '(below 70 threshold)'}`));

      // Show dimension scores
      if (details.helpfulness !== undefined) {
        const h = details.helpfulness as number;
        const r = details.relevance as number;
        const a = details.accuracy as number;
        const c = details.completeness as number;

        console.log('    Dimension Scores:');
        console.log(`      ${formatDimensionScore('Helpfulness', h)} - Would a developer know what to do?`);
        console.log(`      ${formatDimensionScore('Relevance', r)} - Does it answer the question?`);
        console.log(`      ${formatDimensionScore('Accuracy', a)} - Is the info correct?`);
        console.log(`      ${formatDimensionScore('Completeness', c)} - Is anything important missing?`);
      }

      // Show the reasoning
      if (validation.message) {
        const reasoningMatch = validation.message.match(/- (.+?)(?:\s+Issues:|$)/);
        if (reasoningMatch) {
          console.log('\n    ' + chalk.cyan('Judge Assessment:'));
          console.log(`      ${reasoningMatch[1]}`);
        }
      }

      // Show specific issues
      if (details.issues && Array.isArray(details.issues) && details.issues.length > 0) {
        console.log('\n    ' + chalk.cyan('Specific Issues:'));
        for (const issue of details.issues) {
          console.log(`      • ${issue}`);
        }
      }
    } else {
      // Basic validation failure
      console.log(`    • ${validation.message}`);
    }
  }

  // Show response preview
  if (failure.responsePreview) {
    console.log('\n' + chalk.yellow('  Response Preview:'));
    const preview = failure.responsePreview.slice(0, 400);
    const lines = preview.split('\n').slice(0, 8);
    for (const line of lines) {
      console.log(chalk.dim(`    ${line.slice(0, 80)}`));
    }
    if (failure.responsePreview.length > 400) {
      console.log(chalk.dim('    ... (truncated)'));
    }
  }

  // Show error if there was one
  if (failure.errorMessage) {
    console.log('\n' + chalk.red('  Error:'));
    console.log(`    ${failure.errorMessage}`);
  }

  console.log(chalk.red('─'.repeat(70)));
}

function formatDimensionScore(name: string, score: number): string {
  const label = name.padEnd(14);
  const scoreStr = `${score}`.padStart(3);

  if (score >= 70) {
    return `${chalk.green(scoreStr)}/100 ${label}`;
  } else if (score >= 50) {
    return `${chalk.yellow(scoreStr)}/100 ${label}`;
  } else {
    return `${chalk.red(scoreStr)}/100 ${label} ${chalk.red('← CRITICAL')}`;
  }
}

function formatPassRate(rate: number): string {
  const formatted = `${rate.toFixed(1)}%`;
  if (rate >= 80) return chalk.green(formatted);
  if (rate >= 60) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

export async function saveReport(report: EvaluationReport, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Create a clean report with enough detail for debugging
  const cleanReport = {
    ...report,
    results: report.results.map(r => ({
      testCase: r.testCase,
      passed: r.passed,
      validations: r.validations,
      metadata: r.metadata,
      errorMessage: r.errorMessage,
      // Include more of response for failed tests
      responsePreview: r.passed
        ? r.response.slice(0, 300) + (r.response.length > 300 ? '...' : '')
        : r.response.slice(0, 1000) + (r.response.length > 1000 ? '...' : '')
    }))
  };

  await fs.writeFile(outputPath, JSON.stringify(cleanReport, null, 2));
  console.log(chalk.dim(`Report saved to: ${outputPath}`));
}

/**
 * Print progress during test run - with inline failure detail in verbose mode
 */
export function printProgress(
  current: number,
  total: number,
  testName: string,
  passed: boolean,
  result?: TestResult,
  verbose?: boolean
): void {
  const status = passed ? chalk.green('✓') : chalk.red('✗');
  const progress = `[${current.toString().padStart(3)}/${total}]`;
  console.log(`  ${status} ${chalk.dim(progress)} ${testName}`);

  // In verbose mode, show failure details inline
  if (verbose && !passed && result) {
    printInlineFailure(result);
  }
}

/**
 * Print compact failure info inline during test run
 */
function printInlineFailure(result: TestResult): void {
  const failedValidations = result.validations.filter(v => !v.passed);

  for (const validation of failedValidations) {
    const details = validation.details as Record<string, unknown> | undefined;

    if (details && typeof details.score === 'number') {
      // LLM Judge result
      const h = details.helpfulness as number || 0;
      const r = details.relevance as number || 0;
      const a = details.accuracy as number || 0;
      const c = details.completeness as number || 0;

      console.log(chalk.dim(`      Score: ${details.score}/100 [H:${h} R:${r} A:${a} C:${c}]`));

      // Extract and show reasoning
      const reasoningMatch = validation.message?.match(/- (.+?)(?:\s+Issues:|$)/);
      if (reasoningMatch) {
        console.log(chalk.dim(`      → ${reasoningMatch[1].slice(0, 100)}`));
      }

      // Show first issue
      if (details.issues && Array.isArray(details.issues) && details.issues.length > 0) {
        console.log(chalk.red(`      Issue: ${(details.issues[0] as string).slice(0, 80)}`));
      }
    } else {
      console.log(chalk.dim(`      ${validation.message}`));
    }
  }

  if (result.errorMessage) {
    console.log(chalk.red(`      Error: ${result.errorMessage}`));
  }
}

export function printError(message: string): void {
  console.log(chalk.red(`  Error: ${message}`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(`  Warning: ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.dim(`  ${message}`));
}
