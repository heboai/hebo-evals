import { FuzzyMatchAssertion } from '../evaluation/types/fuzzy-match.types.js';

/**
 * Parser for extracting fuzzy match assertions from test case content
 */
export class FuzzyMatchParser {
  /**
   * Extracts fuzzy match assertions from assistant message content
   * @param content The assistant message content
   * @returns Array of fuzzy match assertions
   */
  parseAssertions(content: string): FuzzyMatchAssertion[] {
    const assertionRegex = /\[([^|]+)\|([0-9]*\.?[0-9]+)\]/g;
    const assertions: FuzzyMatchAssertion[] = [];

    let match;
    while ((match = assertionRegex.exec(content)) !== null) {
      const threshold = parseFloat(match[2]);

      // Validate threshold is between 0 and 1 inclusive
      if (threshold < 0 || threshold > 1) {
        throw new Error(
          `Invalid threshold value: ${threshold}. Threshold must be between 0 and 1 inclusive. ` +
            `Found in assertion: [${match[1]}|${match[2]}]`,
        );
      }

      assertions.push({
        expectedText: match[1].trim(),
        threshold,
        description: match[1].trim(),
      });
    }

    return assertions;
  }

  /**
   * Removes fuzzy match syntax from content for actual response comparison
   * @param content The content with fuzzy match syntax
   * @returns Clean content without fuzzy match syntax
   */
  cleanContent(content: string): string {
    return content.replace(/\[([^|]+)\|[0-9]*\.?[0-9]+\]/g, '$1');
  }

  /**
   * Checks if content contains any fuzzy match assertions
   * @param content The content to check
   * @returns True if content contains fuzzy match assertions
   */
  hasAssertions(content: string): boolean {
    return /\[([^|]+)\|[0-9]*\.?[0-9]+\]/.test(content);
  }
}
