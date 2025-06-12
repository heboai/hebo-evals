import { BaseEmbeddingProvider } from '../interfaces/base-embedding-provider.js';
import {
  HeboEmbeddingConfig,
  EmbeddingResponse,
} from '../types/embedding.types.js';
import { Logger } from '../../utils/logger.js';

interface HeboEmbeddingResponse {
  data: Array<{
    embedding: string; // Base64 encoded embedding
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
    this.baseUrl = config.baseUrl || 'https://api.hebo.ai/v1';
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
    // Validate input text
    if (!text || text.trim().length === 0) {
      throw new Error('Input text cannot be empty');
    }

    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            model: this.config.model,
            input: text,
            encoding_format: 'base64',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = `HTTP error! status: ${response.status}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ''
          }`;

          // If it's a timeout or server error, retry
          if (response.status >= 500 || response.status === 504) {
            if (attempt < maxRetries) {
              Logger.debug(
                `Attempt ${attempt} failed with ${errorMessage}. Retrying in ${retryDelay}ms...`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            }
          }
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as HeboEmbeddingResponse;

        if (!data.data?.[0]?.embedding) {
          throw new Error('Invalid response format from Hebo API');
        }

        // Decode base64 embedding into number array
        const base64Embedding = data.data[0].embedding;
        const binaryString = atob(base64Embedding);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const floatArray = new Float32Array(bytes.buffer);
        const embedding = Array.from(floatArray);

        return {
          embedding,
          metadata: {
            model: this.config.model,
            provider: 'hebo',
            usage: data.usage,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If it's not the last attempt and it's a retryable error, wait and retry
        if (
          attempt < maxRetries &&
          (lastError.message.includes('status: 5') ||
            lastError.message.includes('status: 504'))
        ) {
          Logger.debug(
            `Attempt ${attempt} failed with ${lastError.message}. Retrying in ${retryDelay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        // If it's the last attempt or a non-retryable error, throw immediately
        if (
          attempt === maxRetries ||
          (!lastError.message.includes('status: 5') &&
            !lastError.message.includes('status: 504'))
        ) {
          throw lastError;
        }
      }
    }

    // This should never be reached due to the throw in the catch block
    throw new Error(
      `Failed to generate embedding after ${maxRetries} attempts. Last error: ${
        lastError?.message || 'Unknown error'
      }`,
    );
  }
}
