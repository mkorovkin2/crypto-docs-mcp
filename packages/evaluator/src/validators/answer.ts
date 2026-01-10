/**
 * Answer content validators
 */

import type { ValidationResult } from '../types.js';

export const validateAnswer = {
  minLength(response: string, chars: number): ValidationResult {
    // Strip metadata block for length check
    const answerOnly = response.split('<response_metadata>')[0].trim();
    const length = answerOnly.length;

    return {
      rule: { type: 'min_length', chars },
      passed: length >= chars,
      message: `Response length: ${length} chars (minimum: ${chars})`,
      details: { length }
    };
  },

  hasCitation(response: string): ValidationResult {
    // Check for [Source N] or [N] citation patterns
    const hasCitation = /\[Source\s*\d+\]|\[\d+\]/.test(response);

    return {
      rule: { type: 'has_citation' },
      passed: hasCitation,
      message: hasCitation
        ? 'Contains source citations'
        : 'Missing source citations'
    };
  }
};
