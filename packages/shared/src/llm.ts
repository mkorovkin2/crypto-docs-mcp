/**
 * Multi-Provider LLM Client
 *
 * Supports OpenAI, Anthropic, XAI (OpenAI-compatible), and AWS Bedrock for LLM calls.
 * Provider can be configured per-client instance.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime';

// Timestamped logger for LLM client
const getTimestamp = () => new Date().toISOString();
const llmLog = {
  info: (msg: string, startTime?: number) => {
    const elapsed = startTime ? ` [+${Date.now() - startTime}ms]` : '';
    console.log(`[${getTimestamp()}] [LLM]${elapsed} ${msg}`);
  },
  debug: (msg: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${getTimestamp()}] [LLM] ${msg}`);
    }
  },
  step: (stepName: string, durationMs: number) => {
    console.log(`[${getTimestamp()}] [LLM] ✓ ${stepName} completed in ${durationMs}ms`);
  },
  warn: (msg: string) => {
    console.log(`[${getTimestamp()}] [LLM] ⚠ ${msg}`);
  },
  error: (msg: string) => {
    console.error(`[${getTimestamp()}] [LLM] ✗ ${msg}`);
  },
};

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'xai' | 'bedrock';

/**
 * Configuration for the LLM client
 */
export interface LLMConfig {
  provider: LLMProvider;
  /** API key (not needed for Bedrock - uses AWS credentials) */
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** AWS region for Bedrock (default: us-east-1) */
  awsRegion?: string;
}

/**
 * Options for synthesis calls
 */
export interface SynthesisOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Default models for each provider
 * These are balanced choices for general-purpose use
 */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5-20250929',
  xai: 'grok-3',
  bedrock: 'moonshot.kimi-k2-thinking',
};

/**
 * XAI API base URL (OpenAI-compatible)
 */
const XAI_BASE_URL = 'https://api.x.ai/v1';

const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.3;

/**
 * Multi-provider LLM client
 */
export class LLMClient {
  private provider: LLMProvider;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private bedrockClient?: BedrockRuntimeClient;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.model = config.model || DEFAULT_MODELS[config.provider];
    this.defaultMaxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
    this.defaultTemperature = config.temperature || DEFAULT_TEMPERATURE;

