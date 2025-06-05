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
          toolUsages: [],
          toolResponses: [],
        });

        // Second message
        expect(result.messageBlocks[1]).toEqual({
          role: MessageRole.ASSISTANT,
          content: 'Hi there',
          toolUsages: [],
          toolResponses: [],
        });

        // Third message
        expect(result.messageBlocks[2]).toEqual({
          role: MessageRole.USER,
          content: 'How are you?',
          toolUsages: [],
          toolResponses: [],
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
          toolUsages: [],
          toolResponses: [],
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
          toolUsages: [],
          toolResponses: [],
        });

        // Second message
        expect(result.messageBlocks[1]).toEqual({
          role: MessageRole.ASSISTANT,
          content: 'hello how can I help you?',
          toolUsages: [],
          toolResponses: [],
        });

        // Third message
        expect(result.messageBlocks[2]).toEqual({
          role: MessageRole.USER,
          content: 'can you please search the weather in new york for me?',
          toolUsages: [],
          toolResponses: [],
        });

        // Fourth message (merged)
        expect(result.messageBlocks[3]).toEqual({
          role: MessageRole.ASSISTANT,
          content:
            "sure\nIt's rainy in New York, NY, today, with a temperature of 59°F, 80% precipitation, 96% humidity, and light 2 mph winds. Be prepared for wet conditions!",
          toolUsages: [],
          toolResponses: [],
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
});
