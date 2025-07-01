import type {
  CoreMessage,
  LanguageModelUsage,
  LanguageModelResponseMetadata,
} from 'ai';

/**
 * Simplified agent configuration using Vercel AI SDK types
 */
export interface AgentConfig {
  /**
   * The model to use for the agent
   * @example "gpt-4", "claude-2"
   */
  model: string;

  /**
   * The API key for authentication
   */
  apiKey: string;

  /**
   * The base URL for the agent's API
   * @example "https://api.openai.com/v1"
   */
  baseUrl?: string;

  /**
   * Optional path to a custom configuration file
   */
  configPath?: string;

  /**
   * The provider for the agent
   */
  provider: string;
}

/**
 * Represents the input that can be sent to an agent
 * Uses Vercel AI SDK CoreMessage type for consistency
 */
export interface AgentInput {
  /**
   * List of messages to send to the agent
   */
  messages: CoreMessage[];
}

/**
 * Represents the output received from an agent
 * Uses Vercel AI SDK types for metadata and usage
 */
export interface AgentOutput {
  /**
   * The main response from the agent
   */
  response: string;

  /**
   * Optional metadata about the response using Vercel AI SDK types
   */
  metadata?: {
    model?: string;
    provider?: string;
    id?: string;
    usage?: LanguageModelUsage;
    response?: LanguageModelResponseMetadata;
  };

  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
