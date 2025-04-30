import { BaseMessage, MessageRole } from '../../core/types/message.types';

/**
 * Represents a test case for agent evaluation.
 */
export interface TestCase {
  /**
   * The sequence of messages that form the test case.
   */
  messages: BaseMessage[];

  /**
   * The expected output message from the agent.
   */
  expectedOutput: BaseMessage;
}

/**
 * Represents the result of executing a test case.
 */
export interface TestCaseResult {
  /**
   * Whether the test case execution was successful.
   */
  success: boolean;

  /**
   * Error message if the test case failed.
   */
  error?: string;

  /**
   * Score between 0 and 1 indicating how well the agent performed.
   */
  score: number;

  /**
   * Time taken to execute the test case in milliseconds.
   */
  executionTime: number;
} 