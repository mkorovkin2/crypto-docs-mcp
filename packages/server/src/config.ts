/**
 * ============================================================================
 * SERVER CONFIGURATION
 * ============================================================================
 *
 * ENVIRONMENT VARIABLES REFERENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * API KEYS (at least one required, except Bedrock uses AWS credentials):
 *   OPENAI_API_KEY      - OpenAI API key (for GPT models)
 *   ANTHROPIC_API_KEY   - Anthropic API key (for Claude models)
 *   XAI_API_KEY         - XAI API key (for Grok models)
 *   AWS_REGION          - AWS region for Bedrock (default: us-east-1)
 *   (Bedrock uses AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or IAM roles)
 *
 * LLM PROVIDER CONFIGURATION:
 *   LLM_PROVIDER        - Default provider for all LLM calls (openai|anthropic|xai|bedrock)
 *                         Auto-detected from available API keys if not set
 *
 *   Per-purpose overrides (optional):
 *   LLM_SYNTHESIS_PROVIDER    - Provider for answer synthesis
 *   LLM_EVALUATION_PROVIDER   - Provider for answer evaluation
 *   LLM_REFINEMENT_PROVIDER   - Provider for answer refinement
 *
 * LLM MODEL CONFIGURATION:
 *   LLM_MODEL                 - Default model for all purposes
 *   LLM_SYNTHESIS_MODEL       - Model for synthesis (see llm.ts for options)
 *   LLM_EVALUATION_MODEL      - Model for evaluation (smaller models work well)
 *   LLM_REFINEMENT_MODEL      - Model for refinement
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ RECOMMENDED MODEL CONFIGURATIONS                                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │ OPENAI (Balanced):                                                          │
 * │   LLM_SYNTHESIS_MODEL=gpt-4.1                                               │
 * │   LLM_EVALUATION_MODEL=gpt-4.1-mini    ← Fast & cheap for quality checks   │
 * │   LLM_REFINEMENT_MODEL=gpt-4.1                                              │
 * │                                                                             │
 * │ ANTHROPIC (Balanced):                                                       │
 * │   LLM_SYNTHESIS_MODEL=claude-sonnet-4-5-20250929                            │
 * │   LLM_EVALUATION_MODEL=claude-haiku-4-5-20251001  ← Fast & cheap           │
 * │   LLM_REFINEMENT_MODEL=claude-sonnet-4-5-20250929                           │
 * │                                                                             │
 * │ XAI (Balanced):                                                             │
 * │   LLM_SYNTHESIS_MODEL=grok-3                                                │
 * │   LLM_EVALUATION_MODEL=grok-3-mini     ← Fast & cheap                      │
 * │   LLM_REFINEMENT_MODEL=grok-3                                               │
 * │                                                                             │
 * │ BUDGET (All providers - uses smallest models):                              │
 * │   OpenAI: gpt-4.1-mini / gpt-4.1-nano / gpt-4.1-mini                       │
 * │   Anthropic: claude-haiku-4-5-20251001 for all                             │
 * │   XAI: grok-3-mini for all                                                 │
 * │                                                                             │
 * │ PREMIUM (Maximum quality):                                                  │
 * │   OpenAI: gpt-4.1 for all                                                  │
 * │   Anthropic: claude-opus-4-5-20251101 / claude-sonnet-4-5 / claude-opus    │
 * │   XAI: grok-4 / grok-3 / grok-4                                            │
 * │                                                                             │
 * │ BEDROCK (Kimi K2):                                                          │
 * │   LLM_PROVIDER=bedrock                                                      │
 * │   LLM_MODEL=moonshot.kimi-k2-thinking                                       │
 * │   AWS_REGION=us-east-1                                                      │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * LLM PARAMETERS:
 *   LLM_MAX_TOKENS             - Default max tokens (4000)
 *   LLM_TEMPERATURE            - Default temperature (0.3)
 *   LLM_SYNTHESIS_MAX_TOKENS   - Max tokens for synthesis (4000)
 *   LLM_EVALUATION_MAX_TOKENS  - Max tokens for evaluation (2000)
 *   LLM_REFINEMENT_MAX_TOKENS  - Max tokens for refinement (4000)
 *
 * WEB SEARCH (Tavily):
 *   TAVILY_API_KEY             - Enables web search in agentic loop
 *   TAVILY_SEARCH_DEPTH        - basic|advanced (default: basic)
 *   TAVILY_MAX_RESULTS         - Results per search (default: 5)
 *
 * AGENTIC EVALUATION:
 *   AGENTIC_EVALUATION_ENABLED     - true|false (default: true)
 *   AGENTIC_MAX_ITERATIONS         - Max evaluation loops (default: 3)
 *   AGENTIC_AUTO_RETURN_THRESHOLD  - Confidence % to skip evaluation (default: 85)
 *   AGENTIC_MAX_WEB_SEARCHES       - Max web searches per query (default: 2)
 *   AGENTIC_MAX_DOC_QUERIES        - Max additional doc queries (default: 2)
 *
 * SERVER:
 *   MCP_PORT            - Server port (default: 3000)
 *   MCP_HOST            - Server host (default: localhost)
 *   QDRANT_URL          - Qdrant vector DB URL (default: http://localhost:6333)
 *   QDRANT_COLLECTION   - Qdrant collection name (default: crypto_docs)
 *   SQLITE_PATH         - SQLite DB path (default: ./data/crypto_docs.db)
 *
 * ============================================================================
 */

