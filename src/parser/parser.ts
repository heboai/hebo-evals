import { TestCaseParser } from './tokenizer';
import {
  MessageRole,
  BaseMessage,
  TestCase,
  ToolUsage,
  ToolResponse,
} from '../core/types/message.types';
import { roleMapper } from '../core/utils/role-mapper';

/**
 * Error thrown when parsing fails
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public lineNumber?: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parser for test case text files
 */
export class Parser {
  private parser: TestCaseParser;

  constructor() {
    this.parser = new TestCaseParser();
  }

  /**
   * Parses a test case from text
   * @param text The text to parse
   * @param name The name of the test case
   * @returns The parsed test case
   * @throws ParseError if parsing fails
   */
  public parse(text: string, name: string): TestCase {
    const elements = this.parser.tokenize(text);
    const messageBlocks: BaseMessage[] = [];
    let currentBlock: BaseMessage | null = null;
    let currentToolUsages: ToolUsage[] = [];
    let currentToolResponses: ToolResponse[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      switch (element.type) {
        case 'role': {
          // Save previous block if exists
          if (currentBlock) {
            messageBlocks.push(currentBlock);
          }

          // Start new block
          const role = this.parseRole(element.value);
          currentBlock = {
            role,
            content: '',
            toolUsages: [],
            toolResponses: [],
          };
          break;
        }

        case 'content': {
          if (!currentBlock) {
            throw new ParseError('Content found without a role');
          }

          // Append content with proper spacing
          if (currentBlock.content) {
            currentBlock.content += '\n\n';
          }
          currentBlock.content += element.value;
          break;
        }

        case 'tool_use': {
          if (!currentBlock) {
            throw new ParseError('Tool use found without a role');
          }

          // Parse tool usage
          const toolName = element.value;
          const nextElement = elements[i + 1];
          if (!nextElement || nextElement.type !== 'args') {
            throw new ParseError('Tool use must be followed by args');
          }

          try {
            const args = JSON.parse(nextElement.value) as Record<
              string,
              unknown
            >;
            currentToolUsages.push({ name: toolName, args });
            i++; // Skip args element
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            throw new ParseError(`Invalid tool args format: ${errorMessage}`);
          }
          break;
        }

        case 'tool_response': {
          if (!currentBlock) {
            throw new ParseError('Tool response found without a role');
          }

          currentToolResponses.push({ content: element.value });
          break;
        }
      }
    }

    // Add the last block if exists
    if (currentBlock) {
      currentBlock.toolUsages = currentToolUsages;
      currentBlock.toolResponses = currentToolResponses;
      messageBlocks.push(currentBlock);
    }

    // Validate the test case structure
    this.validateTestCase(messageBlocks);

    return {
      name,
      messageBlocks,
    };
  }

  /**
   * Parses a role string into a MessageRole enum value
   * @param role The role string to parse
   * @returns The parsed MessageRole
   * @throws ParseError if the role is invalid
   */
  private parseRole(role: string): MessageRole {
    try {
      return roleMapper.toRole(role);
    } catch {
      throw new ParseError(`Invalid role: ${role}`);
    }
  }

  /**
   * Validates the structure of a test case
   * @param messageBlocks The message blocks to validate
   * @throws ParseError if validation fails
   */
  private validateTestCase(messageBlocks: BaseMessage[]): void {
    if (messageBlocks.length === 0) {
      throw new ParseError('Test case must contain at least one message block');
    }

    // Check that the last message is from the assistant or human agent
    const lastBlock = messageBlocks[messageBlocks.length - 1];
    if (
      lastBlock.role !== MessageRole.ASSISTANT &&
      lastBlock.role !== MessageRole.HUMAN_AGENT
    ) {
      throw new ParseError(
        'Last message must be from the assistant or human agent',
      );
    }

    // Validate tool usage and response sequence
    for (let i = 0; i < messageBlocks.length; i++) {
      const block = messageBlocks[i];

      if (block.toolUsages?.length) {
        // Tool usage must be preceded by assistant or human agent message
        if (
          block.role !== MessageRole.ASSISTANT &&
          block.role !== MessageRole.HUMAN_AGENT
        ) {
          throw new ParseError(
            'Tool usage must be preceded by assistant or human agent message',
          );
        }

        // Tool usage must be followed by tool response
        if (!block.toolResponses?.length) {
          throw new ParseError('Tool usage must be followed by tool response');
        }

        // Tool response must be followed by assistant or human agent message
        if (
          i === messageBlocks.length - 1 ||
          (messageBlocks[i + 1].role !== MessageRole.ASSISTANT &&
            messageBlocks[i + 1].role !== MessageRole.HUMAN_AGENT)
        ) {
          throw new ParseError(
            'Tool response must be followed by assistant or human agent message',
          );
        }
      }
    }
  }
}
