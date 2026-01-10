/**
 * Search Query Generator Module
 *
 * Generates specific, actionable web search queries based on what the
 * server understood from a query. Used to help coding agents find
 * information that isn't in the indexed documentation.
 */

import type { QueryUnderstanding } from './understanding-extractor.js';

/**
 * A suggested web search query with context
 */
export interface WebSearchQuery {
  /** The actual search query string */
  query: string;
  /** Why this query might help */
  rationale: string;
  /** Search engine hint */
  suggestedEngine: 'google' | 'github' | 'stackoverflow' | 'docs';
  /** Priority (1 = try first) */
  priority: number;
}

/**
 * Complete search guidance for the coding agent
 */
export interface SearchGuidance {
  /** Clear statement of what the server couldn't answer well */
  limitation: string;
  /** What the server DID understand from the query */
  whatWeUnderstood: {
    project: string;
    intent: string;
    technicalTerms: string[];
  };
  /** Specific search queries to try */
  suggestedSearches: WebSearchQuery[];
  /** Additional tips for the coding agent */
  tips: string[];
}

/**
 * Project-specific search terms and resources
 */
interface ProjectSearchInfo {
  name: string;
  sdkName: string;
  keywords: string[];
  officialDocs?: string;
  communityResources?: string[];
}

const PROJECT_INFO: Record<string, ProjectSearchInfo> = {
  mina: {
    name: 'Mina Protocol',
    sdkName: 'o1js',
    keywords: ['zkApp', 'zero knowledge', 'provable', 'SmartContract', 'Field', 'Bool'],
    officialDocs: 'docs.minaprotocol.com',
    communityResources: ['Mina Discord', 'o1-labs GitHub']
  },
  solana: {
    name: 'Solana',
    sdkName: 'Anchor',
    keywords: ['program', 'PDA', 'token', 'SPL', 'instruction', 'account'],
    officialDocs: 'solana.com/docs',
    communityResources: ['Solana Cookbook', 'Anchor documentation']
  },
  cosmos: {
    name: 'Cosmos SDK',
    sdkName: 'cosmos-sdk',
    keywords: ['module', 'keeper', 'IBC', 'chain', 'msg', 'query'],
    officialDocs: 'docs.cosmos.network',
    communityResources: ['Cosmos Discord', 'Cosmos GitHub discussions']
  }
};

/**
 * Get project-specific search info
 */
function getProjectInfo(project: string): ProjectSearchInfo {
  return PROJECT_INFO[project.toLowerCase()] || {
    name: project,
    sdkName: project,
    keywords: []
  };
}

/**
 * Generate search guidance based on query understanding
 */
export function generateSearchGuidance(
  understanding: QueryUnderstanding,
  originalQuery: string
): SearchGuidance {
  const searches: WebSearchQuery[] = [];
  const projectInfo = getProjectInfo(understanding.project);

  // Generate project-specific search
  const projectQuery = generateProjectSearch(understanding, projectInfo);
  if (projectQuery) searches.push(projectQuery);

  // Generate query-type-specific searches
  const typeQueries = generateTypeSpecificSearches(understanding, projectInfo, originalQuery);
  searches.push(...typeQueries);

  // Generate technical term searches for uncovered concepts
  const termQueries = generateTermSearches(understanding, projectInfo);
  searches.push(...termQueries);

  // Sort by priority and limit to 4 queries
  const sortedSearches = searches
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  return {
    limitation: generateLimitationDescription(understanding),
    whatWeUnderstood: {
      project: understanding.project,
      intent: understanding.intent,
      technicalTerms: understanding.technicalTerms
    },
    suggestedSearches: sortedSearches,
    tips: generateSearchTips(understanding, projectInfo)
  };
}

/**
 * Generate a project-specific search query
 */
function generateProjectSearch(
  understanding: QueryUnderstanding,
  projectInfo: ProjectSearchInfo
): WebSearchQuery | null {
  const { intent, technicalTerms } = understanding;

  // Combine with intent and technical terms
  const keyTerms = technicalTerms.slice(0, 2).join(' ');
  const searchIntent = intent.slice(0, 40);

  return {
    query: `${projectInfo.name} ${keyTerms} ${searchIntent}`.trim(),
    rationale: `Search for ${projectInfo.name}-specific documentation about this topic`,
    suggestedEngine: 'google',
    priority: 1
  };
}

/**
 * Generate query-type-specific search queries
 */