// Load environment variables from repo root .env file
import '@mina-docs/shared/load-env';
import type { LLMProvider } from '@mina-docs/shared';

/**
 * Parse LLM provider from environment variable
 */
function parseProvider(envValue: string | undefined, defaultProvider: LLMProvider): LLMProvider {
  if (!envValue) return defaultProvider;
  const normalized = envValue.toLowerCase().trim();
  if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'xai' || normalized === 'bedrock') {
    return normalized;
  }
  console.warn(`Unknown LLM provider "${envValue}", defaulting to ${defaultProvider}`);
  return defaultProvider;
}

/**
 * Check if AWS credentials are available for Bedrock
 */
function hasAWSCredentials(): boolean {
  // AWS SDK auto-detects from env vars, instance metadata, etc.
  return !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN);
}

/**
 * Determine default provider based on available API keys
 */
function getDefaultProvider(): LLMProvider {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.XAI_API_KEY) return 'xai';
  if (hasAWSCredentials()) return 'bedrock';
  return 'openai'; // Default, will fail at validation if no key
}

const defaultProvider = getDefaultProvider();

export const config = {
  port: parseInt(process.env.MCP_PORT || '3000'),
  host: process.env.MCP_HOST || 'localhost',

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'crypto_docs'
  },

  sqlite: {
    path: process.env.SQLITE_PATH || './data/crypto_docs.db'
  },

  // API Keys for all providers
  apiKeys: {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    xai: process.env.XAI_API_KEY || ''
  },

  // AWS configuration for Bedrock
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    // Bedrock uses AWS SDK credential chain (env vars, profiles, IAM roles)
  },

  // LLM configuration for synthesis (main answer generation)
  llmSynthesis: {
    provider: parseProvider(
      process.env.LLM_SYNTHESIS_PROVIDER || process.env.LLM_PROVIDER,
      defaultProvider
    ),
    model: process.env.LLM_SYNTHESIS_MODEL || process.env.LLM_MODEL || '',
    maxTokens: parseInt(process.env.LLM_SYNTHESIS_MAX_TOKENS || process.env.LLM_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.LLM_SYNTHESIS_TEMPERATURE || process.env.LLM_TEMPERATURE || '0.3')
  },

  // LLM configuration for evaluation (answer quality assessment)
  llmEvaluation: {
    provider: parseProvider(
      process.env.LLM_EVALUATION_PROVIDER || process.env.LLM_PROVIDER,
      defaultProvider
    ),
    model: process.env.LLM_EVALUATION_MODEL || '',
    maxTokens: parseInt(process.env.LLM_EVALUATION_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.LLM_EVALUATION_TEMPERATURE || '0.2')
  },

  // LLM configuration for refinement (answer improvement)
  llmRefinement: {
    provider: parseProvider(
      process.env.LLM_REFINEMENT_PROVIDER || process.env.LLM_PROVIDER,
      defaultProvider
    ),
    model: process.env.LLM_REFINEMENT_MODEL || '',
    maxTokens: parseInt(process.env.LLM_REFINEMENT_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.LLM_REFINEMENT_TEMPERATURE || '0.3')
  },

  // LLM configuration for web result analysis (parallel relevance filtering)
  // Uses a fast model to analyze each web result in parallel before refinement
  llmAnalyzer: {
    provider: parseProvider(
      process.env.LLM_ANALYZER_PROVIDER || process.env.LLM_PROVIDER,
      defaultProvider
    ),
    model: process.env.LLM_ANALYZER_MODEL || process.env.LLM_EVALUATION_MODEL || '', // Default to eval model (fast)
    maxTokens: parseInt(process.env.LLM_ANALYZER_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.LLM_ANALYZER_TEMPERATURE || '0.1')
  },

  // Tavily web search configuration (optional)
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    searchDepth: (process.env.TAVILY_SEARCH_DEPTH as 'basic' | 'advanced') || 'basic',
    maxResults: parseInt(process.env.TAVILY_MAX_RESULTS || '5')
  },

  // Agentic evaluation loop configuration
  agenticEvaluation: {
    enabled: process.env.AGENTIC_EVALUATION_ENABLED !== 'false', // Enabled by default
    maxIterations: parseInt(process.env.AGENTIC_MAX_ITERATIONS || '3'),
    autoReturnConfidenceThreshold: parseInt(process.env.AGENTIC_AUTO_RETURN_THRESHOLD || '85'),
    maxWebSearches: parseInt(process.env.AGENTIC_MAX_WEB_SEARCHES || '2'),
    maxDocQueries: parseInt(process.env.AGENTIC_MAX_DOC_QUERIES || '2')
  }
};

