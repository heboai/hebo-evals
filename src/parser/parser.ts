import { TestCaseParser, TestCaseElement } from './tokenizer.js';
import {
  MessageRole,
  BaseMessage,
  TestCase,
} from '../core/types/message.types.js';
import { roleMapper } from '../core/utils/role-mapper.js';
import { ParseError } from './errors.js';

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
    const messageBlocks: BaseMessage[] = [];
    let currentBlock: BaseMessage | null = null;
    let currentContent: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      switch (element.type) {
        case 'role': {
          // Save previous block if exists
          if (currentBlock) {
            if (currentContent.length > 0) {
              currentBlock.content = currentContent.join('\n');
              currentContent = [];
            }
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
          // Preserve content exactly as is
          currentContent.push(element.value);
          break;
        }

        case 'tool_use': {
          if (!currentBlock) {
            throw new ParseError('Tool use found without a role');
          }

          // Parse tool usage and args from the combined value
          const toolValue = element.value;
          const argsMatch = toolValue.match(/^(.*?)\s*args:\s*(.*)$/i);

          if (!argsMatch) {
            throw new ParseError(
              'Tool use must include args in format: "name args: {...}"',
            );
          }

          const toolName = argsMatch[1].trim();
          const args = argsMatch[2].trim();

          // Validate that args is valid JSON
          let parsedArgs: Record<string, unknown>;
          try {
            const parsed = JSON.parse(args) as unknown;
            if (typeof parsed !== 'object' || parsed === null) {
              throw new Error('Tool args must be a valid object');
            }
            parsedArgs = parsed as Record<string, unknown>;
          } catch (e: unknown) {
            const errorMessage =
              e instanceof Error ? e.message : 'Invalid JSON';
            throw new ParseError(
              `Tool args must be valid JSON: ${errorMessage}`,
            );
          }

          if (!currentBlock.toolUsages) {
            currentBlock.toolUsages = [];
          }
          currentBlock.toolUsages.push({
            name: toolName,
            args: JSON.stringify(parsedArgs).replace(/"([^"]+)":/g, '"$1": '), // Add space after colon only
          });
          break;
        }

        case 'tool_response': {
          if (!currentBlock) {
            throw new ParseError('Tool response found without a role');
          }

          if (!currentBlock.toolResponses) {
            currentBlock.toolResponses = [];
          }
          currentBlock.toolResponses.push({ content: element.value });
          break;
        }
      }
    }

    // Add the last block if exists
    if (currentBlock) {
      if (currentContent.length > 0) {
        currentBlock.content = currentContent.join('\n');
      }
      messageBlocks.push(currentBlock);
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
  private validateTestCase(messageBlocks: BaseMessage[]): void {
    if (messageBlocks.length === 0) {
      throw new ParseError('Test case must contain at least one message');
    }

    // Validate that system messages only appear at the start
    let foundNonSystemMessage = false;
    for (const block of messageBlocks) {
      if (block.role === MessageRole.SYSTEM) {
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
