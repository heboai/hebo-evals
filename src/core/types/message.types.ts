/**
 * Base role types for messages
 */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  HUMAN_AGENT = 'human_agent',
  TOOL = 'tool',
  FUNCTION = 'function',
  DEVELOPER = 'developer',
}

/**
 * Base tool usage type
 */
export interface ToolUsage {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Base tool response type
 */
export interface ToolResponse {
  content: string;
}

/**
 * Base message interface that can be extended
 */
export interface BaseMessage {
  role: MessageRole;
  content: string;
  toolUsage?: ToolUsage;
  toolResponse?: ToolResponse;
}

/**
 * Test case specific message block
 */
export interface MessageBlock extends BaseMessage {
  toolUsages?: ToolUsage[];
  toolResponses?: ToolResponse[];
}

/**
 * Test case definition
 */
export interface TestCase {
  name: string;
  messageBlocks: MessageBlock[];
}
