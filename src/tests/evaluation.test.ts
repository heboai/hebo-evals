import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import { MessageRole, TestCase } from '../core/types/message.types';
import { TestCaseLoader } from '../parser/loader';
import { writeFile, rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentAuthConfig,
} from '../agents/types/agent.types';

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
    let loader: TestCaseLoader;
    let tempDir: string;

    beforeEach(async () => {
      loader = new TestCaseLoader();
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

      const result = await loader.loadFile(filePath);

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

      await expect(loader.loadFile(filePath)).rejects.toThrow();
    });
  });

  // Evaluation Executor Tests
  describe('EvaluationExecutor', () => {
    let executor: EvaluationExecutor;
    let mockAgent: IAgent;

    beforeEach(() => {
      executor = new EvaluationExecutor();
      mockAgent = {
        sendInput: jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue({
            response: 'Hi there!',
          }),
        getConfig: jest.fn<() => AgentConfig>().mockReturnValue({
          model: 'test-model',
        }),
        initialize: jest
          .fn<(config: AgentConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        validateConfig: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };
    });

    it('should execute a test case successfully', async () => {
      const testCase: TestCase = {
        name: 'test-case',
        messageBlocks: [
          {
            role: MessageRole.USER,
            content: 'Hello',
          },
          {
            role: MessageRole.ASSISTANT,
            content: 'Hi there!',
          },
        ],
      };

      const result = await executor.executeTestCase(mockAgent, testCase);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.score).toBe(1);
      expect(result.error).toBeUndefined();
      expect(mockAgent.sendInput).toHaveBeenCalledTimes(1);
    });

    it('should handle test case execution failure', async () => {
      const testCase: TestCase = {
        name: 'test-case',
        messageBlocks: [
          {
            role: MessageRole.USER,
            content: 'Hello',
          },
          {
            role: MessageRole.ASSISTANT,
            content: 'Hi there!',
          },
        ],
      };

      (
        mockAgent.sendInput as jest.Mock<
          (input: AgentInput) => Promise<AgentOutput>
        >
      ).mockRejectedValue(new Error('Test error'));

      const result = await executor.executeTestCase(mockAgent, testCase);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.score).toBe(0);
    });
  });
});
