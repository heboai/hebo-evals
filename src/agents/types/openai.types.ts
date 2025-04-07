/**
 * Types for Hebo API interactions
 */

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  DEVELOPER = 'developer',
  FUNCTION = 'function',
}

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface ResponseRequest {
  model: string;
  messages: Message[];
  store?: boolean;
  previous_response_id?: string;
}

export interface Response {
  id: string;
  object: string;
  created: number;
  model: string;
  previous_response_id?: string;
  choices: {
    index: number;
    message: Message;
    finish_reason?: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}
