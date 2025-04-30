import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  EvaluationExecutor,
  EvaluationResult,
} from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import { MessageRole } from '../core/types/message.types';
import { TestCaseLoader } from '../evaluation/test-case-loader';
import { TestIsolationService } from '../evaluation/test-isolation-service';
import { TestCase } from '../evaluation/types/evaluation.types';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';

jest.mock('../evaluation/test-case-loader');
jest.mock('../evaluation/test-isolation-service');

describe('Evaluation System', () => {
  // Test Case Loader Tests
  describe('TestCaseLoader', () => {
    let loader: TestCaseLoader;
    let tempDir: string;

    beforeEach(() => {
      loader = new TestCaseLoader();
      tempDir = join(tmpdir(), 'hebo-eval-tests');
    });

    afterEach(async () => {
      try {
        await rm(tempDir, {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should load a valid test case file', async () => {
      const testFile = join(tempDir, 'test.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        testFile,
        `
user: Hello
assistant: Hi there
user: How are you?
assistant: I'm good, thanks!
      `.trim(),
      );

      const result = await loader.loadFromFile(testFile);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]).toEqual({
        role: MessageRole.USER,
        content: 'Hello',
      });
      expect(result.messages[1]).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Hi there',
      });
      expect(result.messages[2]).toEqual({
        role: MessageRole.USER,
        content: 'How are you?',
      });
      expect(result.expectedOutput).toEqual({
        role: MessageRole.ASSISTANT,
        content: "I'm good, thanks!",
      });
    });

    it('should handle tool messages', async () => {
      const testFile = join(tempDir, 'test-tool.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        testFile,
        `
user: Use a tool
tool: tool_name
assistant: Tool result
      `.trim(),
      );

      const result = await loader.loadFromFile(testFile);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        role: MessageRole.USER,
        content: 'Use a tool',
      });
      expect(result.messages[1]).toEqual({
        role: MessageRole.TOOL,
        content: 'tool_name',
      });
      expect(result.expectedOutput).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Tool result',
      });
    });

    it('should throw error for invalid message role', async () => {
      const testFile = join(tempDir, 'invalid-role.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(
        testFile,
        `
invalid: Hello
assistant: Hi
      `.trim(),
      );

      await expect(loader.loadFromFile(testFile)).rejects.toThrow(
        'Invalid message role',
      );
    });

    it('should throw error for insufficient messages', async () => {
      const testFile = join(tempDir, 'insufficient.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(testFile, 'user: Hello');

      await expect(loader.loadFromFile(testFile)).rejects.toThrow(
        'Test case file must contain at least two messages',
      );
    });
  });

  // Test Isolation Service Tests
  describe('TestIsolationService', () => {
    let service: TestIsolationService;
    let mockAgent: jest.Mocked<IAgent>;

    beforeEach(() => {
      mockAgent = {
        getConfig: jest.fn<IAgent['getConfig']>().mockReturnValue({
          model: 'test-model',
        }),
        initialize: jest
          .fn<IAgent['initialize']>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<IAgent['authenticate']>()
          .mockResolvedValue(undefined),
        sendInput: jest.fn<IAgent['sendInput']>(),
        validateConfig: jest
          .fn<IAgent['validateConfig']>()
          .mockResolvedValue(true),
        reset: jest.fn<IAgent['reset']>().mockResolvedValue(undefined),
        clearMemory: jest
          .fn<IAgent['clearMemory']>()
          .mockResolvedValue(undefined),
        cleanup: jest.fn<IAgent['cleanup']>().mockResolvedValue(undefined),
      } as jest.Mocked<IAgent>;

      service = new TestIsolationService(mockAgent);
    });

    it('should reset agent state when configured', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: false,
        timeoutMs: 1000,
      });

      expect(mockAgent.reset).toHaveBeenCalledTimes(1);
      expect(mockAgent.clearMemory).not.toHaveBeenCalled();
    });

    it('should clear agent memory when configured', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: false,
        clearMemory: true,
        timeoutMs: 1000,
      });

      expect(mockAgent.clearMemory).toHaveBeenCalledTimes(1);
      expect(mockAgent.reset).not.toHaveBeenCalled();
    });

    it('should handle both reset and clear memory', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: true,
        timeoutMs: 1000,
      });

      expect(mockAgent.reset).toHaveBeenCalledTimes(1);
      expect(mockAgent.clearMemory).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockAgent.reset.mockRejectedValueOnce(new Error('Reset failed'));

      await expect(
        service.prepareTestEnvironment({
          resetAgentState: true,
          clearMemory: false,
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('Reset failed');
    });
  });

  // Evaluation Executor Tests
  describe('EvaluationExecutor', () => {
    let executor: EvaluationExecutor;
    let mockAgent: jest.Mocked<IAgent>;
    let mockTestCaseLoader: jest.Mocked<TestCaseLoader>;
    let mockTestIsolationService: jest.Mocked<TestIsolationService>;

    const mockTestCase: TestCase = {
      messages: [
        { role: MessageRole.USER, content: 'Hello' },
        { role: MessageRole.ASSISTANT, content: 'Hi there' },
      ],
      expectedOutput: { role: MessageRole.ASSISTANT, content: 'Goodbye' },
    };

    beforeEach(() => {
      mockAgent = {
        config: { model: 'test-model' },
        isInitialized: true,
        isAuthenticated: true,
        getConfig: jest
          .fn<IAgent['getConfig']>()
          .mockReturnValue({ model: 'test-model' }),
        initialize: jest
          .fn<IAgent['initialize']>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<IAgent['authenticate']>()
          .mockResolvedValue(undefined),
        sendInput: jest.fn<IAgent['sendInput']>().mockResolvedValue({
          response: 'Goodbye',
          metadata: {},
          error: undefined,
        }),
        validateConfig: jest
          .fn<IAgent['validateConfig']>()
          .mockResolvedValue(true),
        reset: jest.fn<IAgent['reset']>().mockResolvedValue(undefined),
        clearMemory: jest
          .fn<IAgent['clearMemory']>()
          .mockResolvedValue(undefined),
        cleanup: jest.fn<IAgent['cleanup']>().mockResolvedValue(undefined),
        getAuthHeaders: jest
          .fn()
          .mockReturnValue({ Authorization: 'Bearer test' }),
        processInput: jest.fn<IAgent['sendInput']>().mockResolvedValue({
          response: 'Goodbye',
          metadata: {},
          error: undefined,
        }),
      } as jest.Mocked<IAgent>;

      mockTestCaseLoader = new TestCaseLoader() as jest.Mocked<TestCaseLoader>;
      mockTestIsolationService = new TestIsolationService(
        mockAgent,
      ) as jest.Mocked<TestIsolationService>;

      (TestCaseLoader as jest.Mock).mockImplementation(
        () => mockTestCaseLoader,
      );
      (TestIsolationService as jest.Mock).mockImplementation(
        () => mockTestIsolationService,
      );

      executor = new EvaluationExecutor(mockAgent);
    });

    describe('executeTestCase', () => {
      it('should execute a test case successfully', async () => {
        const executeTestCase = executor.executeTestCase.bind(executor);
        const result = await executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
        expect(mockAgent.sendInput).toHaveBeenCalledWith({
          messages: mockTestCase.messages,
        });
      });

      it('should handle agent errors gracefully', async () => {
        const executeTestCase = executor.executeTestCase.bind(executor);
        mockAgent.sendInput.mockRejectedValueOnce(new Error('Agent error'));

        const result = await executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Agent error');
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
      });

      it('should handle response mismatch', async () => {
        const executeTestCase = executor.executeTestCase.bind(executor);
        mockAgent.sendInput.mockResolvedValueOnce({
          response: 'Different response',
          metadata: {},
          error: undefined,
        });

        const result = await executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
      });
    });

    describe('executeTestCasesSequential', () => {
      it('should execute multiple test cases sequentially', async () => {
        const testCases = [mockTestCase, mockTestCase];
        const results = await executor.executeTestCasesSequential(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(2);
      });
    });

    describe('executeTestCasesParallel', () => {
      it('should execute multiple test cases in parallel', async () => {
        const testCases = [mockTestCase, mockTestCase];
        const results = await executor.executeTestCasesParallel(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results.every((r: EvaluationResult) => r.success)).toBe(true);
        expect(
          results.every((r: EvaluationResult) => r.executionTime !== undefined),
        ).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(2);
      });

      it('should handle errors in parallel execution', async () => {
        const testCases = [mockTestCase, mockTestCase];
        mockAgent.sendInput
          .mockResolvedValueOnce({ response: 'Goodbye', error: undefined })
          .mockRejectedValueOnce(new Error('Parallel execution error'));

        const results = await executor.executeTestCasesParallel(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);
        expect(results[1].error).toBe('Parallel execution error');
      });
    });

    describe('cleanup', () => {
      it('should cleanup agent resources', async () => {
        await executor.cleanup();
        expect(mockAgent.cleanup).toHaveBeenCalledTimes(1);
      });

      it('should handle cleanup errors gracefully', async () => {
        mockAgent.cleanup.mockRejectedValueOnce(new Error('Cleanup failed'));
        await expect(executor.cleanup()).rejects.toThrow('Cleanup failed');
      });
    });
  });
});
