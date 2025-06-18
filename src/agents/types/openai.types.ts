import { BaseMessage } from '../../core/types/message.types';

/**
 * Types for OpenAI Response API interactions
 */

/**
 * OpenAI/Hebo specific message format
 */
export interface OpenAIMessage extends BaseMessage {
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * Represents a request to the OpenAI Response API
 */
export interface ResponseRequest {
  /**
   * The model to use for the response
   */
  model: string;

  /**
   * The messages to send to the API (for Hebo API)
   */
  messages?: Array<{
    role: string;
    content: string;
  }>;

  /**
   * The input messages to send to the API (for OpenAI API)
   */
  input?: OpenAIMessage[];

  /**
   * Whether to store the conversation (for OpenAI API)
   */
  store?: boolean;

  /**
   * The ID of the previous response (for OpenAI API)
   */
  previous_response_id?: string;

  /**
   * System instructions to guide the model's behavior
   */
  instructions?: string;

  /**
   * Whether to stream the response
   */
  stream?: boolean;
}

/**
 * Represents a response from the OpenAI Response API
 */
export interface Response {
  /**
   * The ID of the response
   */
  id: string;

  /**
   * The type of the response
   */
  object: string;

  /**
   * The timestamp when the response was created
   */
  created_at: number;

  /**
   * The status of the response
   */
  status: string;

  /**
   * Whether the response is being generated in the background
   */
  background: boolean;

  /**
   * Error information if any
   */
  error: null | {
    message: string;
    type: string;
    code?: string;
  };

  /**
   * Details about incomplete responses
   */
  incomplete_details: null | {
    reason: string;
  };

  /**
   * System instructions used for the response
   */
  instructions: string;

  /**
   * Maximum number of output tokens
   */
  max_output_tokens: number | null;

  /**
   * The model used for the response
   */
  model: string;

  /**
   * The output array containing the response messages
   */
  output: Array<{
    id: string;
    type: string;
    status: string;
    content: Array<{
      type: string;
      annotations: unknown[];
      text: string;
    }>;
    role: string;
  }>;

  /**
   * Whether parallel tool calls are enabled
   */
  parallel_tool_calls: boolean;

  /**
   * The ID of the previous response
   */
  previous_response_id: string | null;

  /**
   * Reasoning information
   */
  reasoning: {
    effort: null | {
      level: string;
      description: string;
    };
    summary: null | string;
  };

  /**
   * The service tier used
   */
  service_tier: string;

  /**
   * Whether the conversation is stored
   */
  store: boolean;

  /**
   * The temperature setting used
   */
  temperature: number;

  /**
   * Text format settings
   */
  text: {
    format: {
      type: string;
    };
  };

  /**
   * Tool choice setting
   */
  tool_choice: string;

  /**
   * Available tools
   */
  tools: unknown[];

  /**
   * Top-p sampling parameter
   */
  top_p: number;

  /**
   * Truncation setting
   */
  truncation: string;

  /**
   * Token usage information
   */
  usage: {
    input_tokens: number;
    input_tokens_details: {
      cached_tokens: number;
    };
    output_tokens: number;
    output_tokens_details: {
      reasoning_tokens: number;
    };
    total_tokens: number;
  };

  /**
   * User information
   */
  user: null | {
    id: string;
  };

  /**
   * Additional metadata
   */
  metadata: Record<string, unknown>;
}
