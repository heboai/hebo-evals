/**
 * Represents the base configuration for an agent
 */
export interface AgentConfig {
  /**
   * The model to use for the agent
   */
  model: string;
}

/**
 * Represents a single message in a conversation
 */
export interface AgentMessage {
  /**
   * The content of the message
   */
  content: string;

  /**
   * The role of the message sender
   */
  role: 'user' | 'assistant' | 'system';
}

/**
 * Represents the input that can be sent to an agent
 */
export interface AgentInput {
  /**
   * List of messages to send to the agent
   */
  messages: AgentMessage[];
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
  metadata?: Record<string, unknown>;

  /**
   * Optional error information if the request failed
   */
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Configuration for API key authentication
 */
export interface ApiKeyAuthConfig {
  /**
   * The API key to be used for authentication
   */
  apiKey: string;

  /**
   * The header name where the API key should be sent
   * @default 'Authorization'
   */
  headerName?: string;

  /**
   * The format of the API key in the header
   * @default 'Bearer {apiKey}'
   */
  headerFormat?: string;
}

/**
 * Represents the authentication configuration for an agent
 */
export type AgentAuthConfig = ApiKeyAuthConfig;
