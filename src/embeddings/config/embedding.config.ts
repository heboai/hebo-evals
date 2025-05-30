import {
  EmbeddingConfig,
  OpenAIEmbeddingConfig,
  HeboEmbeddingConfig,
} from '../types/embedding.types.js';
import { OpenAIEmbeddingProvider } from '../implementations/openai-embedding-provider.js';
import { HeboEmbeddingProvider } from '../implementations/hebo-embedding-provider.js';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface.js';

/**
 * Configuration options for the embedding system
 */
export interface EmbeddingSystemConfig {
  /**
   * The default embedding provider to use
   */
  defaultProvider: 'openai' | 'hebo';

  /**
   * The model to use for embeddings
   */
  model: string;

  /**
   * Base URL for the embedding API
   */
  baseUrl?: string;

  /**
   * API key for the embedding provider
   */
  apiKey: string;
}

/**
 * Factory class for creating embedding providers
 */
export class EmbeddingProviderFactory {
  /**
   * Creates an embedding provider based on the configuration
   * @param config The embedding system configuration
   * @returns The created embedding provider
   * @throws Error if the configuration is invalid
   */
  static createProvider(config: EmbeddingSystemConfig): IEmbeddingProvider {
    const providerConfig = this.getProviderConfig(config);

    // Validate provider
    const provider = providerConfig.provider;
    if (!['openai', 'hebo'].includes(provider)) {
      throw new Error(
        `Configuration error: Unsupported embedding provider: ${String(provider)}. Supported providers are: openai, hebo`,
      );
    }

    // Validate API key
    if (!config.apiKey) {
      throw new Error(
        `Configuration error: API key is required for ${String(provider)} embedding provider`,
      );
    }

    switch (provider) {
      case 'openai':
        return new OpenAIEmbeddingProvider(
          providerConfig as OpenAIEmbeddingConfig,
          config.apiKey,
        );
      case 'hebo':
        return new HeboEmbeddingProvider(
          providerConfig as HeboEmbeddingConfig,
          config.apiKey,
        );
      default:
        throw new Error(
          `Configuration error: Unsupported provider: ${String(provider)}`,
        );
    }
  }

  /**
   * Gets the provider configuration based on the system configuration
   * @param config The embedding system configuration
   * @returns The provider configuration
   * @throws Error if the configuration is invalid
   */
  private static getProviderConfig(
    config: EmbeddingSystemConfig,
  ): EmbeddingConfig {
    const provider = config.defaultProvider;

    if (!config.model) {
      throw new Error('Embedding model is required');
    }

    return {
      provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    };
  }

  /**
   * Loads the configuration from environment variables
   * @returns The embedding system configuration
   */
  static loadFromEnv(): EmbeddingSystemConfig {
    const defaultProvider =
      (process.env.EMBEDDING_PROVIDER as 'openai' | 'hebo') || 'hebo';

    return {
      defaultProvider,
      model: process.env.EMBEDDING_MODEL || 'hebo-embeddings',
      baseUrl: process.env.EMBEDDING_BASE_URL || 'https://api.hebo.ai/v1',
      apiKey: process.env.EMBEDDING_API_KEY || process.env.HEBO_API_KEY || '',
    };
  }
}
