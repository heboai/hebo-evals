import { TestCaseParser } from '../parser/tokenizer.js';
import { Parser } from '../parser/parser.js';
import { TestCaseLoader } from '../parser/loader.js';
import { MessageRole } from '../core/types/message.types.js';
import { ParseError } from '../parser/errors.js';
import { writeFile, mkdir, readdir, unlink, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Parser Components', () => {
  describe('TestCaseParser', () => {
    let tokenizer: TestCaseParser;

    beforeEach(() => {
      tokenizer = new TestCaseParser();
    });

    describe('tokenize', () => {
      it('should parse a simple conversation', () => {
        const text = `user: Hello
assistant: Hi there
user: How are you?`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle Windows-style line endings', () => {
        const text = 'user: Hello\r\nassistant: Hi there\r\nuser: How are you?';

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle mixed line endings', () => {
        const text =
          'user: Hello\r\nassistant: Hi there\nuser: How are you?\r\n';

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle lines starting with colons', () => {
        const text = `user: Hello
assistant: :This is a line starting with colon
user: How are you?`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({
          type: 'content',
          value: ':This is a line starting with colon',
        });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle unusual whitespace patterns', () => {
        const text = `user: Hello
\tassistant: Hi there
user: \tHow are you?
\t\tassistant: I'm good`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(8);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
        expect(result[6]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[7]).toEqual({ type: 'content', value: "I'm good" });
      });

      it('should handle partial role matches', () => {
        const text = `user123: Hello
assistant: Hi there`;

        expect(() => tokenizer.tokenize(text)).toThrow(
          'Invalid message role: user123. Valid roles are: user, assistant, human agent',
        );
      });

      it('should handle empty content after role', () => {
        const text = `user:
assistant: Hi there
user: `;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: '' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: '' });
      });

      it('should handle multiple consecutive empty lines', () => {
        const text = `user: Hello


assistant: Hi there


user: How are you?`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle empty lines', () => {
        const text = `user: Hello

assistant: Hi there

user: How are you?`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'user' });
        expect(result[1]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[2]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hi there' });
        expect(result[4]).toEqual({ type: 'role', value: 'user' });
        expect(result[5]).toEqual({ type: 'content', value: 'How are you?' });
      });

      it('should handle system messages', () => {
        const text = `system: You are a helpful assistant
user: Hello
assistant: Hi there`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ type: 'role', value: 'system' });
        expect(result[1]).toEqual({
          type: 'content',
          value: 'You are a helpful assistant',
        });
        expect(result[2]).toEqual({ type: 'role', value: 'user' });
        expect(result[3]).toEqual({ type: 'content', value: 'Hello' });
        expect(result[4]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[5]).toEqual({ type: 'content', value: 'Hi there' });
      });
    });
  });

  describe('Parser', () => {
    let parser: Parser;

    beforeEach(() => {
      parser = new Parser();
    });

    describe('parse', () => {
      it('should parse a simple conversation into separate message blocks', () => {
        const text = `user: Hello
assistant: Hi there
user: How are you?`;

        const result = parser.parse(text, 'test-case');

        expect(result.name).toBe('test-case');
        expect(result.messageBlocks).toHaveLength(3);

        // First message
        expect(result.messageBlocks[0]).toEqual({
          role: MessageRole.USER,
          content: 'Hello',
        });

        // Second message
        expect(result.messageBlocks[1]).toEqual({
          role: MessageRole.ASSISTANT,
          content: 'Hi there',
        });

        // Third message
        expect(result.messageBlocks[2]).toEqual({
          role: MessageRole.USER,
          content: 'How are you?',
        });
      });

      it('should parse system messages correctly', () => {
        const text = `system: You are a helpful assistant
user: Hello
assistant: Hi there`;

        const result = parser.parse(text, 'test-case');

        expect(result.messageBlocks).toHaveLength(3);
        expect(result.messageBlocks[0]).toEqual({
          role: MessageRole.SYSTEM,
          content: 'You are a helpful assistant',
        });
      });

      it('should throw error if system message appears after other messages', () => {
        const text = `user: Hello
system: You are a helpful assistant
assistant: Hi there`;

        expect(() => parser.parse(text, 'test-case')).toThrow(
          'System messages must appear at the start of the conversation',
        );
      });

      it('should handle example.txt format correctly', () => {
        const text = `user: hello
assistant: hello how can I help you?
user: can you please search the weather in new york for me?
assistant: sure

It's rainy in New York, NY, today, with a temperature of 59°F, 80% precipitation, 96% humidity, and light 2 mph winds. Be prepared for wet conditions!`;

        const result = parser.parse(text, 'example');

        expect(result.messageBlocks).toHaveLength(4);

        // First message
        expect(result.messageBlocks[0]).toEqual({
          role: MessageRole.USER,
          content: 'hello',
        });

        // Second message
        expect(result.messageBlocks[1]).toEqual({
          role: MessageRole.ASSISTANT,
          content: 'hello how can I help you?',
        });

        // Third message
        expect(result.messageBlocks[2]).toEqual({
          role: MessageRole.USER,
          content: 'can you please search the weather in new york for me?',
        });

        // Fourth message (merged)
        expect(result.messageBlocks[3]).toEqual({
          role: MessageRole.ASSISTANT,
          content:
            "sure\nIt's rainy in New York, NY, today, with a temperature of 59°F, 80% precipitation, 96% humidity, and light 2 mph winds. Be prepared for wet conditions!",
        });
      });

      it('should throw ParseError for invalid role', () => {
        const text = `invalid: Hello`;

        expect(() => parser.parse(text, 'test-case')).toThrow(ParseError);
      });
    });
  });

  describe('TestCaseLoader', () => {
    let loader: TestCaseLoader;
    let tempDir: string;

    beforeEach(async () => {
      loader = new TestCaseLoader();
      tempDir = join(tmpdir(), 'hebo-eval-tests');
      // Ensure clean directory for each test
      await mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Cleanup temp files
      try {
        const files = await readdir(tempDir);
        await Promise.all(files.map((file) => unlink(join(tempDir, file))));
        await rmdir(tempDir);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });

    describe('loadFromDirectory', () => {
      it('should load test cases from a directory', async () => {
        // Create test files
        const testFile1 = join(tempDir, 'test1.txt');
        const testFile2 = join(tempDir, 'test2.txt');

        // Create files and wait for them to be written
        await Promise.all([
          writeFile(
            testFile1,
            `user: Hello
assistant: Hi there`,
          ),
          writeFile(
            testFile2,
            `user: How are you?
assistant: I'm good`,
          ),
        ]);

        const result = await loader.loadFromDirectory(tempDir);

        expect(result.testCases).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
        expect(result.testCases[0].name).toBe('test1');
        expect(result.testCases[1].name).toBe('test2');
      });

      it('should handle invalid test files', async () => {
        // Create an invalid test file
        const invalidFile = join(tempDir, 'invalid.txt');
        await writeFile(invalidFile, 'invalid: content');

        const result = await loader.loadFromDirectory(tempDir);

        expect(result.testCases).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].filePath).toBe(invalidFile);
      });

      it('should handle non-existent directory', async () => {
        const nonExistentDir = join(tempDir, 'non-existent');
        const result = await loader.loadFromDirectory(nonExistentDir);

        expect(result.testCases).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].filePath).toBe(nonExistentDir);
      });

      it('should handle errors according to stopOnError parameter', async () => {
        // Create test files with one invalid file
        const validFile1 = join(tempDir, 'a_valid1.txt');
        const invalidFile = join(tempDir, 'b_invalid.txt');
        const validFile2 = join(tempDir, 'c_valid2.txt');

        await Promise.all([
          writeFile(
            validFile1,
            `user: Hello
assistant: Hi there`,
          ),
          writeFile(invalidFile, 'invalid: content'),
          writeFile(
            validFile2,
            `user: How are you?
assistant: I'm good`,
          ),
        ]);

        // Test with stopOnError = true (default)
        const resultWithStop = await loader.loadFromDirectory(tempDir);
        expect(resultWithStop.testCases).toHaveLength(1); // Only first valid file processed
        expect(resultWithStop.errors).toHaveLength(1);
        expect(resultWithStop.errors[0].filePath).toBe(invalidFile);

        // Test with stopOnError = false
        const resultWithoutStop = await loader.loadFromDirectory(
          tempDir,
          false,
        );
        expect(resultWithoutStop.testCases).toHaveLength(2); // Both valid files processed
        expect(resultWithoutStop.errors).toHaveLength(1);
        expect(resultWithoutStop.errors[0].filePath).toBe(invalidFile);
      });
    });
  });

  describe('Markdown Support', () => {
    let parser: Parser;

    beforeEach(() => {
      parser = new Parser();
    });

    it('should parse headers within message content', () => {
      const text = `user: Here are the headers:
# Level 1 Header
## Level 2 Header
### Level 3 Header

assistant: I see the headers`;

      const result = parser.parse(text, 'header-test');
      expect(result.messageBlocks).toHaveLength(2);
      expect(result.messageBlocks[0].content).not.toContain('# Level 1 Header');
      expect(result.messageBlocks[0].content).toContain('## Level 2 Header');
      expect(result.messageBlocks[0].content).toContain('### Level 3 Header');
    });

    it('should parse lists within message content', () => {
      const text = `user: Here are some lists:

1. Ordered List
   1. Nested item
   2. Another nested item
2. Second item

* Unordered List
  * Nested item
  * Another nested item

- [ ] Task List
- [x] Completed task

assistant: I see the lists`;

      const result = parser.parse(text, 'list-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('1. Ordered List');
      expect(content).toContain('* Unordered List');
      expect(content).toContain('- [ ] Task List');
      expect(content).toContain('- [x] Completed task');
    });

    it('should parse code blocks with language specification', () => {
      const text = `user: Here's some code:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

assistant: I see the code`;

      const result = parser.parse(text, 'code-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('```typescript');
      expect(content).toContain('function greet');
      expect(content).toContain('```');
    });

    it('should parse blockquotes and horizontal rules', () => {
      const text = `user: Here's a blockquote:

> This is a blockquote
> It can span multiple lines
> And can contain **bold** or _italic_ text

---

> Nested blockquotes:
> > This is a nested blockquote

assistant: I see the blockquotes`;

      const result = parser.parse(text, 'blockquote-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('> This is a blockquote');
      expect(content).toContain('---');
      expect(content).toContain('> > This is a nested blockquote');
    });

    it('should parse tables', () => {
      const text = `user: Here's a table:

| Feature | Description | Example |
|---------|-------------|---------|
| Headers | Column titles | \`# Header\` |
| Alignment | Text alignment | \`:---\` for left |

assistant: I see the table`;

      const result = parser.parse(text, 'table-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('| Feature | Description | Example |');
      expect(content).toContain('|---------|-------------|---------|');
    });

    it('should parse inline formatting', () => {
      const text = `user: Here's some formatted text:

**Bold text** uses double asterisks
_Italic text_ uses underscores
***Bold and italic*** can be combined
[Links](https://example.com) use square brackets

assistant: I see the formatting`;

      const result = parser.parse(text, 'formatting-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('**Bold text**');
      expect(content).toContain('_Italic text_');
      expect(content).toContain('***Bold and italic***');
      expect(content).toContain('[Links](https://example.com)');
    });

    it('should handle multiple test cases with Markdown', () => {
      const text = `# First Test Case

user: Here's a header:
# Level 1

assistant: I see the header

---

# Second Test Case

user: Here's a list:
* Item 1
* Item 2

assistant: I see the list`;

      const results = parser.parseMultiple(text, 'multi-test', 'test');
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('First Test Case');
      expect(results[1].name).toBe('Second Test Case');
      expect(results[0].messageBlocks[0].content).toContain('# Level 1');
      expect(results[1].messageBlocks[0].content).toContain('* Item 1');
    });

    it('should preserve nested Markdown structures', () => {
      const text = `user: Here's a complex structure:

> Blockquote with:
> 1. Ordered list
>    * Nested unordered list
>    * With **bold** and _italic_
> 2. Another item
>    \`\`\`typescript
>    const code = "in blockquote";
>    \`\`\`

assistant: I see the structure`;

      const result = parser.parse(text, 'nested-test');
      expect(result.messageBlocks).toHaveLength(2);
      const content = result.messageBlocks[0].content;
      expect(content).toContain('> Blockquote with:');
      expect(content).toContain('> 1. Ordered list');
      expect(content).toContain('>    * Nested unordered list');
      expect(content).toContain('**bold**');
      expect(content).toContain('_italic_');
      expect(content).toContain('>    ```typescript');
    });
  });
});
