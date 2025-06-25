import { BaseEmbeddingProvider } from '../interfaces/base-embedding-provider.js';
import {
  EmbeddingConfig,
  EmbeddingResponse,
} from '../types/embedding.types.js';
import { Logger } from '../../utils/logger.js';

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[] | string; // Can be number array (OpenAI) or base64 string (Hebo)
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
 * Unified embedding provider
 *
 * This provider works with OpenAI-compatible APIs including OpenAI and Hebo,
 * handling different authentication methods and response formats automatically.
 */
export class EmbeddingProvider extends BaseEmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: EmbeddingConfig, apiKey: string) {
    super(config);
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl(config.provider);
    this.apiKey = apiKey;
  }

  /**
   * Gets the default base URL for the provider
   */
  private getDefaultBaseUrl(provider: string): string {
    switch (provider) {
      case 'hebo':
        return 'https://api.hebo.ai/v1';
      case 'openai':
        return 'https://api.openai.com/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  /**
   * Gets the appropriate authentication headers for the provider
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.provider === 'hebo') {
      headers['X-API-Key'] = this.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Gets the request body for the embedding request
   */
  private getRequestBody(text: string): object {
    const baseBody = {
      model: this.config.model,
      input: text,
    };

    // Hebo requires base64 encoding format to return embeddings as base64
    if (this.config.provider === 'hebo') {
      return {
        ...baseBody,
        encoding_format: 'base64',
      };
    }

    return baseBody;
  }

  /**
   * Processes the embedding response based on the provider format
   */
  private processEmbeddingResponse(data: OpenAIEmbeddingResponse): number[] {
    if (!data.data?.[0]?.embedding) {
      throw new Error(
        `Invalid response format from ${this.config.provider} API`,
      );
    }

    const embedding = data.data[0].embedding;

    // Handle Hebo's base64-encoded response
    if (this.config.provider === 'hebo' && typeof embedding === 'string') {
      // Validate base64 string (allow and strip whitespace/newlines)
      if (!/^[A-Za-z0-9+/\s]*={0,2}$/.test(embedding.replace(/\s/g, ''))) {
        throw new Error('Invalid base64 encoding in embedding response');
      }

      try {
        const buffer = Buffer.from(embedding, 'base64');
        const floatArray = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
        );
        return Array.from(floatArray);
      } catch (error) {
        throw new Error(
          'Failed to decode base64 embedding: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    // Handle OpenAI's direct number array response
    if (Array.isArray(embedding)) {
      return embedding;
    }

    throw new Error(`Unexpected embedding format from ${this.config.provider}`);
  }

  /**
   * Validates the provider-specific configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error(
        `Model is required for ${this.config.provider} embedding provider`,
      );
    }
    if (!this.apiKey) {
      throw new Error(
        `API key is required for ${this.config.provider} embedding provider`,
      );
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
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.getRequestBody(text)),
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

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        const embedding = this.processEmbeddingResponse(data);

        return {
          embedding,
          metadata: {
            model: this.config.model,
            provider: this.config.provider,
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
          throw new Error(`Failed to generate embedding: ${lastError.message}`);
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