    // Initialize the appropriate client
    switch (config.provider) {
      case 'openai':
        this.openaiClient = new OpenAI({ apiKey: config.apiKey });
        break;

      case 'anthropic':
        this.anthropicClient = new Anthropic({ apiKey: config.apiKey });
        break;

      case 'xai':
        // XAI uses OpenAI-compatible API with different base URL
        this.openaiClient = new OpenAI({
          apiKey: config.apiKey,
          baseURL: XAI_BASE_URL,
        });
        break;

      case 'bedrock':
        // Bedrock uses AWS credentials from environment/config
        this.bedrockClient = new BedrockRuntimeClient({
          region: config.awsRegion || process.env.AWS_REGION || 'us-east-1',
        });
        break;
    }
  }

  /**
   * Get the provider being used
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get the model being used
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Synthesize a response from system and user prompts
   */
  async synthesize(
    systemPrompt: string,
    userPrompt: string,
    options: SynthesisOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const temperature = options.temperature || this.defaultTemperature;

    llmLog.debug(`Synthesize request: provider=${this.provider}, model=${this.model}`);
    llmLog.debug(`Options: maxTokens=${maxTokens}, temperature=${temperature}`);
    llmLog.debug(`System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);

    try {
      let result: string;

      switch (this.provider) {
        case 'openai':
        case 'xai':
          result = await this.synthesizeOpenAI(systemPrompt, userPrompt, maxTokens, temperature);
          break;

        case 'anthropic':
          result = await this.synthesizeAnthropic(systemPrompt, userPrompt, maxTokens, temperature);
          break;

        case 'bedrock':
          result = await this.synthesizeBedrock(systemPrompt, userPrompt, maxTokens, temperature);
          break;

        default:
          throw new Error(`Unknown provider: ${this.provider}`);
      }

      llmLog.debug(`Response received: ${result.length} chars`);
      llmLog.debug(`${this.provider}/${this.model} synthesis completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      llmLog.error(`Synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * OpenAI/XAI synthesis (both use OpenAI SDK)
   */
  private async synthesizeOpenAI(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const callStart = Date.now();
    llmLog.debug(`OpenAI API call starting (model=${this.model})...`);

    const response = await this.openaiClient.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;
    llmLog.debug(`OpenAI API call completed in ${Date.now() - callStart}ms`);
    if (usage) {
      llmLog.debug(`Token usage: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
    }

    return content;
  }

  /**
   * Anthropic synthesis
   */
  private async synthesizeAnthropic(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const callStart = Date.now();
    llmLog.debug(`Anthropic API call starting (model=${this.model})...`);

    const response = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      temperature,
    });

    // Extract text from the response
    const textContent = response.content.find(block => block.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    llmLog.debug(`Anthropic API call completed in ${Date.now() - callStart}ms`);
    llmLog.debug(`Token usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);
    llmLog.debug(`Stop reason: ${response.stop_reason}`);

    return content;
  }

  /**
   * AWS Bedrock synthesis (for Kimi K2 and other Bedrock models)
   * Uses the Converse API for cross-model compatibility
   */
  private async synthesizeBedrock(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!this.bedrockClient) {
      throw new Error('Bedrock client not initialized');
    }

    const callStart = Date.now();
    llmLog.debug(`Bedrock API call starting (model=${this.model})...`);

    const messages: BedrockMessage[] = [
      {
        role: 'user',
        content: [{ text: userPrompt }],
      },
    ];

    const command = new ConverseCommand({
      modelId: this.model,
      system: [{ text: systemPrompt }],
      messages,
      inferenceConfig: {
        maxTokens,
        temperature,
      },
    });

    const response = await this.bedrockClient.send(command);

    llmLog.debug(`Bedrock API call completed in ${Date.now() - callStart}ms`);
    if (response.usage) {
      llmLog.debug(`Token usage: input=${response.usage.inputTokens}, output=${response.usage.outputTokens}, total=${response.usage.totalTokens}`);
    }
    llmLog.debug(`Stop reason: ${response.stopReason}`);

    // Extract text from Bedrock response
    // For thinking models (like Kimi K2), content has: [reasoningContent, text]
    // For regular models, content has: [text]
    const output = response.output;
    if (output?.message?.content) {
      // Look through all content blocks for text
      for (const block of output.message.content) {
        // Direct text block
        if ('text' in block && typeof (block as { text: string }).text === 'string') {
          const text = (block as { text: string }).text;
          if (text.trim()) {
            return text;
          }
        }
      }
    }

    llmLog.warn('Bedrock response contained no text content');
    return '';
  }
}

/**
 * Create an LLM client from environment-based config
 * Convenience factory for common use cases
 */
export function createLLMClient(config: {
  provider: LLMProvider;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  xaiApiKey?: string;
  awsRegion?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): LLMClient {
  let apiKey: string | undefined;

  switch (config.provider) {
    case 'openai':
      apiKey = config.openaiApiKey || '';
      if (!apiKey) throw new Error('OpenAI API key required for openai provider');
      break;

    case 'anthropic':
      apiKey = config.anthropicApiKey || '';
      if (!apiKey) throw new Error('Anthropic API key required for anthropic provider');
      break;

    case 'xai':
      apiKey = config.xaiApiKey || '';
      if (!apiKey) throw new Error('XAI API key required for xai provider');
      break;

    case 'bedrock':
      // Bedrock uses AWS credentials from environment, no API key needed
      apiKey = undefined;
      break;

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  return new LLMClient({
    provider: config.provider,
    apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    awsRegion: config.awsRegion,
  });
}

/**
 * ============================================================================
 * ELIGIBLE MODELS BY PROVIDER
 * ============================================================================
 *
 * OPENAI MODELS (as of Jan 2025):
 * ──────────────────────────────────────────────────────────────────────────────
 * GPT-4.1 Series (Recommended):
 *   - gpt-4.1          : Latest flagship, best quality ($2.50/1M in, $10/1M out)
 *   - gpt-4.1-mini     : Fast & affordable, great for evaluation ($0.40/1M in, $1.60/1M out)
 *   - gpt-4.1-nano     : Fastest, cheapest, simple tasks only
 *
 * GPT-4o Series (Legacy but still available):
 *   - gpt-4o           : Previous flagship, still excellent
 *   - gpt-4o-mini      : Previous mini model
 *
 * o-Series (Reasoning, higher cost):
 *   - o3               : Advanced reasoning model
 *   - o4-mini          : Fast reasoning, excellent for math/coding
 *
 * Context: GPT-4.1 supports up to 1M tokens
 *
 * ANTHROPIC MODELS (as of Jan 2025):
 * ──────────────────────────────────────────────────────────────────────────────
 * Claude 4.5 Series (Current - Recommended):
 *   - claude-sonnet-4-5-20250929  : Best balance of speed/quality ($3/1M in, $15/1M out) ⭐
 *   - claude-haiku-4-5-20251001   : Fastest, great for evaluation ($1/1M in, $5/1M out)
 *   - claude-opus-4-5-20251101    : Maximum quality ($5/1M in, $25/1M out)
 *
 * Claude 4 Series (Legacy):
 *   - claude-sonnet-4-20250514    : Previous sonnet
 *   - claude-opus-4-20250514      : Previous opus
 *   - claude-opus-4-1-20250805    : Opus 4.1 for agentic tasks
 *
 * Aliases (auto-update to latest):
 *   - claude-sonnet-4-5           : Points to latest Sonnet 4.5
 *   - claude-haiku-4-5            : Points to latest Haiku 4.5
 *   - claude-opus-4-5             : Points to latest Opus 4.5
 *
 * Context: 200K tokens standard, 1M tokens available for Sonnet 4.5 (beta)
 * All 4.5 models support extended thinking mode
 *
 * XAI/GROK MODELS (as of Jan 2025):
 * ──────────────────────────────────────────────────────────────────────────────
 * Grok 4 Series (Latest):
 *   - grok-4                      : Latest flagship reasoning model
 *   - grok-4-fast-reasoning       : Faster variant with reasoning
 *   - grok-4-fast-non-reasoning   : Fast without extended reasoning
 *
 * Grok 3 Series (Stable - Recommended for non-reasoning):
 *   - grok-3                      : Stable flagship ($3/1M in, $15/1M out) ⭐
 *   - grok-3-mini                 : Smaller, faster, cheaper ($0.30/1M in, $0.50/1M out)
 *
 * Grok 2 Series (Legacy):
 *   - grok-2-1212                 : Previous generation
 *   - grok-2-vision-1212          : With vision support
 *
 * Context: 131K tokens for Grok 3/4
 * Note: Grok 4 is reasoning-only (no non-reasoning mode)
 *
 * AWS BEDROCK MODELS (as of Jan 2025):
 * ──────────────────────────────────────────────────────────────────────────────
 * Kimi K2 (Moonshot):
 *   - moonshot.kimi-k2-thinking   : Kimi K2 with extended thinking ⭐
 *
 * Other Bedrock Models (use provider-specific format):
 *   - anthropic.claude-3-5-sonnet-20241022-v2:0  : Claude on Bedrock
 *   - amazon.nova-pro-v1:0                       : Amazon Nova Pro
 *   - meta.llama3-1-405b-instruct-v1:0          : Llama 3.1 405B
 *
 * Authentication: Uses AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * or IAM roles. No API key needed - set AWS_REGION instead.
 *
 * ============================================================================
 */

/**
 * Recommended models for different use cases
 *
 * SYNTHESIS: Main answer generation - needs highest quality
 * EVALUATION: Quality assessment - can be smaller/faster, cost-efficient
 * REFINEMENT: Answer improvement - good quality but can be slightly lighter
 */
export const RECOMMENDED_MODELS = {
  openai: {
    /** GPT-4.1 for comprehensive, accurate answers */
    synthesis: 'gpt-4.1',
    /** GPT-4.1-mini: Fast, cheap, good enough for yes/no quality checks */
    evaluation: 'gpt-4.1-mini',
    /** GPT-4.1 for high-quality refinements */
    refinement: 'gpt-4.1',
  },
  anthropic: {
    /** Sonnet 4.5: Best balance of quality and cost for synthesis */
    synthesis: 'claude-sonnet-4-5-20250929',
    /** Haiku 4.5: Fast and cheap, perfect for evaluation checks */
    evaluation: 'claude-haiku-4-5-20251001',
    /** Sonnet 4.5: Good quality for refinement at reasonable cost */
    refinement: 'claude-sonnet-4-5-20250929',
  },
  xai: {
    /** Grok-3: Stable, high quality for synthesis */
    synthesis: 'grok-3',
    /** Grok-3-mini: Fast and cheap for evaluation */
    evaluation: 'grok-3-mini',
    /** Grok-3: Good quality for refinement */
    refinement: 'grok-3',
  },
  bedrock: {
    /** Kimi K2: Extended thinking for deep reasoning */
    synthesis: 'moonshot.kimi-k2-thinking',
    /** Kimi K2: Also good for evaluation */
    evaluation: 'moonshot.kimi-k2-thinking',
    /** Kimi K2: Good for refinement */
    refinement: 'moonshot.kimi-k2-thinking',
  },
} as const;

/**
 * Cost-optimized model recommendations (when budget is a concern)
 */
export const BUDGET_MODELS = {
  openai: {
    synthesis: 'gpt-4.1-mini',
    evaluation: 'gpt-4.1-nano',
    refinement: 'gpt-4.1-mini',
  },
  anthropic: {
    synthesis: 'claude-haiku-4-5-20251001',
    evaluation: 'claude-haiku-4-5-20251001',
    refinement: 'claude-haiku-4-5-20251001',
  },
  xai: {
    synthesis: 'grok-3-mini',
    evaluation: 'grok-3-mini',
    refinement: 'grok-3-mini',
  },
  bedrock: {
    synthesis: 'moonshot.kimi-k2-thinking',
    evaluation: 'moonshot.kimi-k2-thinking',
    refinement: 'moonshot.kimi-k2-thinking',
  },
} as const;

/**
 * Premium model recommendations (when quality is paramount)
 */
export const PREMIUM_MODELS = {
  openai: {
    synthesis: 'gpt-4.1',
    evaluation: 'gpt-4.1',
    refinement: 'gpt-4.1',
  },
  anthropic: {
    synthesis: 'claude-opus-4-5-20251101',
    evaluation: 'claude-sonnet-4-5-20250929',
    refinement: 'claude-opus-4-5-20251101',
  },
  xai: {
    synthesis: 'grok-4',
    evaluation: 'grok-3',
    refinement: 'grok-4',
  },
  bedrock: {
    synthesis: 'moonshot.kimi-k2-thinking',
    evaluation: 'moonshot.kimi-k2-thinking',
    refinement: 'moonshot.kimi-k2-thinking',
  },
} as const;
