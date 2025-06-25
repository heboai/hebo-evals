import { BaseMessage } from '../../core/types/message.types';

/**
 * Simplified agent configuration
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
 */
export interface AgentInput {
  /**
   * List of messages to send to the agent
   */
  messages: BaseMessage[];
}

/**
 * Represents the output received from an agent
 */
export interface AgentOutput {
  /**
   * The main response from the agent
   */
  response: string;

  /**
   * Optional metadata about the response
   */
  metadata?: {
    model?: string;
    provider?: string;
    id?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
