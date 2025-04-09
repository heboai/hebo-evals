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
 * Parser for test case text files
 */
export class TestCaseParser {
  /**
   * Regular expression patterns for element matching
   */
  private static readonly PATTERNS = {
    ROLE: /^(user|assistant|human agent):/i,
    TOOL_USE: /^tool use:/i,
    TOOL_RESPONSE: /^tool response:/i,
    ARGS: /^args:/i,
  };

  /**
   * Parses the input text into test case elements
   * @param text The text to parse
   * @returns Array of test case elements
   */
  public tokenize(text: string): TestCaseElement[] {
    const lines = text.split('\n');
    const elements: TestCaseElement[] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;

      if (TestCaseParser.PATTERNS.ROLE.test(line)) {
        const [role] = line.split(':');
        elements.push({ type: 'role', value: role.toLowerCase().trim() });
        elements.push({
          type: 'content',
          value: line.substring(role.length + 1).trim(),
        });
      } else if (TestCaseParser.PATTERNS.TOOL_USE.test(line)) {
        elements.push({
          type: 'tool_use',
          value: line.substring('tool use:'.length).trim(),
        });
      } else if (TestCaseParser.PATTERNS.TOOL_RESPONSE.test(line)) {
        elements.push({
          type: 'tool_response',
          value: line.substring('tool response:'.length).trim(),
        });
      } else if (TestCaseParser.PATTERNS.ARGS.test(line)) {
        elements.push({
          type: 'args',
          value: line.substring('args:'.length).trim(),
        });
      } else {
        // If no pattern matches, treat as content continuation
        elements.push({ type: 'content', value: line.trim() });
      }
    }

    return elements;
  }
}
