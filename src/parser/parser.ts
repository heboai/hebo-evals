import { TestCaseParser } from './tokenizer.js';
import { MessageRole, TestCase } from '../core/types/message.types.js';
import { roleMapper } from '../core/utils/role-mapper.js';
import { ParseError } from './errors.js';
import type { CoreMessage } from 'ai';
import yaml from 'js-yaml';
import { FuzzyMatchParser } from './fuzzy-match-parser.js';
import { FuzzyMatchAssertion } from '../evaluation/types/fuzzy-match.types.js';

/**
 * Parser for test case text files
 */
export class Parser {
  private parser: TestCaseParser;
  private fuzzyMatchParser: FuzzyMatchParser;

  constructor() {
    this.parser = new TestCaseParser();
    this.fuzzyMatchParser = new FuzzyMatchParser();
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
    // Extract global metadata block (YAML between --- ... --- at the top)
    let runs: number | undefined = undefined;
    let testCaseText = text;
    const metadataMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (metadataMatch) {
      try {
        const metadata = yaml.load(metadataMatch[1]);
        let parsedRuns: number | undefined = undefined;
        if (metadata && typeof metadata === 'object' && 'runs' in metadata) {
          const rawRuns = (metadata as Record<string, unknown>).runs;
          if (typeof rawRuns === 'number') {
            parsedRuns = rawRuns;
          } else if (typeof rawRuns === 'string' && !isNaN(Number(rawRuns))) {
            parsedRuns = Number(rawRuns);
          }
          if (parsedRuns !== undefined) {
            if (!Number.isInteger(parsedRuns) || parsedRuns <= 0) {
              throw new ParseError(
                `Invalid runs value (${String(rawRuns)}) in metadata. Runs must be a positive integer.`,
              );
            }
            runs = parsedRuns;
          }
        }
      } catch (e) {
        throw new ParseError(
          'Failed to parse metadata block: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }
      // Remove metadata block from text
      testCaseText = text.slice(metadataMatch[0].length);
    }

    // Only split on test case headers at the start of the file or after a blank line
    let normalizedText = testCaseText;
    if (normalizedText.startsWith('# ')) {
      normalizedText = '__SPLIT__' + normalizedText;
    }
    normalizedText = normalizedText.replace(/(?:\r?\n){2,}# /g, '__SPLIT__# ');
    const testCaseSections = normalizedText
      .split('__SPLIT__')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (testCaseSections.length === 0) {
      throw new ParseError('No test cases found in file');
    }

    return testCaseSections.map((section) => {
      // The first line is the test case name (title)
      const lines = section.split(/\r?\n/);
      let title = lines[0].trim();
      // Remove leading '# ' if present (from split logic)
      if (title.startsWith('# ')) {
        title = title.slice(2).trim();
      }
      // If the next line after the title is empty, skip it (to match test expectation)
      let bodyLines = lines.slice(1);
      if (bodyLines.length > 0 && bodyLines[0].trim() === '') {
        bodyLines = bodyLines.slice(1);
      }
      const body = bodyLines.join('\n').trim();
      const fullId = `${hierarchicalId}/${title}`;
      // Parse the test case body
      const testCase = this.parse(body, title, fullId);
      // Attach global runs property if present
      if (runs !== undefined) {
        testCase.runs = runs;
      }
      return testCase;
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
    // Only remove the first line if it is a title (starts with # or ##), preserve all other Markdown headers
    let cleanText = text;
    const lines = text.split(/\r?\n/);
    if (lines.length > 0 && /^#{1,2}\s*.+$/.test(lines[0])) {
      cleanText = lines.slice(1).join('\n').trim();
    } else {
      cleanText = text.trim();
    }

    const elements = this.parser.tokenize(cleanText);
    const messageBlocks: CoreMessage[] = [];
    const fuzzyMatchAssertions: FuzzyMatchAssertion[] = [];
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

            messageBlocks.push(
              this.createCoreMessageWithAssertions(
                currentRole,
                content,
                fuzzyMatchAssertions,
              ),
            );
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
          // Merge all content for the current role, preserving blank lines and Markdown
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

      messageBlocks.push(
        this.createCoreMessageWithAssertions(
          currentRole,
          content,
          fuzzyMatchAssertions,
        ),
      );
    }

    // Validate the test case structure
    this.validateTestCase(messageBlocks);

    return {
      id,
      name,
      messageBlocks,
      fuzzyMatchAssertions:
        fuzzyMatchAssertions.length > 0 ? fuzzyMatchAssertions : undefined,
    };
  }

  /**
   * Creates a CoreMessage based on the role
   */
  private createCoreMessage(role: MessageRole, content: string): CoreMessage {
    // Preserve all whitespace exactly as in the original content
    return {
      role:
        role === MessageRole.USER
          ? 'user'
          : role === MessageRole.SYSTEM
            ? 'system'
            : 'assistant',
      content: content,
    };
  }

  /**
   * Creates a CoreMessage and extracts fuzzy match assertions if present
   */
  private createCoreMessageWithAssertions(
    role: MessageRole,
    content: string,
    fuzzyMatchAssertions: FuzzyMatchAssertion[],
  ): CoreMessage {
    if (role === MessageRole.ASSISTANT) {
      // Extract fuzzy match assertions from assistant messages
      const assertions = this.fuzzyMatchParser.parseAssertions(content);
      fuzzyMatchAssertions.push(...assertions);

      // Clean the content by removing fuzzy match syntax
      const cleanContent = this.fuzzyMatchParser.cleanContent(content);

      return {
        role: 'assistant',
        content: cleanContent,
      };
    }

    return this.createCoreMessage(role, content);
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
