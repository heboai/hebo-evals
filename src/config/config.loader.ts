import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { Logger } from '../utils/logger.js';
import {
  HeboEvalsConfig,
  HeboEvalsConfigSchema,
  ProviderConfig,
  DEFAULT_CONFIG,
  ProviderType,
} from './types/config.types.js';
import { interpolateEnvVarsInObject } from './utils/interpolate.js';
import { join } from 'path';

/**
 * Configuration loader for Hebo Eval
 * Handles loading and validating configuration from YAML files
 */
export class ConfigLoader {
  private config: HeboEvalsConfig;
  private static instance: ConfigLoader;
  private _isInitialized: boolean = false;

  private constructor() {
    this.config = DEFAULT_CONFIG as HeboEvalsConfig;
  }

  /**
   * Gets the singleton instance of the ConfigLoader
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Checks if the configuration loader is initialized
   * @returns True if the configuration loader is initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Initializes the configuration loader with a configuration file
   * @param path Optional path to the configuration file. If not provided, tries to load from default location
   * @throws Error if the configuration cannot be loaded or is invalid
   */
  public initialize(path?: string): void {
    // If already initialized but no new path provided, do nothing
    if (this._isInitialized && !path) {
      return;
    }

    try {
      const configPath = path || join(process.cwd(), 'hebo-evals.config.yaml');
      this.loadConfig(configPath);
      this._isInitialized = true;
    } catch (error) {
      // If no path was provided and loading from default location failed, use default config
      if (!path) {
        Logger.warn(
          'Failed to load configuration from default location, using default configuration',
        );
        this.config = DEFAULT_CONFIG as HeboEvalsConfig;
        this._isInitialized = true;
        return;
      }
      throw error;
    }
  }

