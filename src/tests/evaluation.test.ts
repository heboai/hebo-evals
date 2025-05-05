import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentAuthConfig,
} from '../agents/types/agent.types';
import { MessageRole } from '../core/types/message.types';
import { Parser, ParsedTestCase } from '../parser/parser';
import { TestIsolationService } from '../evaluation/test-isolation-service';
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
      tempDir = await mkdtemp(join(tmpdir(), 'hebo-eval-tests-'));
    });

    afterEach(async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should load a valid test case file', async () => {
      const testFile = join(tempDir, 'test.txt');
      const testContent = `
user: Hello
assistant: Hi there
user: How are you?
assistant: I'm good, thanks!
      `.trim();

      await writeFile(testFile, testContent, 'utf-8');

      const result = await parser.loadFromFile(testFile);

      expect(result.messageBlocks).toHaveLength(4);
      expect(result.messageBlocks[0]).toEqual({
        role: MessageRole.USER,
        content: 'Hello',
        toolUsages: [],
        toolResponses: [],
      });
      expect(result.messageBlocks[1]).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Hi there',
        toolUsages: [],
        toolResponses: [],
      });
      expect(result.messageBlocks[2]).toEqual({
        role: MessageRole.USER,
        content: 'How are you?',
        toolUsages: [],
        toolResponses: [],
      });
      expect(result.messageBlocks[3]).toEqual({
        role: MessageRole.ASSISTANT,
        content: "I'm good, thanks!",
        toolUsages: [],
        toolResponses: [],
      });
    });

    it('should handle tool messages', async () => {
      const testFile = join(tempDir, 'test-tool.txt');
      await writeFile(
        testFile,
        `
user: Request tool usage
assistant: Let me help you with that
tool use: search args: {"query": "test"}
tool response: Found results
assistant: Final response
    `.trim(),
      );

      const result = await parser.loadFromFile(testFile);

      expect(result.messageBlocks).toHaveLength(3);
      expect(result.messageBlocks[1]).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Let me help you with that',
        toolUsages: [{ name: 'search', args: '{"query": "test"}' }],
        toolResponses: [{ content: 'Found results' }],
      });
      expect(result.messageBlocks[2]).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Final response',
        toolUsages: [],
        toolResponses: [],
      });
    });

    it('should throw error for invalid message role', async () => {
      const testFile = join(tempDir, 'invalid-role.txt');
      await writeFile(
        testFile,
        `
invalid: Hello
assistant: Hi
      `.trim(),
      );

      await expect(parser.loadFromFile(testFile)).rejects.toThrow(
        'Invalid message role',
      );
    });

    it('should throw error for insufficient messages', async () => {
      const testFile = join(tempDir, 'insufficient.txt');
      await writeFile(testFile, 'user: Hello');

      await expect(parser.loadFromFile(testFile)).rejects.toThrow(
        'Test case must contain at least two messages', // Match parser's message
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
        getConfig: jest.fn(() => ({ model: 'test-model' })),
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

      service = new TestIsolationService(mockAgent);
    });

    it('should reset agent state when configured', async () => {
      const mockedReset = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      const mockedClearMemory = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      mockAgent.reset = mockedReset;
      mockAgent.clearMemory = mockedClearMemory;

      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: false,
        timeoutMs: 1000,
      });

      expect(mockedReset).toHaveBeenCalledTimes(1);
      expect(mockedClearMemory).not.toHaveBeenCalled();
    });

    it('should clear agent memory when configured', async () => {
      const mockedReset = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      const mockedClearMemory = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      mockAgent.reset = mockedReset;
      mockAgent.clearMemory = mockedClearMemory;

      await service.prepareTestEnvironment({
        resetAgentState: false,
        clearMemory: true,
        timeoutMs: 1000,
      });

      expect(mockedClearMemory).toHaveBeenCalledTimes(1);
      expect(mockedReset).not.toHaveBeenCalled();
    });

    it('should handle both reset and clear memory', async () => {
      const mockedReset = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      const mockedClearMemory = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      mockAgent.reset = mockedReset;
      mockAgent.clearMemory = mockedClearMemory;

      await service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: true,
        timeoutMs: 1000,
      });

      expect(mockedReset).toHaveBeenCalledTimes(1);
      expect(mockedClearMemory).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      const mockedReset = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('Reset failed'));
      mockAgent.reset = mockedReset;

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

    const mockTestCase: ParsedTestCase = {
      name: 'test',
      messageBlocks: [
        {
          role: MessageRole.USER,
          content: 'Hello',
          toolUsages: [],
          toolResponses: [],
        },
        {
          role: MessageRole.ASSISTANT,
          content: 'Hi there',
          toolUsages: [],
          toolResponses: [],
        },
      ],
    };

    beforeEach(() => {
      const mockConfig: AgentConfig = { model: 'test-model' };
      const mockOutput: AgentOutput = {
        response: 'Hi there', // Match the expected response
        metadata: {},
        error: undefined,
      };

      mockAgent = {
        getConfig: jest.fn<() => AgentConfig>().mockReturnValue(mockConfig),
        initialize: jest
          .fn<(config: AgentConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        authenticate: jest
          .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
          .mockResolvedValue(undefined),
        sendInput: jest
          .fn<(input: AgentInput) => Promise<AgentOutput>>()
          .mockResolvedValue(mockOutput),
        validateConfig: jest
          .fn<() => Promise<boolean>>()
          .mockResolvedValue(true),
        reset: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        clearMemory: jest
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
        cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      } as jest.Mocked<IAgent>;

      Object.defineProperties(mockAgent, {
        config: { value: mockConfig, writable: true },
        isInitialized: { value: true, writable: true },
        isAuthenticated: { value: true, writable: true },
      });

      executor = new EvaluationExecutor();
    });

    describe('executeTestCase', () => {
      it('should execute a test case successfully', async () => {
        const result = await executor.executeTestCase(mockAgent, mockTestCase);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(1);
        expect(result.executionTime).toBeDefined();
        expect(mockAgent.sendInput).toHaveBeenCalledWith({
          messages: [{ role: MessageRole.USER, content: 'Hello' }],
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
        expect(result.error).toBe('Response mismatch');
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
        expect(results.every((r) => r.score === 1)).toBe(true);
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
        expect(results.every((r) => r.success)).toBe(true);
        expect(results.every((r) => r.score === 1)).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(2);
      });

      it('should handle errors in parallel execution', async () => {
        const testCases = [mockTestCase, mockTestCase];
        mockAgent.sendInput
          .mockResolvedValueOnce({
            response: 'Hi there',
            metadata: {},
            error: undefined,
          })
          .mockRejectedValueOnce(new Error('Parallel execution error'));

        const results = await executor.executeTestCasesParallel(
          mockAgent,
          testCases,
        );

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[0].score).toBe(1);
        expect(results[1].success).toBe(false);
        expect(results[1].error).toBe('Parallel execution error');
        expect(results[1].score).toBe(0);
      });
    });
  });
});
