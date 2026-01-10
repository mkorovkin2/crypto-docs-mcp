/**
 * Retrieval quality validators
 */

import type { ValidationResult } from '../types.js';

export const validateRetrieval = {
  confidenceAbove(response: string, threshold: number): ValidationResult {
    const metadataMatch = response.match(/"confidence":\s*(\d+)/);
    const confidence = metadataMatch ? parseInt(metadataMatch[1], 10) : 0;

    return {
      rule: { type: 'confidence_above', threshold },
      passed: confidence >= threshold,
      message: `Confidence: ${confidence} (threshold: ${threshold})`,
      details: { confidence }
    };
  },

  sourcesCount(response: string, min: number): ValidationResult {
    const metadataMatch = response.match(/"sourcesUsed":\s*(\d+)/);
    const count = metadataMatch ? parseInt(metadataMatch[1], 10) : 0;

    return {
      rule: { type: 'sources_count', min },
      passed: count >= min,
      message: `Sources used: ${count} (minimum: ${min})`,
      details: { sourcesUsed: count }
    };
  }
};