  /**
   * Loads configuration from a YAML file
   * @param path Path to the configuration file
   * @throws Error if the file cannot be read or if the configuration is invalid
   */
  private loadConfig(path: string): void {
    try {
      const fileContents = readFileSync(path, 'utf8');
      const parsedConfig = parse(fileContents) as Partial<HeboEvalsConfig>;

      // Merge with default config, ensuring providers are properly merged
      const mergedConfig: Partial<HeboEvalsConfig> = {
        ...DEFAULT_CONFIG,
        ...parsedConfig,
        providers: {
          ...DEFAULT_CONFIG.providers,
          ...parsedConfig.providers,
        },
        embedding: {
          provider: ProviderType.OPENAI,
          model: (DEFAULT_CONFIG as HeboEvalsConfig).embedding!.model,
          ...parsedConfig.embedding,
        },
      };

      // Interpolate environment variables
      const interpolatedConfig = interpolateEnvVarsInObject(mergedConfig);

      // Validate configuration
      try {
        const validatedConfig = HeboEvalsConfigSchema.parse(interpolatedConfig);
        this.config = validatedConfig;
        Logger.debug('Configuration loaded successfully');
      } catch {
        // If validation fails, try to load with environment variables
        const envConfig: Partial<HeboEvalsConfig> = {
          ...interpolatedConfig,
          providers: {
            [ProviderType.OPENAI]: {
              provider: ProviderType.OPENAI,
              model: (DEFAULT_CONFIG as HeboEvalsConfig).providers![
                ProviderType.OPENAI
              ].model,
              ...interpolatedConfig.providers?.[ProviderType.OPENAI],
              apiKey: process.env.OPENAI_API_KEY,
            },
            [ProviderType.HEBO]: {
              provider: ProviderType.HEBO,
              model: (DEFAULT_CONFIG as HeboEvalsConfig).providers![
                ProviderType.HEBO
              ].model,
              ...interpolatedConfig.providers?.[ProviderType.HEBO],
              apiKey: process.env.HEBO_API_KEY,
            },
          },
          embedding: {
            provider: ProviderType.OPENAI,
            model: (DEFAULT_CONFIG as HeboEvalsConfig).embedding!.model,
            ...interpolatedConfig.embedding,
            apiKey: process.env.OPENAI_API_KEY || process.env.HEBO_API_KEY,
          },
        };

        const validatedEnvConfig = HeboEvalsConfigSchema.parse(envConfig);
        this.config = validatedEnvConfig;
        Logger.debug('Configuration loaded with environment variables');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validates a model-provider combination
   * @param model The model name
   * @param provider The provider name
   * @throws Error if the combination is invalid
   */
  public validateModelProvider(model: string, provider: string): void {
    const modelLower = model.toLowerCase();
    const providerLower = provider.toLowerCase();

    // Validate custom provider models
    if (providerLower === 'custom') {
      if (!modelLower.startsWith('custom-')) {
        throw new Error(
          `Configuration error: Custom provider models must start with 'custom-'. Received: ${model}`,
        );
      }
      return;
    }

    // Validate OpenAI models
    if (providerLower === 'openai') {
      if (
        !/^(gpt-|o\d+(?:-mini|-nano|-turbo|-high)?|text-|dall-e-|whisper-)/i.test(
          modelLower,
        )
      ) {
        throw new Error(
          `Configuration error: OpenAI model '${model}' is not supported. Please refer to the OpenAI docs for valid model names.`,
        );
      }
    }

    // Validate Hebo models
    if (providerLower === 'hebo') {
      if (!modelLower.includes(':')) {
        throw new Error(
          `Configuration error: Hebo models must be in the format 'name:version' (e.g., 'gato:v1'). Received: ${model}`,
        );
      }
    }

    // Validate model-provider combination
    if (modelLower.startsWith('gpt-') && providerLower !== 'openai') {
      throw new Error(
        `Configuration error: Model ${model} requires OpenAI provider, but ${provider} was specified`,
      );
    }
  }

  /**
   * Gets the configuration for a specific provider
   * @param provider The provider name
   * @returns The provider configuration
   * @throws Error if the provider configuration is not found
   */
  public getProviderConfig(provider: string): ProviderConfig {
    const providerKey = provider.toLowerCase();

    // For custom providers, look for a provider that has provider: 'custom'
    if (providerKey === 'custom') {
      const customProvider = Object.entries(this.config.providers || {}).find(
        ([_, config]) => config.provider === 'custom',
      );
      if (!customProvider) {
        throw new Error(`Provider configuration not found: ${providerKey}`);
      }
      return customProvider[1];
    }

    // For other providers, look for exact match
    const providerConfig = this.config.providers?.[provider];
    if (!providerConfig) {
      throw new Error(`Provider configuration not found: ${providerKey}`);
    }
    return providerConfig;
  }

  /**
   * Gets the base URL for a provider
   * @param provider The provider name
   * @returns The base URL for the provider
   * @throws Error if the provider configuration is not found
   */
  public getProviderBaseUrl(provider: string): string {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig.baseUrl) {
      throw new Error(`Base URL not configured for provider: ${provider}`);
    }
    return providerConfig.baseUrl;
  }

  /**
   * Gets the API key for a provider
   * @param provider The provider name
   * @returns The API key for the provider
   * @throws Error if the provider configuration is not found or if the API key is not set
   */
  public getProviderApiKey(provider: string): string {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig.apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }
    return providerConfig.apiKey;
  }

  /**
   * Gets the authentication header configuration for a provider
   * @param provider The provider name
   * @returns The authentication header configuration
   */
  public getProviderAuthHeader(
    provider: string,
  ): { name: string; format: string } | undefined {
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig.authHeader;
  }

  /**
   * Gets the default provider name
   * @returns The default provider name
   */
  public getDefaultProvider(): string {
    return this.config.defaultProvider || 'hebo';
  }

  /**
   * Gets the entire configuration
   * @returns The complete configuration
   */
  public getConfig(): HeboEvalsConfig {
    return this.config;
  }

  /**
   * Validates the configuration for a specific provider
   * @param provider The provider name
   * @throws Error if the provider configuration is invalid
   */
  public validateProviderConfig(provider: string): void {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig.apiKey) {
      // Try to get API key from environment variables as fallback
      const envApiKey = this.getApiKeyFromEnv(provider);
      if (!envApiKey) {
        throw new Error(
          `API key not configured for provider: ${provider}. Please set the ${
            provider === ProviderType.OPENAI
              ? 'OPENAI_API_KEY'
              : provider === ProviderType.HEBO
                ? 'HEBO_API_KEY'
                : 'ANTHROPIC_API_KEY'
          } environment variable or provide it in the configuration file.`,
        );
      }
      providerConfig.apiKey = envApiKey;
    }
  }

  /**
   * Validates the embedding configuration
   * @param provider The provider name
   * @throws Error if the embedding configuration is invalid
   */
  public validateEmbeddingConfig(provider: string): void {
    const embeddingConfig = this.config.embedding;
    if (!embeddingConfig) {
      throw new Error('Embedding configuration is required');
    }

    if (!embeddingConfig.apiKey) {
      // Try to get API key from environment variables as fallback
      const envApiKey = this.getApiKeyFromEnv(provider);
      if (!envApiKey) {
        throw new Error(
          `API key not configured for embedding provider: ${provider}. Please set the ${
            provider === ProviderType.OPENAI
              ? 'OPENAI_API_KEY'
              : provider === ProviderType.HEBO
                ? 'HEBO_API_KEY'
                : 'ANTHROPIC_API_KEY'
          } environment variable or provide it in the configuration file.`,
        );
      }
      embeddingConfig.apiKey = envApiKey;
    }
  }

  /**
   * Gets the API key for a provider from environment variables
   * @param provider The provider name
   * @returns The API key or undefined if not found
   */
  private getApiKeyFromEnv(provider: string): string | undefined {
    const envVarMap = {
      [ProviderType.OPENAI]: 'OPENAI_API_KEY',
      [ProviderType.HEBO]: 'HEBO_API_KEY',
      [ProviderType.ANTHROPIC]: 'ANTHROPIC_API_KEY',
    };
    return process.env[envVarMap[provider as keyof typeof envVarMap]];
  }
}
