import {
  EmbeddingConfig,
  LiteLLMEmbeddingConfig,
  OpenAIEmbeddingConfig,
} from '../types/embedding.types.js';
import { LiteLLMEmbeddingProvider } from '../implementations/litellm-embedding-provider.js';
import { OpenAIEmbeddingProvider } from '../implementations/openai-embedding-provider.js';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface.js';

/**
 * Configuration options for the embedding system
 */
export interface EmbeddingSystemConfig {
  /**
   * The default embedding provider to use
   */
  defaultProvider: 'litellm' | 'openai';

  /**
   * Configuration for the LiteLLM provider
   */
  litellm?: {
    model: string;
    baseUrl?: string;
  };

  /**
   * Configuration for the OpenAI provider
   */
  openai?: {
    model: string;
    apiKey: string;
    baseUrl?: string;
  };
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

    switch (providerConfig.provider) {
      case 'litellm':
        return new LiteLLMEmbeddingProvider(
          providerConfig as LiteLLMEmbeddingConfig,
        );
      case 'openai':
        if (!config.openai?.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIEmbeddingProvider(
          providerConfig as OpenAIEmbeddingConfig,
          config.openai.apiKey,
        );
      default:
        throw new Error(
          `Unsupported provider: ${providerConfig.provider as string}`,
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

    switch (provider) {
      case 'litellm':
        if (!config.litellm?.model) {
          throw new Error('LiteLLM model is required');
        }
        return {
          provider: 'litellm',
          model: config.litellm.model,
          baseUrl: config.litellm.baseUrl,
        };
      case 'openai':
        if (!config.openai?.model) {
          throw new Error('OpenAI model is required');
        }
        return {
          provider: 'openai',
          model: config.openai.model,
          baseUrl: config.openai.baseUrl,
        };
      default:
        throw new Error(`Unsupported provider: ${provider as string}`);
    }
  }

  /**
   * Loads the configuration from environment variables
   * @returns The embedding system configuration
   */
  static loadFromEnv(): EmbeddingSystemConfig {
    const defaultProvider =
      (process.env.EMBEDDING_PROVIDER as 'litellm' | 'openai') || 'litellm';

    return {
      defaultProvider,
      litellm: {
        model: process.env.LITELLM_EMBEDDING_MODEL || 'text-embedding-3-small',
        baseUrl: process.env.LITELLM_BASE_URL,
      },
      openai: {
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    };
  }
}
