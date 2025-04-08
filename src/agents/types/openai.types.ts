import { BaseMessage } from '../../core/types/message.types';

/**
 * Types for Hebo API interactions
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
 * Represents a request to the Hebo API
 */
export interface ResponseRequest {
  /**
   * The model to use for the response
   */
  model: string;

  /**
   * The messages to send to the API
   */
  messages: OpenAIMessage[];

  /**
   * Whether to store the conversation
   */
  store?: boolean;

  /**
   * The ID of the previous response
   */
  previous_response_id?: string;
}

/**
 * Represents a response from the Hebo API
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
  previous_response_id?: string;

  /**
   * The choices returned by the API
   */
  choices: {
    /**
     * The index of the choice
     */
    index: number;

    /**
     * The message returned by the API
     */
    message: OpenAIMessage;

    /**
     * The reason why the response finished
     */
    finish_reason?: string;
  }[];

  /**
   * The token usage information
   */
  usage: {
    /**
     * The number of tokens used in the prompt
     */
    prompt_tokens: number;

    /**
     * The number of tokens used in the completion
     */
    completion_tokens: number;

    /**
     * The total number of tokens used
     */
    total_tokens: number;
  };

  /**
   * Optional error information
   */
  error?: {
    /**
     * The error message
     */
    message: string;

    /**
     * The type of error
     */
    type: string;

    /**
     * The error code
     */
    code?: string;
  };
}
