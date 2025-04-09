import { TestCaseParser } from '../parser/tokenizer.js';
import { Parser } from '../parser/parser.js';
import { TestCaseLoader } from '../parser/loader.js';
import {
  MessageRole,
  ToolUsage,
  ToolResponse,
} from '../core/types/message.types.js';
import { ParseError } from '../parser/parser.js';
import { writeFile, mkdir } from 'fs/promises';
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

      it('should parse tool usage and responses', () => {
        const text = `assistant: Let me check that
tool use: search args: {"query": "test"}
tool response: Found results`;

        const result = tokenizer.tokenize(text);

        expect(result).toHaveLength(5);
        expect(result[0]).toEqual({ type: 'role', value: 'assistant' });
        expect(result[1]).toEqual({
          type: 'content',
          value: 'Let me check that',
        });
        expect(result[2]).toEqual({ type: 'tool_use', value: 'search' });
        expect(result[3]).toEqual({ type: 'args', value: '{"query": "test"}' });
        expect(result[4]).toEqual({
          type: 'tool_response',
          value: 'Found results',
        });
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
    });
  });

  describe('Parser', () => {
    let parser: Parser;

    beforeEach(() => {
      parser = new Parser();
    });

    describe('parse', () => {
      it('should parse a valid test case', () => {
        const text = `user: Hello
assistant: Hi there
user: How are you?`;

        const result = parser.parse(text, 'test-case');

        expect(result.name).toBe('test-case');
        expect(result.messageBlocks).toHaveLength(3);
        expect(result.messageBlocks[0]).toEqual({
          role: MessageRole.USER,
          content: 'Hello',
          toolUsages: [],
          toolResponses: [],
        });
      });

      it('should handle tool usage and responses', () => {
        const text = `assistant: Let me check that
tool use: search
args: {"query": "test"}
tool response: Found results
assistant: Here's what I found`;

        const result = parser.parse(text, 'test-case');

        expect(result.messageBlocks).toHaveLength(1);
        expect(result.messageBlocks[0].toolUsages).toHaveLength(1);
        const messageBlock = result.messageBlocks[0];
        expect((messageBlock.toolUsages as ToolUsage[])[0]).toEqual({
          name: 'search',
          args: { query: 'test' },
        });
        expect((messageBlock.toolResponses as ToolResponse[])[0]).toEqual({
          content: 'Found results',
        });
      });

      it('should throw ParseError for invalid role', () => {
        const text = `invalid: Hello`;

        expect(() => parser.parse(text, 'test-case')).toThrow(ParseError);
      });

      it('should throw ParseError for invalid tool args format', () => {
        const text = `assistant: Let me check
tool use: search
args: invalid json`;

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
      await mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Cleanup temp files
      // Note: In a real implementation, you'd want to properly clean up the temp directory
    });

    describe('loadFromDirectory', () => {
      it('should load test cases from a directory', async () => {
        // Create test files
        const testFile1 = join(tempDir, 'test1.txt');
        const testFile2 = join(tempDir, 'test2.txt');

        await writeFile(
          testFile1,
          `user: Hello
assistant: Hi there`,
        );

        await writeFile(
          testFile2,
          `user: How are you?
assistant: I'm good`,
        );

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
    });
  });
});