function generateTypeSpecificSearches(
  understanding: QueryUnderstanding,
  projectInfo: ProjectSearchInfo,
  originalQuery: string
): WebSearchQuery[] {
  const { queryType, technicalTerms, intent } = understanding;
  const keyTerms = technicalTerms.slice(0, 2).join(' ');

  switch (queryType) {
    case 'error':
      return [
        {
          query: `${projectInfo.name} ${keyTerms} error solution`,
          rationale: 'Search for error solutions specific to this blockchain',
          suggestedEngine: 'stackoverflow',
          priority: 2
        },
        {
          query: `${projectInfo.sdkName} ${keyTerms} issue`,
          rationale: 'Check if others have reported this issue on GitHub',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    case 'howto':
      return [
        {
          query: `${projectInfo.name} tutorial ${intent.slice(0, 30)}`,
          rationale: 'Search for tutorials covering this task',
          suggestedEngine: 'google',
          priority: 2
        },
        {
          query: `${projectInfo.sdkName} example ${keyTerms}`,
          rationale: 'Look for code examples in the SDK or related repos',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    case 'concept':
      return [
        {
          query: `${projectInfo.name} ${keyTerms} explained`,
          rationale: 'Search for explanations of this concept',
          suggestedEngine: 'google',
          priority: 2
        },
        {
          query: `what is ${keyTerms} ${projectInfo.name}`,
          rationale: 'Find introductory content about this concept',
          suggestedEngine: 'google',
          priority: 3
        }
      ];

    case 'code_lookup':
    case 'api_reference':
      return [
        {
          query: `${projectInfo.sdkName} ${keyTerms} API documentation`,
          rationale: 'Search for official API documentation',
          suggestedEngine: 'google',
          priority: 2
        },
        {
          query: `${projectInfo.sdkName} ${keyTerms} example`,
          rationale: 'Search for usage examples in GitHub code',
          suggestedEngine: 'github',
          priority: 3
        }
      ];

    default:
      return [
        {
          query: `${projectInfo.name} ${keyTerms} documentation`,
          rationale: 'General documentation search',
          suggestedEngine: 'google',
          priority: 2
        }
      ];
  }
}

/**
 * Generate searches for specific uncovered technical terms
 */
function generateTermSearches(
  understanding: QueryUnderstanding,
  projectInfo: ProjectSearchInfo
): WebSearchQuery[] {
  const { uncoveredConcepts } = understanding;

  // Only generate if we have uncovered concepts
  if (uncoveredConcepts.length === 0) return [];

  // Focus on the most important uncovered term
  const mainTerm = uncoveredConcepts[0];

  return [{
    query: `${projectInfo.name} ${mainTerm} guide`,
    rationale: `"${mainTerm}" wasn't well covered in indexed docs - search for dedicated documentation`,
    suggestedEngine: 'google',
    priority: 4
  }];
}

/**
 * Generate description of what we couldn't fully answer
 */
function generateLimitationDescription(understanding: QueryUnderstanding): string {
  const { technicalTerms, uncoveredConcepts, project, queryType } = understanding;

  if (uncoveredConcepts.length > 0) {
    const terms = uncoveredConcepts.slice(0, 3).map(t => `"${t}"`).join(', ');
    return `The indexed ${project} documentation doesn't fully cover ${terms}. The answer above may be incomplete.`;
  }

  if (technicalTerms.length === 0) {
    return `I couldn't find comprehensive documentation for this ${queryType} query. Consider supplementing with web search.`;
  }

  return `The indexed documentation may not fully address your question. Web search might provide additional context.`;
}

/**
 * Generate helpful tips for the coding agent
 */
function generateSearchTips(
  understanding: QueryUnderstanding,
  projectInfo: ProjectSearchInfo
): string[] {
  const tips: string[] = [];

  // Add official docs reference
  if (projectInfo.officialDocs) {
    tips.push(`Official docs: ${projectInfo.officialDocs}`);
  }

  // Add community resources
  if (projectInfo.communityResources && projectInfo.communityResources.length > 0) {
    tips.push(`Community resources: ${projectInfo.communityResources.join(', ')}`);
  }

  // Query-type-specific tips
  if (understanding.queryType === 'error') {
    tips.push(`Include the exact error message in your search for better results`);
  }

  if (understanding.queryType === 'howto' && understanding.technicalTerms.length > 0) {
    tips.push(`Try searching for "${understanding.technicalTerms[0]} tutorial" or "getting started"`);
  }

  return tips.slice(0, 3);
}

/**
 * Format search guidance as markdown to append to a response
 */
export function formatSearchGuidanceAsMarkdown(guidance: SearchGuidance): string {
  const lines: string[] = [];

  lines.push(`\n---\n`);
  lines.push(`### Additional Resources Recommended\n`);
  lines.push(guidance.limitation);
  lines.push('');

  lines.push(`**Based on your question, I understood:**`);
  lines.push(`- Project: ${guidance.whatWeUnderstood.project}`);
  lines.push(`- Goal: ${guidance.whatWeUnderstood.intent}`);
  if (guidance.whatWeUnderstood.technicalTerms.length > 0) {
    lines.push(`- Key terms: ${guidance.whatWeUnderstood.technicalTerms.join(', ')}`);
  }
  lines.push('');

  lines.push(`**Suggested searches to find more information:**`);
  for (const search of guidance.suggestedSearches) {
    lines.push(`- \`${search.query}\` _(${search.rationale})_`);
  }

  if (guidance.tips.length > 0) {
    lines.push('');
    lines.push(`**Tips:**`);
    for (const tip of guidance.tips) {
      lines.push(`- ${tip}`);
    }
  }

  return lines.join('\n');
}
