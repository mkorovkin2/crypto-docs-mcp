/**
 * Main validation module - orchestrates all validators
 */

import type { ValidationRule, ValidationResult, TestCase } from '../types.js';
import { validateRetrieval } from './retrieval.js';
import { validateAnswer } from './answer.js';
import { validateCode } from './code.js';
import {
  judgeResponseQuality,
  judgeCodeQuality,
  judgeErrorExplanation,
  judgmentToValidation
} from './llm-judge.js';

export async function validateResponseWithLLM(
  response: string,
  expected: TestCase['expected'],
  testCase: TestCase
): Promise<ValidationResult[]> {
  // Run basic validations first (min_length, has_code_block, etc.)
  const results = validateBasicRules(response, expected);

  // Run LLM-as-judge for objective helpfulness/relevance evaluation
  const useLLMJudge = testCase.useLLMJudge !== false && process.env.OPENAI_API_KEY;

  if (useLLMJudge) {
    // Choose the appropriate judge based on tool type
    if (testCase.tool === 'explain_error') {
      const error = testCase.input.error as string;
      const context = testCase.input.context as string || '';
      const judgment = await judgeErrorExplanation(
        error,
        context,
        response,
        testCase.project
      );
      results.push(judgmentToValidation(judgment, 'error-explanation-quality'));
    } else if (testCase.tool === 'get_working_example' || expected.codeRequirements) {
      const task = (testCase.input.task || testCase.input.question) as string;
      const judgment = await judgeCodeQuality(
        task,
        response,
        testCase.project,
        expected.codeRequirements
      );
      results.push(judgmentToValidation(judgment, 'code-quality'));
    } else {
      // ask_docs or search_docs - general response quality
      const question = (testCase.input.question || testCase.input.task) as string;
      const judgment = await judgeResponseQuality(
        question,
        response,
        testCase.project,
        {
          expectedFacts: expected.groundTruth?.expectedFacts,
          forbiddenClaims: expected.groundTruth?.forbiddenClaims
        }
      );
      results.push(judgmentToValidation(judgment, 'response-quality'));
    }
  }

  return results;
}

/**
 * Run basic structural validations (without LLM)
 * These are fast checks that don't require API calls
 */
function validateBasicRules(
  response: string,
  expected: TestCase['expected']
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Run all validation rules from the test case
  for (const rule of expected.validations) {
    results.push(runValidation(response, rule));
  }

  // Check expected keywords (still useful as a quick check)
  if (expected.expectedKeywords) {
    for (const keyword of expected.expectedKeywords) {
      const found = response.toLowerCase().includes(keyword.toLowerCase());
      results.push({
        rule: { type: 'contains', value: keyword },
        passed: found,
        message: found
          ? `Found expected keyword: "${keyword}"`
          : `Missing expected keyword: "${keyword}"`
      });
    }
  }

  // NOTE: forbiddenKeywords are NOT checked here anymore
  // The LLM judge evaluates cross-project mentions contextually
  // (comparisons are allowed, irrelevant mentions are penalized)

  // Check expected imports for code examples
  if (expected.expectedImports) {
    for (const importPattern of expected.expectedImports) {
      const importResult = validateCode.hasImport(response, importPattern);
      results.push({
        rule: { type: 'has_import', module: importPattern },
        passed: importResult.passed,
        message: importResult.message
      });
    }
  }

  return results;
}

export function validateResponse(
  response: string,
  expected: TestCase['expected']
): ValidationResult[] {
  // Non-LLM validation path - just run basic rules
  return validateBasicRules(response, expected);
}

function runValidation(response: string, rule: ValidationRule): ValidationResult {
  switch (rule.type) {
    case 'contains':
      return validateContains(response, rule.value, rule.caseSensitive);

    case 'contains_any':
      return validateContainsAny(response, rule.values);

    case 'contains_all':
      return validateContainsAll(response, rule.values);

    case 'matches_regex':
      return validateRegex(response, rule.pattern);

    case 'has_code_block':
      return validateCode.hasCodeBlock(response, rule.language);

    case 'has_import':
      return validateCode.hasImport(response, rule.module);

    case 'min_length':
      return validateAnswer.minLength(response, rule.chars);

    case 'has_citation':
      return validateAnswer.hasCitation(response);

    case 'confidence_above':
      return validateRetrieval.confidenceAbove(response, rule.threshold);

    case 'confidence_below':
      return validateRetrieval.confidenceBelow(response, rule.threshold);

    case 'sources_count':
      return validateRetrieval.sourcesCount(response, rule.min);

    // Search guidance validators (intelligent fallback feature)
    case 'has_search_guidance':
      return validateRetrieval.hasSearchGuidance(response);

    case 'search_guidance_has_project':
      return validateRetrieval.searchGuidanceHasProject(response, rule.project);

    case 'search_guidance_has_searches':
      return validateRetrieval.searchGuidanceHasSearches(response, rule.min);

    case 'has_web_search_suggestion':
      return validateRetrieval.hasWebSearchSuggestion(response);

    default:
      return {
        rule,
        passed: false,
        message: `Unknown validation rule type`
      };
  }
}

function validateContains(response: string, value: string, caseSensitive = false): ValidationResult {
  const text = caseSensitive ? response : response.toLowerCase();
  const search = caseSensitive ? value : value.toLowerCase();
  const found = text.includes(search);

  return {
    rule: { type: 'contains', value, caseSensitive },
    passed: found,
    message: found ? `Contains "${value}"` : `Does not contain "${value}"`
  };
}

function validateContainsAny(response: string, values: string[]): ValidationResult {
  const lowerResponse = response.toLowerCase();
  const found = values.find(v => lowerResponse.includes(v.toLowerCase()));

  return {
    rule: { type: 'contains_any', values },
    passed: !!found,
    message: found
      ? `Contains "${found}"`
      : `Does not contain any of: ${values.join(', ')}`
  };
}

function validateContainsAll(response: string, values: string[]): ValidationResult {
  const lowerResponse = response.toLowerCase();
  const missing = values.filter(v => !lowerResponse.includes(v.toLowerCase()));

  return {
    rule: { type: 'contains_all', values },
    passed: missing.length === 0,
    message: missing.length === 0
      ? `Contains all required values`
      : `Missing: ${missing.join(', ')}`
  };
}

function validateRegex(response: string, pattern: string): ValidationResult {
  try {
    const regex = new RegExp(pattern, 'i');
    const matches = regex.test(response);

    return {
      rule: { type: 'matches_regex', pattern },
      passed: matches,
      message: matches
        ? `Matches pattern: ${pattern}`
        : `Does not match pattern: ${pattern}`
    };
  } catch {
    return {
      rule: { type: 'matches_regex', pattern },
      passed: false,
      message: `Invalid regex pattern: ${pattern}`
    };
  }
}

// Re-export individual validators for direct use
export { validateRetrieval } from './retrieval.js';
export { validateAnswer } from './answer.js';
export { validateCode } from './code.js';
