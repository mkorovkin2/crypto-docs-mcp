import OpenAI from 'openai';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SynthesisOptions {
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TEMPERATURE = 0.3;

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_MODEL;
    this.defaultMaxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
    this.defaultTemperature = config.temperature || DEFAULT_TEMPERATURE;
  }

  async synthesize(
    systemPrompt: string,
    userPrompt: string,
    options: SynthesisOptions = {}
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: options.maxTokens || this.defaultMaxTokens,
      temperature: options.temperature || this.defaultTemperature
    });

    return response.choices[0]?.message?.content || '';
  }
}
