/**
 * Base configuration for embedding providers
 */
export interface EmbeddingConfig {
  /**
   * The model to use for embeddings
   * @example "text-embedding-3-small", "text-embedding-3-large"
   */
  model: string;

  /**
   * The provider to use for embeddings
   * @example "litellm", "openai"
   */
  provider: 'litellm' | 'openai';

  /**
   * Base URL for the embedding API
   * @default "https://api.openai.com/v1" for OpenAI, "http://localhost:4000" for LiteLLM
   */
  baseUrl?: string;
}

/**
 * Configuration specific to LiteLLM embedding provider
 */
export interface LiteLLMEmbeddingConfig extends EmbeddingConfig {
  provider: 'litellm';
  /**
   * The model to use through LiteLLM
   * @example "azure/azure-embedding-model", "anthropic/claude-embedding"
   */
  model: string;
}

/**
 * Configuration specific to OpenAI embedding provider
 */
export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
  provider: 'openai';
  /**
   * The OpenAI model to use
   * @example "text-embedding-3-small", "text-embedding-3-large"
   */
  model: string;
}

/**
 * Response from embedding provider
 */
export interface EmbeddingResponse {
  /**
   * The embedding vector
   */
  embedding: number[];

  /**
   * Optional metadata about the embedding
   */
  metadata?: {
    model: string;
    provider: string;
    [key: string]: unknown;
  };
}

/**
 * Error response from embedding provider
 */
export interface EmbeddingError {
  message: string;
  code?: string;
  details?: unknown;
}
