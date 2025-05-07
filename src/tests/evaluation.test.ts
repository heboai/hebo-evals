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
    let tempDir: string;

    beforeEach(async () => {
      executor = new EvaluationExecutor();
      mockAgent = {
        sendInput: jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockImplementation((input: AgentInput) => {
            // Return response based on the input message
            const lastMessage = input.messages[input.messages.length - 1];
            let response = '';

            if (lastMessage.content === 'Hello') {
              response = 'Hi there!';
            } else if (lastMessage.content === 'How are you?') {
              response = "I'm good!";
            }

            return Promise.resolve({ response });
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
      tempDir = await mkdtemp(join(tmpdir(), 'hebo-eval-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    describe('executeTestCase', () => {
      it('should execute a test case successfully', async () => {
        const testCase: TestCase = {
          id: 'test-case-1',
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
          id: 'test-case-2',
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

    describe('executeTestCasesFromDirectory', () => {
      it('should load and execute test cases from a directory', async () => {
        // Create test files
        const testFile1 = join(tempDir, 'test1.txt');
        const testFile2 = join(tempDir, 'test2.txt');

        await Promise.all([
          writeFile(
            testFile1,
            `user: Hello
assistant: Hi there!`,
          ),
          writeFile(
            testFile2,
            `user: How are you?
assistant: I'm good!`,
          ),
        ]);

        const results = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
        );

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(2);
      });

      it('should handle invalid test files', async () => {
        // Create an invalid test file
        const invalidFile = join(tempDir, 'invalid.txt');
        await writeFile(invalidFile, 'Invalid content');

        const results = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
        );

        expect(results).toHaveLength(0);
      });

      it('should handle empty directory', async () => {
        const results = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
        );

        expect(results).toHaveLength(0);
      });

      it('should handle non-existent directory', async () => {
        const nonExistentDir = join(tempDir, 'non-existent');
        const results = await executor.executeTestCasesFromDirectory(
          mockAgent,
          nonExistentDir,
        );

        expect(results).toHaveLength(0);
      });

      it('should handle mixed valid and invalid files', async () => {
        // Create test files with one invalid file
        const validFile = join(tempDir, 'valid.txt');
        const invalidFile = join(tempDir, 'invalid.txt');

        await Promise.all([
          writeFile(
            validFile,
            `user: Hello
assistant: Hi there!`,
          ),
          writeFile(invalidFile, 'Invalid content'),
        ]);

        // Test with stopOnError = true (default)
        const results = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
        );
        expect(results).toHaveLength(0); // No test cases processed due to stopOnError
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(0);

        // Reset mock
        (mockAgent.sendInput as jest.Mock).mockClear();

        // Test with stopOnError = false
        const resultsWithoutStop = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
          false,
        );
        expect(resultsWithoutStop).toHaveLength(1); // Valid file processed
        expect(resultsWithoutStop[0].success).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(1);
      });

      it('should respect stopOnError parameter', async () => {
        // Create test files with one invalid file
        const validFile1 = join(tempDir, 'a_valid1.txt');
        const invalidFile = join(tempDir, 'b_invalid.txt');
        const validFile2 = join(tempDir, 'c_valid2.txt');

        await Promise.all([
          writeFile(
            validFile1,
            `user: Hello
assistant: Hi there!`,
          ),
          writeFile(invalidFile, 'Invalid content'),
          writeFile(
            validFile2,
            `user: How are you?
assistant: I'm good!`,
          ),
        ]);

        // Test with stopOnError = true (default)
        const resultsWithStop = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
        );
        expect(resultsWithStop).toHaveLength(1); // Only first valid file processed
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(1);

        // Reset mock
        (mockAgent.sendInput as jest.Mock).mockClear();

        // Test with stopOnError = false
        const resultsWithoutStop = await executor.executeTestCasesFromDirectory(
          mockAgent,
          tempDir,
          false,
        );
        expect(resultsWithoutStop).toHaveLength(2); // Both valid files processed
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(2);
      });
    });
  });
});
