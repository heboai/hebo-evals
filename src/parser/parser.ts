import { TestCaseParser } from './tokenizer.js';
import { MessageRole, TestCase } from '../core/types/message.types.js';
import { roleMapper } from '../core/utils/role-mapper.js';
import { ParseError } from './errors.js';
import type { CoreMessage } from 'ai';

/**
 * Parser for test case text files
 */
export class Parser {
  private parser: TestCaseParser;

  constructor() {
    this.parser = new TestCaseParser();
  }

  /**
   * Parses multiple test cases from text
   * @param text The text to parse
   * @param baseName The base name for the test cases
   * @param hierarchicalId The hierarchical ID based on folder structure
   * @returns Array of parsed test cases
   * @throws ParseError if parsing fails
   */
  public parseMultiple(
    text: string,
    baseName: string,
    hierarchicalId: string,
  ): TestCase[] {
    // Split the text by test case separator (---)
    const testCaseTexts = text.split(/^---$/m).filter((t) => t.trim());

    if (testCaseTexts.length === 0) {
      throw new ParseError('No test cases found in file');
    }

    // Only add index suffix if there are multiple test cases
    const shouldAddIndex = testCaseTexts.length > 1;

    return testCaseTexts.map((testCaseText, index) => {
      // Extract title if present (supports both # and ## for h1 and h2)
      const titleMatch = testCaseText.match(/^#{1,2}\s*(.+)$/m);
      const title = titleMatch
        ? titleMatch[1].trim()
        : shouldAddIndex
          ? `${baseName}_${index + 1}`
          : baseName;

      // Create full ID by combining hierarchical ID with title
      const fullId = `${hierarchicalId}/${title}`;

      return this.parse(testCaseText, title, fullId);
    });
  }

  /**
   * Creates a CoreMessage based on the role
   */
  private createCoreMessage(role: MessageRole, content: string): CoreMessage {
    switch (role) {
      case MessageRole.USER:
        return {
          role: 'user',
          content,
        };
      case MessageRole.ASSISTANT:
        return {
          role: 'assistant',
          content,
        };
      case MessageRole.SYSTEM:
        return {
          role: 'system',
          content,
        };
      case MessageRole.TOOL:
      case MessageRole.FUNCTION:
        return {
          role: 'tool',
          content: content || '',
        };
      case MessageRole.HUMAN_AGENT:
      case MessageRole.DEVELOPER:
        // Map human_agent and developer to assistant for compatibility
        return {
          role: 'assistant',
          content,
        };
      default:
        // Default to user for unknown roles
        return {
          role: 'user',
          content,
        };
    }
  }

  /**
   * Parses a test case from text
   * @param text The text to parse
   * @param name The name of the test case
   * @param id The unique identifier for the test case (defaults to name if not provided)
   * @returns The parsed test case
   * @throws ParseError if parsing fails
   */
  public parse(text: string, name: string, id: string = name): TestCase {
    // Remove title if present (supports both # and ## for h1 and h2)
    const cleanText = text.replace(/^#{1,2}\s*.+$/m, '').trim();
    const elements = this.parser.tokenize(cleanText);
    const messageBlocks: CoreMessage[] = [];
    let currentRole: MessageRole | null = null;
    let currentContent: string[] = [];
    let toolUsageLines: string[] = [];
    let toolResponseLines: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      switch (element.type) {
        case 'role': {
          // Save previous block if exists
          if (currentRole !== null) {
            let content = currentContent.join('\n');

            // Append tool usage and response information to content for formatting
            if (toolUsageLines.length > 0) {
              content += '\n' + toolUsageLines.join('\n');
            }
            if (toolResponseLines.length > 0) {
              content += '\n' + toolResponseLines.join('\n');
            }

            messageBlocks.push(this.createCoreMessage(currentRole, content));
            currentContent = [];
            toolUsageLines = [];
            toolResponseLines = [];
          }

          // Start new block
          currentRole = this.parseRole(element.value);
          break;
        }

        case 'content': {
          if (currentRole === null) {
            throw new ParseError('Content found without a role');
          }
          // Preserve content exactly as is
          currentContent.push(element.value);
          break;
        }

        case 'tool_use': {
          if (currentRole === null) {
            throw new ParseError('Tool use found without a role');
          }

          // Store tool usage as a line for later inclusion in content
          toolUsageLines.push(`tool use: ${element.value}`);
          break;
        }

        case 'tool_response': {
          if (currentRole === null) {
            throw new ParseError('Tool response found without a role');
          }

          // Store tool response as a line for later inclusion in content
          toolResponseLines.push(`tool response: ${element.value}`);
          break;
        }
      }
    }

    // Add the last block if exists
    if (currentRole !== null) {
      let content = '';
      if (currentContent.length > 0) {
        content = currentContent.join('\n');
      }

      // Append tool usage and response information to content for formatting
      if (toolUsageLines.length > 0) {
        content += '\n' + toolUsageLines.join('\n');
      }
      if (toolResponseLines.length > 0) {
        content += '\n' + toolResponseLines.join('\n');
      }

      messageBlocks.push(this.createCoreMessage(currentRole, content));
    }

    // Validate the test case structure
    this.validateTestCase(messageBlocks);

    return {
      id,
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
  private validateTestCase(messageBlocks: CoreMessage[]): void {
    if (messageBlocks.length === 0) {
      throw new ParseError('Test case must contain at least one message');
    }

    // Validate that system messages only appear at the start
    let foundNonSystemMessage = false;
    for (const block of messageBlocks) {
      if (block.role === 'system') {
        if (foundNonSystemMessage) {
          throw new ParseError(
            'System messages must appear at the start of the conversation',
          );
        }
      } else {
        foundNonSystemMessage = true;
      }
    }
  }
}
