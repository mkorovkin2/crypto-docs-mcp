/**
 * Web Search Module
 *
 * Provides web search capabilities using Tavily API for finding
 * live documentation and external resources during the agentic
 * evaluation loop.
 */

export interface WebSearchConfig {
  apiKey: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  answer?: string; // Tavily can provide a direct answer
  responseTime: number;
}

export interface WebSearchOptions {
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
}

export class WebSearchClient {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';
  private maxResults: number;
  private searchDepth: 'basic' | 'advanced';

  constructor(config: WebSearchConfig) {
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults ?? 5;
    this.searchDepth = config.searchDepth ?? 'basic';
  }

  /**
   * Search the web for documentation and resources
   */
  async search(
    query: string,
    options?: WebSearchOptions
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: this.searchDepth,
        include_answer: options?.includeAnswer ?? true,
        include_domains: options?.includeDomains,
        exclude_domains: options?.excludeDomains,
        max_results: options?.maxResults ?? this.maxResults,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily search failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    return {
      query,
      results: (data.results || []).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        score: r.score || 0,
        publishedDate: r.published_date,
      })),
      answer: data.answer,
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * Extract content from specific URLs
   */
  async extract(urls: string[]): Promise<Array<{ url: string; content: string }>> {
    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        urls,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily extract failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Check if the client is configured and ready
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

/**
 * Project display names for search queries
 */
const PROJECT_NAMES: Record<string, string> = {
  mina: 'Mina Protocol',
  solana: 'Solana',
  cosmos: 'Cosmos SDK',
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
};

/**
 * Project SDK names for code-related searches
 */
const PROJECT_SDKS: Record<string, string> = {
  mina: 'o1js',
  solana: 'Anchor',
  cosmos: 'cosmos-sdk',
  ethereum: 'ethers.js',
  polygon: 'ethers.js',
  arbitrum: 'ethers.js',
  optimism: 'ethers.js',
};

/**
 * Get display name for a project
 */
export function getProjectDisplayName(project: string): string {
  return PROJECT_NAMES[project.toLowerCase()] || project;
}

/**
 * Get SDK name for a project
 */
export function getProjectSDK(project: string): string {
  return PROJECT_SDKS[project.toLowerCase()] || project;
}

/**
 * Generate search queries optimized for finding documentation
 */
export function generateDocSearchQueries(
  project: string,
  topic: string,
  queryType: string
): string[] {
  const projectName = getProjectDisplayName(project);
  const sdkName = getProjectSDK(project);

  const queries: string[] = [];

  // Primary documentation search
  queries.push(`${projectName} ${topic} documentation`);

  // Type-specific searches
  switch (queryType) {
    case 'howto':
      queries.push(`${projectName} ${topic} tutorial example`);
      queries.push(`how to ${topic} ${projectName}`);
      break;
    case 'error':
      queries.push(`${projectName} ${topic} error fix solution`);
      queries.push(`${topic} troubleshooting ${projectName}`);
      break;
    case 'api_reference':
    case 'code_lookup':
      queries.push(`${projectName} ${topic} API reference`);
      queries.push(`${sdkName} ${topic} example`);
      break;
    case 'concept':
      queries.push(`${projectName} ${topic} explained`);
      queries.push(`what is ${topic} in ${projectName}`);
      break;
    default:
      queries.push(`${projectName} ${topic} guide`);
  }

  return queries.slice(0, 3); // Limit to avoid too many API calls
}

/**
 * Get recommended domains for a project's documentation
 */
export function getProjectDomains(project: string): string[] {
  const domains: Record<string, string[]> = {
    mina: ['docs.minaprotocol.com', 'github.com/o1-labs', 'minaprotocol.com'],
    solana: ['solana.com', 'docs.solana.com', 'anchor-lang.com', 'solanacookbook.com'],
    cosmos: ['docs.cosmos.network', 'tutorials.cosmos.network', 'github.com/cosmos'],
    ethereum: ['ethereum.org', 'docs.ethers.org', 'hardhat.org'],
  };
  return domains[project.toLowerCase()] || [];
}
