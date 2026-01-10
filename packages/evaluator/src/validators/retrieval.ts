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

  confidenceBelow(response: string, threshold: number): ValidationResult {
    const metadataMatch = response.match(/"confidence":\s*(\d+)/);
    const confidence = metadataMatch ? parseInt(metadataMatch[1], 10) : 100;

    return {
      rule: { type: 'confidence_below', threshold },
      passed: confidence < threshold,
      message: `Confidence: ${confidence} (should be below: ${threshold})`,
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
  },

  /**
   * Check if response includes searchGuidance in metadata
   */
  hasSearchGuidance(response: string): ValidationResult {
    // Check for searchGuidance in the JSON metadata block
    const hasGuidance = response.includes('"searchGuidance"') ||
                        response.includes('### Additional Resources Recommended') ||
                        response.includes('Suggested searches');

    return {
      rule: { type: 'has_search_guidance' },
      passed: hasGuidance,
      message: hasGuidance
        ? 'Response includes search guidance'
        : 'Response does not include search guidance',
      details: { hasSearchGuidance: hasGuidance }
    };
  },

  /**
   * Check if search guidance mentions the correct project
   */
  searchGuidanceHasProject(response: string, project: string): ValidationResult {
    // Look for project name in the searchGuidance section or in the guidance text
    const guidanceSection = extractSearchGuidanceSection(response);

    if (!guidanceSection) {
      return {
        rule: { type: 'search_guidance_has_project', project },
        passed: false,
        message: 'No search guidance found in response',
        details: { project, found: false }
      };
    }

    // Check for project name (case-insensitive)
    const projectPatterns: Record<string, string[]> = {
      mina: ['mina', 'o1js', 'mina protocol'],
      solana: ['solana', 'anchor', 'spl'],
      cosmos: ['cosmos', 'cosmos sdk', 'cosmos-sdk', 'ibc']
    };

    const patterns = projectPatterns[project.toLowerCase()] || [project.toLowerCase()];
    const lowerGuidance = guidanceSection.toLowerCase();
    const found = patterns.some(p => lowerGuidance.includes(p));

    return {
      rule: { type: 'search_guidance_has_project', project },
      passed: found,
      message: found
        ? `Search guidance mentions project: ${project}`
        : `Search guidance does not mention project: ${project}`,
      details: { project, found }
    };
  },

  /**
   * Check if search guidance includes minimum number of suggested searches
   */
  searchGuidanceHasSearches(response: string, min: number): ValidationResult {
    const guidanceSection = extractSearchGuidanceSection(response);

    if (!guidanceSection) {
      return {
        rule: { type: 'search_guidance_has_searches', min },
        passed: false,
        message: 'No search guidance found in response',
        details: { min, count: 0 }
      };
    }

    // Count search query suggestions (look for backtick-enclosed queries or bullet points)
    const searchQueries = guidanceSection.match(/`[^`]+`/g) || [];
    const bulletSearches = guidanceSection.match(/^[-*]\s+.+$/gm) || [];

    // Use the larger count (some may be duplicates)
    const count = Math.max(searchQueries.length, bulletSearches.length);

    return {
      rule: { type: 'search_guidance_has_searches', min },
      passed: count >= min,
      message: `Found ${count} suggested searches (minimum: ${min})`,
      details: { min, count }
    };
  },

  /**
   * Check if response metadata includes web_search suggestion
   */
  hasWebSearchSuggestion(response: string): ValidationResult {
    // Look for web_search in suggestions array
    const hasWebSearch = response.includes('"web_search"') ||
                         response.includes('"action": "web_search"');

    return {
      rule: { type: 'has_web_search_suggestion' },
      passed: hasWebSearch,
      message: hasWebSearch
        ? 'Response includes web_search suggestion'
        : 'Response does not include web_search suggestion',
      details: { hasWebSearchSuggestion: hasWebSearch }
    };
  }
};

/**
 * Extract the search guidance section from a response
 */
function extractSearchGuidanceSection(response: string): string | null {
  // Try to find the search guidance in different formats

  // Format 1: JSON metadata block
  const jsonMatch = response.match(/"searchGuidance"\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Format 2: Markdown section
  const markdownMatch = response.match(/### Additional Resources Recommended[\s\S]*?(?=###|$)/);
  if (markdownMatch) {
    return markdownMatch[0];
  }

  // Format 3: Suggested searches section
  const suggestedMatch = response.match(/\*\*Suggested searches[^*]*\*\*[\s\S]*?(?=\*\*|###|$)/i);
  if (suggestedMatch) {
    return suggestedMatch[0];
  }

  return null;
}
