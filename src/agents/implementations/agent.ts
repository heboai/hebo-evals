import { AgentConfig, AgentInput, AgentOutput } from '../types/agent.types.js';
import { IAgent } from '../interfaces/agent.interface.js';
import { Logger } from '../../utils/logger.js';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getProviderFromModel } from '../../utils/provider-mapping.js';
import { getProviderBaseUrl } from '../../config/utils/provider-config.js';
import { ConfigLoader } from '../../config/config.loader.js';
import { ProviderType } from '../../config/types/config.types.js';

/**
 * Options for creating an agent instance
 */
export interface AgentOptions {
  /**
   * API key for authentication. If not provided, will attempt to load from config
   */
  apiKey?: string;

  /**
   * Path to configuration file
   */
  configPath?: string;

  /**
   * Base URL override for the provider
   */
  baseUrl?: string;
}

/**
 * Simplified agent implementation using the Vercel AI SDK with OpenAI-compatible endpoints
 * Handles all model types (OpenAI, Hebo, and custom models) with smart configuration resolution
 */
export class Agent implements IAgent {
  private config: AgentConfig;
  private provider: ReturnType<typeof createOpenAI>;

  constructor(model: string, options: AgentOptions = {}) {
    // Get the config loader singleton
    const configLoader = ConfigLoader.getInstance();

    // Initialize config loader if config path is provided
    if (options.configPath) {
      configLoader.initialize(options.configPath);
    } else if (!configLoader.isInitialized()) {
      configLoader.initialize();
    }

    // Parse model to determine provider and clean model name
    const { provider, modelName } = getProviderFromModel(model);

    // Resolve provider name for custom providers
    let providerName: string = provider;
    if (provider === ProviderType.CUSTOM) {
      const config = configLoader.getConfig();
      const customProvider = Object.entries(config.providers || {}).find(
        ([_, config]) => config.provider === ProviderType.CUSTOM,
      );
      if (!customProvider) {
        throw new Error('No custom provider configuration found');
      }
      providerName = customProvider[0];
    }

    // Resolve API key from options or config
    let apiKey = options.apiKey;
    if (!apiKey) {
      try {
        apiKey = configLoader.getProviderApiKey(providerName);
      } catch {
        // If provider config is not found, apiKey will remain undefined
        // and we'll throw a more helpful error below
      }
    }

    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        `API key not found. Please provide it via options or set it in the configuration file for provider: ${providerName}`,
      );
    }

    // Resolve base URL
    const baseUrl = options.baseUrl || getProviderBaseUrl(providerName);

    // Build the configuration
    this.config = {
      model: modelName,
      apiKey,
      baseUrl,
      provider: providerName,
      configPath: options.configPath,
    };

    // Validate provider-key combination
    this.validateProviderKeyMatch(this.config.provider, this.config.apiKey);

    // Create the provider instance
    this.provider = this.createProvider();
  }

  /**
   * Validates that the API key matches the provider
   */
  private validateProviderKeyMatch(provider: string, apiKey: string): void {
    if (provider.toLowerCase() === 'hebo' && apiKey.startsWith('sk-')) {
      throw new Error(
        `Configuration error: You are using an OpenAI API key (starts with 'sk-') with the Hebo provider. Please use a Hebo API key or switch to the OpenAI provider.`,
      );
    }

    if (provider.toLowerCase() === 'openai' && !apiKey.startsWith('sk-')) {
      throw new Error(
        `Configuration error: You are using a non-OpenAI API key with the OpenAI provider. Please use an OpenAI API key (starts with 'sk-') or switch to the Hebo provider.`,
      );
    }
  }

  /**
   * Creates an OpenAI-compatible provider instance using Vercel AI SDK
   */
  private createProvider() {
    // Set base URL based on provider
    let baseUrl: string;
    if (this.config.provider === 'hebo') {
      baseUrl = this.config.baseUrl || 'https://app.hebo.ai';
    } else if (this.config.provider === 'openai') {
      baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    } else {
      // For custom providers, use the provided baseUrl or default to OpenAI
      baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    }

    return createOpenAI({
      name: this.config.provider,
      baseURL: baseUrl,
      apiKey: this.config.apiKey,
      compatibility: 'compatible',
    });
  }

  /**
   * Gets the configuration of the agent
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Sends input to the agent and receives its response using the OpenAI Responses API
   */
  async sendInput(input: AgentInput): Promise<AgentOutput> {
    try {
      // Use the OpenAI Responses API via Vercel AI SDK
      const result = await generateText({
        model: this.provider.responses(this.config.model),
        messages: input.messages,
        temperature: 1.0,
      });

      return {
        response: result.text,
        metadata: {
          model: this.config.model,
          provider: this.config.provider,
          usage: result.usage,
          response: result.response,
        },
      };
    } catch (error) {
      Logger.error(
        `Error processing input: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cleans up any resources used by the agent
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for this simple implementation
  }
}
