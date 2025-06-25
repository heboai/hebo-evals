import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface.js';
import { EmbeddingProvider } from '../implementations/embedding-provider.js';
import { ProviderType } from '../../config/types/config.types.js';
import { EmbeddingConfig } from '../types/embedding.types.js';
import { EmbeddingSystemConfig } from '../config/embedding.config.js';

/**
 * Factory class for creating embedding providers
 */
export class EmbeddingProviderFactory {
  /**
   * Creates an embedding provider based on the configuration
   * @param config The embedding configuration
   * @returns The created embedding provider
   * @throws Error if the configuration is invalid
   */
  static createProvider(
    config: EmbeddingSystemConfig | EmbeddingConfig,
  ): IEmbeddingProvider {
    const providerConfig =
      'defaultProvider' in config
        ? {
            provider: config.defaultProvider,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
          }
        : config;

    // Validate provider
    const provider = providerConfig.provider;
    if (![ProviderType.OPENAI, ProviderType.HEBO].includes(provider)) {
      throw new Error(
        `Configuration error: Unsupported embedding provider: ${String(provider)}. Supported providers are: openai, hebo`,
      );
    }

    // Validate API key
    if (!providerConfig.apiKey) {
      throw new Error(
        `Configuration error: API key is required for ${String(provider)} embedding provider`,
      );
    }

    // Use the unified provider for both OpenAI and Hebo
    // since Hebo embeddings are just OpenAI embeddings with different URL/auth
    return new EmbeddingProvider(providerConfig, providerConfig.apiKey);
  }
}
