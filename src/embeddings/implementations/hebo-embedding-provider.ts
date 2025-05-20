import { BaseEmbeddingProvider } from '../interfaces/base-embedding-provider.js';
import {
  HeboEmbeddingConfig,
  EmbeddingResponse,
} from '../types/embedding.types.js';

interface HeboEmbeddingResponse {
  data: Array<{
    embedding: number[];
    object: string;
    index: number;
  }>;
  model: string;
  object: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Implementation of the Hebo embedding provider
 *
 * This provider uses the Hebo API to generate embeddings.
 */
export class HeboEmbeddingProvider extends BaseEmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: HeboEmbeddingConfig, apiKey: string) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.hebo.ai/v1/embeddings';
    this.apiKey = apiKey;
  }

  /**
   * Validates the Hebo-specific configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error('Model is required for Hebo embedding provider');
    }
    if (!this.apiKey) {
      throw new Error('API key is required for Hebo embedding provider');
    }
    return super.validateConfig();
  }

  /**
   * Processes the text and returns the embedding response
   */
  protected async processText(text: string): Promise<EmbeddingResponse> {
    try {
      // Validate input text
      if (!text || text.trim().length === 0) {
        throw new Error('Input text cannot be empty');
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: text,
          encoding_format: 'base64',
        }),
      });
      // Log the status and response body for debugging (do not log API key)
      const responseClone = response.clone();
      let responseBody;
      try {
        responseBody = await responseClone.text();
      } catch {
        responseBody = '[Unable to read response body]';
      }
      console.log('[HeboEmbeddingProvider] Response status:', response.status);
      console.log('[HeboEmbeddingProvider] Response body:', responseBody);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `HTTP error! status: ${response.status}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ''
          }`,
        );
      }

      const data = (await response.json()) as HeboEmbeddingResponse;

      if (!data.data?.[0]?.embedding) {
        throw new Error('Invalid response format from Hebo API');
      }

      return {
        embedding: data.data[0].embedding,
        metadata: {
          model: this.config.model,
          provider: 'hebo',
          usage: data.usage,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to generate embedding: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
