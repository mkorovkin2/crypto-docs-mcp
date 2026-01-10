/**
 * Metrics calculation for evaluation results
 */

import type { TestResult, EvaluationReport, Difficulty, Tool } from './types.js';

export function calculateMetrics(results: TestResult[]): EvaluationReport {
  const timestamp = new Date().toISOString();

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  const confidences = results
    .filter(r => r.metadata.confidence > 0)
    .map(r => r.metadata.confidence);

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const avgProcessingTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.metadata.processingTimeMs, 0) / results.length
    : 0;

  // By difficulty
  const byDifficulty = calculateByDifficulty(results);

  // By tool
  const byTool = calculateByTool(results);

  // Failures detail - include everything needed for debugging
  const failures = results
    .filter(r => !r.passed)
    .map(r => ({
      testId: r.testCase.id,
      testName: r.testCase.name,
      project: r.testCase.project,
      tool: r.testCase.tool,
      difficulty: r.testCase.difficulty,
      input: r.testCase.input,
      failedValidations: r.validations.filter(v => !v.passed),
      responsePreview: r.response.slice(0, 500) + (r.response.length > 500 ? '...' : ''),
      errorMessage: r.errorMessage
    }));

  return {
    timestamp,
    summary: {
      totalTests: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      averageConfidence: Math.round(avgConfidence),
      averageProcessingTime: Math.round(avgProcessingTime)
    },
    byDifficulty,
    byTool,
    results,
    failures
  };
}

function calculateByDifficulty(results: TestResult[]): EvaluationReport['byDifficulty'] {
  const difficulties: Difficulty[] = ['basic', 'intermediate', 'advanced'];
  const byDifficulty: EvaluationReport['byDifficulty'] = {
    basic: { total: 0, passed: 0, passRate: 0 },
    intermediate: { total: 0, passed: 0, passRate: 0 },
    advanced: { total: 0, passed: 0, passRate: 0 }
  };

  for (const diff of difficulties) {
    const filtered = results.filter(r => r.testCase.difficulty === diff);
    const passed = filtered.filter(r => r.passed).length;

    byDifficulty[diff] = {
      total: filtered.length,
      passed,
      passRate: filtered.length > 0 ? (passed / filtered.length) * 100 : 0
    };
  }

  return byDifficulty;
}

function calculateByTool(results: TestResult[]): EvaluationReport['byTool'] {
  const tools: Tool[] = ['ask_docs', 'get_working_example', 'explain_error', 'search_docs'];
  const byTool: EvaluationReport['byTool'] = {
    ask_docs: { total: 0, passed: 0, passRate: 0 },
    get_working_example: { total: 0, passed: 0, passRate: 0 },
    explain_error: { total: 0, passed: 0, passRate: 0 },
    search_docs: { total: 0, passed: 0, passRate: 0 }
  };

  for (const tool of tools) {
    const filtered = results.filter(r => r.testCase.tool === tool);
    const passed = filtered.filter(r => r.passed).length;

    byTool[tool] = {
      total: filtered.length,
      passed,
      passRate: filtered.length > 0 ? (passed / filtered.length) * 100 : 0
    };
  }

  return byTool;
}

/**
 * Calculate pass rate for a subset of results
 */
export function calculatePassRate(results: TestResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter(r => r.passed).length;
  return (passed / results.length) * 100;
}

/**
 * Get summary statistics for quick overview
 */
export function getSummaryStats(results: TestResult[]): {
  total: number;
  passed: number;
  failed: number;
  passRate: string;
} {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const passRate = results.length > 0
    ? ((passed / results.length) * 100).toFixed(1)
    : '0.0';

  return { total: results.length, passed, failed, passRate: `${passRate}%` };
}
