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
  created: number;

  /**
   * The model used for the response
   */
  model: string;

  /**
   * The ID of the previous response
   */
  previous_response_id: string | null;

  /**
   * The choices array containing the response messages
   */
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      name: string | null;
      function_call: any | null;
    };
    finish_reason: string;
    logprobs: any | null;
  }>;

  /**
   * The output array containing the response messages (for OpenAI API)
   */
  output?: Array<{
    type: string;
    id: string;
    status: string;
    role: string;
    content: Array<{
      type: string;
      text: string;
      annotations: unknown[];
    }>;
  }>;

  /**
   * The status of the response (for OpenAI API)
   */
  status?: string;

  /**
   * Error information if any
   */
  error: null | {
    message: string;
    type: string;
    code?: string;
  };

  /**
   * Token usage information
   */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    tool_usage?: any;
  };
}
