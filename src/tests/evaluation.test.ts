import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  EvaluationExecutor,
  EvaluationResult,
} from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentAuthConfig,
} from '../agents/types/agent.types';
import { MessageRole } from '../core/types/message.types';
import { TestCaseLoader } from '../evaluation/test-case-loader';
import { TestIsolationService } from '../evaluation/test-isolation-service';
import { TestCase } from '../evaluation/types/evaluation.types';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';

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

// Mock the test case loader
const mockLoadFromFile = jest
  .fn<(filePath: string) => Promise<TestCase>>()
  .mockImplementation(async (filePath: string) => {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    const messages: { role: MessageRole; content: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const roleStr = lines[i].split(':')[0].trim();
      const content = lines[i].split(':').slice(1).join(':').trim();

      if (!Object.values(MessageRole).includes(roleStr as MessageRole)) {
        throw new Error(`Invalid message role: ${roleStr}`);
      }

      messages.push({ role: roleStr as MessageRole, content });
    }

    // The last message is the expected output
    const expectedOutput = messages.pop()!;

    return {
      messages,
      expectedOutput,
    };
  });

jest.mock('../evaluation/test-case-loader', () => ({
  TestCaseLoader: jest.fn().mockImplementation(() => ({
    loadFromFile: mockLoadFromFile,
  })),
}));

// Mock the test isolation service
const mockPrepareTestEnvironment = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockCleanupTestEnvironment = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);

jest.mock('../evaluation/test-isolation-service', () => ({
  TestIsolationService: jest.fn().mockImplementation(() => ({
    prepareTestEnvironment: mockPrepareTestEnvironment,
    cleanupTestEnvironment: mockCleanupTestEnvironment,
  })),
}));

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
        config: { model: 'test-model' },
        isInitialized: true,
        isAuthenticated: true,
        getConfig: jest
          .fn<() => AgentConfig>()
          .mockReturnValue({ model: 'test-model' }),
        initialize: jest
          .fn<(config: AgentConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        sendInput: jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue({
            response: 'Goodbye',
            metadata: {},
            error: undefined,
          }),
        validateConfig: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        reset: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        clearMemory: jest
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
        cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      } as jest.Mocked<IAgent>;

      // Bind the mock methods to ensure proper this context
      mockAgent.sendInput = mockAgent.sendInput.bind(mockAgent);
      mockAgent.getConfig = mockAgent.getConfig.bind(mockAgent);
      mockAgent.initialize = mockAgent.initialize.bind(mockAgent);
      mockAgent.authenticate = mockAgent.authenticate.bind(mockAgent);
      mockAgent.validateConfig = mockAgent.validateConfig.bind(mockAgent);
      mockAgent.reset = mockAgent.reset.bind(mockAgent);
      mockAgent.clearMemory = mockAgent.clearMemory.bind(mockAgent);
      mockAgent.cleanup = mockAgent.cleanup.bind(mockAgent);

      service = new TestIsolationService(mockAgent);
    });

    it('should reset agent state when configured', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: false,
        timeoutMs: 1000,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAgent.reset).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAgent.clearMemory).not.toHaveBeenCalled();
    });

    it('should clear agent memory when configured', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: false,
        clearMemory: true,
        timeoutMs: 1000,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAgent.clearMemory).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAgent.reset).not.toHaveBeenCalled();
    });

    it('should handle both reset and clear memory', async () => {
      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: true,
        timeoutMs: 1000,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAgent.reset).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
          .fn<() => AgentConfig>()
          .mockReturnValue({ model: 'test-model' }),
        initialize: jest
          .fn<(config: AgentConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        sendInput: jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue({
            response: 'Goodbye',
            metadata: {},
            error: undefined,
          }),
        validateConfig: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        reset: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        clearMemory: jest
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
        cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      } as jest.Mocked<IAgent>;

      executor = new EvaluationExecutor(mockAgent);
    });

    describe('executeTestCase', () => {
      it('should execute a test case successfully', async () => {
        const result = await executor.executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockAgent.sendInput).toHaveBeenCalledWith({
          messages: mockTestCase.messages,
        });
      });

      it('should handle agent errors gracefully', async () => {
        mockAgent.sendInput.mockRejectedValueOnce(new Error('Agent error'));

        const result = await executor.executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Agent error');
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
      });

      it('should handle response mismatch', async () => {
        mockAgent.sendInput.mockResolvedValueOnce({
          response: 'Different response',
          metadata: {},
          error: undefined,
        });

        const result = await executor.executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(0);
        expect(result.executionTime).toBeDefined();
      });
    });

    describe('executeTestCasesSequential', () => {
      it('should execute multiple test cases sequentially', async () => {
        const testCases = [mockTestCase, mockTestCase];
        const mockedSendInput = jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue({
            response: 'Goodbye',
            metadata: {},
            error: undefined,
          });
        mockAgent.sendInput = mockedSendInput;

        const results = await executor.executeTestCasesSequential(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
        expect(mockedSendInput).toHaveBeenCalledTimes(2);
      });
    });

    describe('executeTestCasesParallel', () => {
      it('should execute multiple test cases in parallel', async () => {
        const testCases = [mockTestCase, mockTestCase];
        const mockedSendInput = jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue({
            response: 'Goodbye',
            metadata: {},
            error: undefined,
          });
        mockAgent.sendInput = mockedSendInput;

        const results = await executor.executeTestCasesParallel(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results.every((r: EvaluationResult) => r.success)).toBe(true);
        expect(
          results.every((r: EvaluationResult) => r.executionTime !== undefined),
        ).toBe(true);
        expect(mockedSendInput).toHaveBeenCalledTimes(2);
      });

      it('should handle errors in parallel execution', async () => {
        const testCases = [mockTestCase, mockTestCase];
        const mockedSendInput = jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValueOnce({ response: 'Goodbye', error: undefined })
          .mockRejectedValueOnce(new Error('Parallel execution error'));
        mockAgent.sendInput = mockedSendInput;

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
        const mockedCleanup = jest
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined);
        mockAgent.cleanup = mockedCleanup;

        await executor.cleanup();
        expect(mockedCleanup).toHaveBeenCalledTimes(1);
      });

      it('should handle cleanup errors gracefully', async () => {
        const mockedCleanup = jest
          .fn<() => Promise<void>>()
          .mockRejectedValue(new Error('Cleanup failed'));
        mockAgent.cleanup = mockedCleanup;

        await expect(executor.cleanup()).rejects.toThrow('Cleanup failed');
      });
    });
  });
});