/**
 * Get the API key for a specific provider
 * Note: Bedrock doesn't use API keys - returns empty string
 */
export function getApiKeyForProvider(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return config.apiKeys.openai;
    case 'anthropic':
      return config.apiKeys.anthropic;
    case 'xai':
      return config.apiKeys.xai;
    case 'bedrock':
      return ''; // Bedrock uses AWS credentials, not API key
    default:
      return '';
  }
}

/**
 * Check if a provider has valid credentials configured
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === 'bedrock') {
    return hasAWSCredentials();
  }
  return !!getApiKeyForProvider(provider);
}

/**
 * Validate that at least one LLM provider is configured
 */
export function validateConfig(): void {
  const hasOpenAI = !!config.apiKeys.openai;
  const hasAnthropic = !!config.apiKeys.anthropic;
  const hasXAI = !!config.apiKeys.xai;
  const hasBedrock = hasAWSCredentials();

  if (!hasOpenAI && !hasAnthropic && !hasXAI && !hasBedrock) {
    throw new Error(
      'At least one LLM provider is required. Set one of:\n' +
      '  - OPENAI_API_KEY for OpenAI\n' +
      '  - ANTHROPIC_API_KEY for Anthropic\n' +
      '  - XAI_API_KEY for XAI (Grok)\n' +
      '  - AWS credentials for Bedrock (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or IAM role)'
    );
  }

  // Validate that the configured providers have credentials
  const providers = [
    { name: 'synthesis', provider: config.llmSynthesis.provider },
    { name: 'evaluation', provider: config.llmEvaluation.provider },
    { name: 'refinement', provider: config.llmRefinement.provider },
    { name: 'analyzer', provider: config.llmAnalyzer.provider },
  ];

  for (const { name, provider } of providers) {
    if (!isProviderConfigured(provider)) {
      if (provider === 'bedrock') {
        throw new Error(
          `LLM ${name} is configured to use Bedrock, but no AWS credentials found.\n` +
          `Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or use an IAM role.`
        );
      }
      throw new Error(
        `LLM ${name} is configured to use ${provider}, but no API key is set.\n` +
        `Set ${provider.toUpperCase()}_API_KEY or change LLM_${name.toUpperCase()}_PROVIDER.`
      );
    }
  }
}

/**
 * Get a summary of configured providers for logging
 */
export function getProviderSummary(): string {
  const parts: string[] = [];

  parts.push(`Synthesis: ${config.llmSynthesis.provider}` +
    (config.llmSynthesis.model ? ` (${config.llmSynthesis.model})` : ''));

  parts.push(`Evaluation: ${config.llmEvaluation.provider}` +
    (config.llmEvaluation.model ? ` (${config.llmEvaluation.model})` : ''));

  parts.push(`Refinement: ${config.llmRefinement.provider}` +
    (config.llmRefinement.model ? ` (${config.llmRefinement.model})` : ''));

  parts.push(`Analyzer: ${config.llmAnalyzer.provider}` +
    (config.llmAnalyzer.model ? ` (${config.llmAnalyzer.model})` : ''));

  return parts.join(', ');
}
