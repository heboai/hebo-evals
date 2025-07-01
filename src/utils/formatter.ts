import { TestCase } from '../core/types/message.types.js';
import type { CoreMessage } from 'ai';

/**
 * Formats a test case as plain text, showing roles, content, tool usages, and tool responses.
 * Matches the style of the current test case files.
 * @param testCase The test case to format
 * @returns The formatted plain text string
 */
export const formatTestCasePlain = (testCase: TestCase): string => {
  return testCase.messageBlocks.map(formatMessageBlockPlain).join('\n');
};

/**
 * Formats a single message block as plain text.
 * @param block The message block to format
 * @returns The formatted string
 */
const formatMessageBlockPlain = (block: CoreMessage): string => {
  const lines: string[] = [];

  // Show the role as it would appear in the test case file
  const roleDisplay = block.role === 'tool' ? 'tool' : block.role;

  // Extract text content from CoreMessage, handling different content types
  const contentText =
    typeof block.content === 'string'
      ? block.content
      : Array.isArray(block.content)
        ? block.content
            .map((part) => (part.type === 'text' ? part.text : ''))
            .join('')
        : '';

  lines.push(`${roleDisplay}: ${contentText}`.trim());

  return lines.join('\n');
};
