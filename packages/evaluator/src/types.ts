/**
 * Core types for the evaluation framework
 */

export type Tool = 'ask_docs' | 'get_working_example' | 'explain_error' | 'search_docs';

export type Difficulty = 'basic' | 'intermediate' | 'advanced';

export type ValidationRule =
  | { type: 'contains'; value: string; caseSensitive?: boolean }
  | { type: 'contains_any'; values: string[] }
  | { type: 'contains_all'; values: string[] }
  | { type: 'matches_regex'; pattern: string }
  | { type: 'has_code_block'; language?: string }
  | { type: 'has_import'; module: string }
  | { type: 'min_length'; chars: number }
  | { type: 'has_citation' }
  | { type: 'confidence_above'; threshold: number }
  | { type: 'confidence_below'; threshold: number }
  | { type: 'sources_count'; min: number }
  // Search guidance validators (for intelligent fallback feature)
  | { type: 'has_search_guidance' }
  | { type: 'search_guidance_has_project'; project: string }
  | { type: 'search_guidance_has_searches'; min: number }
  | { type: 'has_web_search_suggestion' };

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  tool: Tool;
  project: string;
  difficulty: Difficulty;
  input: Record<string, unknown>;
  expected: {
    validations: ValidationRule[];
    /** Keywords that SHOULD appear in the answer */
    expectedKeywords?: string[];
    /** Keywords that should NOT appear (e.g., wrong project info) */
    forbiddenKeywords?: string[];
    /** For code examples: expected import patterns */
    expectedImports?: string[];
    /** Ground truth for LLM-as-judge semantic validation */
    groundTruth?: {
      /** Facts that MUST be covered in the response */
      expectedFacts: string[];
      /** Incorrect statements that should NOT appear */
      forbiddenClaims?: string[];
      /** Alternative correct phrasings */
      acceptableVariations?: string[];
    };
    /** For code examples: patterns for LLM code judge */
    codeRequirements?: {
      mustInclude: string[];
      mustNotInclude?: string[];
      expectedStructure?: string;
    };
  };
  /** Whether to use LLM-as-judge for this test (default: true if groundTruth provided) */
  useLLMJudge?: boolean;
  tags?: string[];
}

export interface TestDataset {
  name: string;
  project: string;
  version: string;
  tests: TestCase[];
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  validations: ValidationResult[];
  response: string;
  metadata: {
    confidence: number;
    sourcesUsed: number;
    processingTimeMs: number;
  };
  errorMessage?: string;
}

export interface EvaluationReport {
  timestamp: string;
  project?: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    averageConfidence: number;
    averageProcessingTime: number;
  };
  byDifficulty: Record<Difficulty, {
    total: number;
    passed: number;
    passRate: number;
  }>;
  byTool: Record<Tool, {
    total: number;
    passed: number;
    passRate: number;
  }>;
  results: TestResult[];
  failures: Array<{
    testId: string;
    testName: string;
    project: string;
    tool: Tool;
    difficulty: Difficulty;
    input: Record<string, unknown>;
    failedValidations: ValidationResult[];
    responsePreview: string;
    errorMessage?: string;
  }>;
}
