import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import { MessageRole } from '../core/types/message.types';
import { Parser, ParsedTestCase } from '../parser/parser';
import { writeFile, rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('Evaluation System', () => {
  // Parser Tests
  describe('Parser', () => {
    let parser: Parser;
    let tempDir: string;

    beforeEach(async () => {
      parser = new Parser();
      tempDir = await mkdtemp(join(tmpdir(), 'hebo-eval-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should parse a valid test case file', async () => {
      const testCaseContent = `user: Hello
assistant: Hi there!`;

      const filePath = join(tempDir, 'test-case.txt');
      await writeFile(filePath, testCaseContent);

      const result = await parser.loadFromFile(filePath);

      expect(result).toBeDefined();
      expect(result.messageBlocks).toHaveLength(2);
      expect(result.messageBlocks[0].role).toBe(MessageRole.USER);
      expect(result.messageBlocks[0].content).toBe('Hello');
      expect(result.messageBlocks[1].role).toBe(MessageRole.ASSISTANT);
      expect(result.messageBlocks[1].content).toBe('Hi there!');
    });

    it('should handle invalid test case files', async () => {
      const invalidContent = 'Invalid content';
      const filePath = join(tempDir, 'invalid.txt');
      await writeFile(filePath, invalidContent);

      await expect(parser.loadFromFile(filePath)).rejects.toThrow();
    });
  });

  // Evaluation Executor Tests
  describe('EvaluationExecutor', () => {
    let executor: EvaluationExecutor;
    let mockAgent: jest.Mocked<IAgent>;

    beforeEach(() => {
      mockAgent = {
        config: { model: 'test-model' },
        getConfig: jest.fn().mockReturnValue({ model: 'test-model' }),
        initialize: jest.fn().mockImplementation(() => Promise.resolve()),
        authenticate: jest.fn().mockImplementation(() => Promise.resolve()),
        sendInput: jest.fn().mockImplementation(() =>
          Promise.resolve({
            response: 'Hi there!',
            metadata: { test: true },
          }),
        ),
        validateConfig: jest
          .fn()
          .mockImplementation(() => Promise.resolve(true)),
        cleanup: jest.fn().mockImplementation(() => Promise.resolve()),
      } as jest.Mocked<IAgent>;

      executor = new EvaluationExecutor();
    });

    it('should execute a test case successfully', async () => {
      const testCase: ParsedTestCase = {
        name: 'test-case',
        messageBlocks: [
          {
            role: MessageRole.USER,
            content: 'Hello',
            toolUsages: [],
            toolResponses: [],
          },
          {
            role: MessageRole.ASSISTANT,
            content: 'Hi there!',
            toolUsages: [],
            toolResponses: [],
          },
        ],
      };

      const result = await executor.executeTestCase(mockAgent, testCase);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockAgent.sendInput).toHaveBeenCalledTimes(1);
      expect(mockAgent.sendInput).toHaveBeenCalledWith({
        messages: [
          {
            role: MessageRole.USER,
            content: 'Hello',
          },
        ],
      });
    });

    it('should handle agent errors gracefully', async () => {
      const testCase: ParsedTestCase = {
        name: 'error-test',
        messageBlocks: [
          {
            role: MessageRole.USER,
            content: 'Hello',
            toolUsages: [],
            toolResponses: [],
          },
        ],
      };

      mockAgent.sendInput.mockRejectedValueOnce(new Error('Agent error'));

      const result = await executor.executeTestCase(mockAgent, testCase);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
