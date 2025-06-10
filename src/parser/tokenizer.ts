import { ParseError } from './errors.js';
import { MarkdownPatterns } from './markdown-handlers.js';

/**
 * Represents an element in the test case text
 */
export interface TestCaseElement {
  /**
   * The type of the element
   */
  type: 'role' | 'content' | 'tool_use' | 'tool_response' | 'args';

  /**
   * The value of the element
   */
  value: string;
}

/**
 * Type definition for pattern handler functions
 */
type PatternHandler = (line: string, elements: TestCaseElement[]) => void;

/**
 * Interface for pattern handler configuration
 */
interface PatternHandlerConfig {
  pattern: RegExp;
  handle: PatternHandler;
}

/**
 * Parser for test case text
 */
export class TestCaseParser {
  /**
   * Regular expression patterns for element matching
   */
  private static readonly PATTERNS = {
    ROLE: /^\s*(\w+):/i,
    TOOL_USE: /^tool use:/i,
    TOOL_RESPONSE: /^\s*tool response:/i,
    ARGS: /^args:/i,
    // Markdown patterns
    MARKDOWN_HEADER: MarkdownPatterns.MARKDOWN_HEADER,
    MARKDOWN_LIST: MarkdownPatterns.MARKDOWN_LIST,
    MARKDOWN_TASK_LIST: MarkdownPatterns.MARKDOWN_TASK_LIST,
    MARKDOWN_CODE_BLOCK: MarkdownPatterns.MARKDOWN_CODE_BLOCK,
    MARKDOWN_INLINE_CODE: MarkdownPatterns.MARKDOWN_INLINE_CODE,
    MARKDOWN_BOLD: MarkdownPatterns.MARKDOWN_BOLD,
    MARKDOWN_ITALIC: MarkdownPatterns.MARKDOWN_ITALIC,
    MARKDOWN_BLOCKQUOTE: MarkdownPatterns.MARKDOWN_BLOCKQUOTE,
    MARKDOWN_HORIZONTAL_RULE: MarkdownPatterns.MARKDOWN_HORIZONTAL_RULE,
  };

  /**
   * Valid roles that can be used in test cases
   */
  private static readonly VALID_ROLES = new Set([
    'user',
    'assistant',
    'human agent',
    'tool use',
    'tool response',
    'system',
  ]);

  /**
   * Pattern handlers for different line types
   */
  private readonly patternHandlers: PatternHandlerConfig[] = [
    {
      pattern: TestCaseParser.PATTERNS.TOOL_USE,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'tool_use',
          value: line.substring('tool use:'.length).trim(),
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.TOOL_RESPONSE,
      handle: (line: string, elements: TestCaseElement[]) => {
        const match = line.match(/^\s*tool response:\s*(.*)$/i);
        if (match) {
          elements.push({
            type: 'tool_response',
            value: match[1].trim(),
          });
        }
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.ARGS,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'args',
          value: line.substring('args:'.length).trim(),
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.ROLE,
      handle: (line: string, elements: TestCaseElement[]) => {
        const match = line.match(/^\s*(\w+):/i);
        if (!match) return;

        const role = match[1];
        const normalizedRole = role.toLowerCase().trim();

        if (!TestCaseParser.VALID_ROLES.has(normalizedRole)) {
          throw new ParseError(
            `Invalid message role: ${role}. Valid roles are: ${Array.from(
              TestCaseParser.VALID_ROLES,
            ).join(', ')}`,
          );
        }

        elements.push({ type: 'role', value: normalizedRole });
        const content = line
          .substring(match[0].length)
          .replace(/^\s+/, '')
          .replace(/[\r\n]+$/, '');
        elements.push({
          type: 'content',
          value: content,
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.MARKDOWN_HEADER,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'content',
          value: line,
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.MARKDOWN_LIST,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'content',
          value: line,
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.MARKDOWN_TASK_LIST,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'content',
          value: line,
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.MARKDOWN_BLOCKQUOTE,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'content',
          value: line,
        });
      },
    },
    {
      pattern: TestCaseParser.PATTERNS.MARKDOWN_HORIZONTAL_RULE,
      handle: (line: string, elements: TestCaseElement[]) => {
        elements.push({
          type: 'content',
          value: line,
        });
      },
    },
  ];

  /**
   * Parses the input text into test case elements
   * @param text The text to parse
   * @returns Array of test case elements
   */
  public tokenize(text: string): TestCaseElement[] {
    const lines = text.split('\n');
    const elements: TestCaseElement[] = [];
    let currentRole: string | null = null;
    let currentContent: string[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          codeBlockLines = [line];
        } else {
          // End of code block
          inCodeBlock = false;
          codeBlockLines.push(line);
          elements.push({
            type: 'content',
            value: codeBlockLines.join('\n'),
          });
          codeBlockLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      if (line.trim() === '') {
        if (currentContent.length > 0) {
          elements.push({
            type: 'content',
            value: currentContent.join('\n'),
          });
          currentContent = [];
        }
        continue;
      }

      let handled = false;
      let roleMatch: RegExpMatchArray | null = null;
      for (const { pattern, handle } of this.patternHandlers) {
        if (pattern.test(line)) {
          if (currentContent.length > 0) {
            elements.push({
              type: 'content',
              value: currentContent.join('\n'),
            });
            currentContent = [];
          }
          handle(line, elements);
          handled = true;
          if (pattern === TestCaseParser.PATTERNS.ROLE) {
            roleMatch = line.match(/^[\s]*(\w+):/i);
            if (roleMatch) {
              currentRole = roleMatch[1].toLowerCase().trim();
            }
          }
          break;
        }
      }

      if (!handled) {
        if (currentRole) {
          currentContent.push(line);
        } else {
          throw new ParseError(
            'All messages must have a role marker (e.g. "user:", "assistant:", "human agent:", "tool use:", "tool response:")',
          );
        }
      }
    }

    // Add any remaining content
    if (currentContent.length > 0) {
      elements.push({
        type: 'content',
        value: currentContent.join('\n'),
      });
    }

    // Validate the parsed elements
    this.validateElements(elements);

    return elements;
  }

  /**
   * Validates the parsed elements for common errors
   * @param elements The parsed elements
   * @throws Error if validation fails
   */
  private validateElements(elements: TestCaseElement[]): void {
    // Example validation: Ensure tool_use is followed by either args or tool_response
    for (let i = 0; i < elements.length - 1; i++) {
      if (
        elements[i].type === 'tool_use' &&
        elements[i + 1].type !== 'args' &&
        elements[i + 1].type !== 'tool_response'
      ) {
        console.warn(
          'Warning: tool_use should be followed by args or tool_response',
        );
      }
    }
  }
}
