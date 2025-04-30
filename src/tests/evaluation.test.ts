import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { IAgent } from '../agents/interfaces/agent.interface';
import { AgentInput, AgentOutput } from '../agents/types/agent.types';
import { BaseMessage, MessageRole } from '../core/types/message.types';
import { TestCaseLoader } from '../evaluation/test-case-loader';
import { TestIsolationService } from '../evaluation/test-isolation-service';
import { TestCase } from '../evaluation/types/evaluation.types';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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
        await require('fs/promises').rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should load a valid test case file', async () => {
      const testFile = join(tempDir, 'test.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(testFile, `
user: Hello
assistant: Hi there
user: How are you?
assistant: I'm good, thanks!
      `.trim());

      const result = await loader.loadFromFile(testFile);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]).toEqual({
        role: MessageRole.USER,
        content: 'Hello'
      });
      expect(result.messages[1]).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Hi there'
      });
      expect(result.messages[2]).toEqual({
        role: MessageRole.USER,
        content: 'How are you?'
      });
      expect(result.expectedOutput).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'I\'m good, thanks!'
      });
    });

    it('should handle tool messages', async () => {
      const testFile = join(tempDir, 'test-tool.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(testFile, `
user: Use a tool
tool: tool_name
assistant: Tool result
      `.trim());

      const result = await loader.loadFromFile(testFile);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        role: MessageRole.USER,
        content: 'Use a tool'
      });
      expect(result.messages[1]).toEqual({
        role: MessageRole.TOOL,
        content: 'tool_name'
      });
      expect(result.expectedOutput).toEqual({
        role: MessageRole.ASSISTANT,
        content: 'Tool result'
      });
    });

    it('should throw error for invalid message role', async () => {
      const testFile = join(tempDir, 'invalid-role.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(testFile, `
invalid: Hello
assistant: Hi
      `.trim());

      await expect(loader.loadFromFile(testFile)).rejects.toThrow('Invalid message role');
    });

    it('should throw error for insufficient messages', async () => {
      const testFile = join(tempDir, 'insufficient.txt');
      await mkdir(tempDir, { recursive: true });
      await writeFile(testFile, 'user: Hello');

      await expect(loader.loadFromFile(testFile)).rejects.toThrow('Test case file must contain at least two messages');
    });
  });

  // Test Isolation Service Tests
  describe('TestIsolationService', () => {
    let service: TestIsolationService;
    let mockAgent: jest.Mocked<IAgent>;

    beforeEach(() => {
      mockAgent = {
        getConfig: jest.fn().mockReturnValue({}),
        initialize: jest.fn().mockResolvedValue(undefined),
        authenticate: jest.fn().mockResolvedValue(undefined),
        sendInput: jest.fn(),
        validateConfig: jest.fn().mockResolvedValue(true),
        reset: jest.fn().mockResolvedValue(undefined),
        clearMemory: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
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

      await expect(service.prepareTestEnvironment({
        resetAgentState: true,
        clearMemory: false,
        timeoutMs: 1000,
      })).rejects.toThrow('Reset failed');
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
        getConfig: jest.fn().mockReturnValue({}),
        initialize: jest.fn().mockResolvedValue(undefined),
        authenticate: jest.fn().mockResolvedValue(undefined),
        sendInput: jest.fn().mockResolvedValue({ response: 'Goodbye', error: undefined }),
        validateConfig: jest.fn().mockResolvedValue(true),
        reset: jest.fn().mockResolvedValue(undefined),
        clearMemory: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
      } as jest.Mocked<IAgent>;

      mockTestCaseLoader = new TestCaseLoader() as jest.Mocked<TestCaseLoader>;
      mockTestIsolationService = new TestIsolationService(mockAgent) as jest.Mocked<TestIsolationService>;

      (TestCaseLoader as jest.Mock).mockImplementation(() => mockTestCaseLoader);
      (TestIsolationService as jest.Mock).mockImplementation(() => mockTestIsolationService);

      executor = new EvaluationExecutor(mockAgent);
    });

    describe('executeTestCase', () => {
      it('should execute a test case successfully', async () => {
        const result = await executor.executeTestCase(mockTestCase);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.score).toBe(1.0);
        expect(result.executionTime).toBeDefined();
        expect(mockAgent.sendInput).toHaveBeenCalledWith({
          messages: [mockTestCase.messages[0], mockTestCase.messages[1]],
        });
      });

      it('should handle agent errors gracefully', async () => {
        mockAgent.sendInput.mockRejectedValueOnce(new Error('Agent error'));

        const result = await executor.executeTestCase(mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Agent error');
        expect(result.score).toBe(0.0);
        expect(result.executionTime).toBeDefined();
      });

      it('should handle test isolation errors gracefully', async () => {
        mockTestIsolationService.prepareTestEnvironment.mockRejectedValueOnce(
          new Error('Isolation error'),
        );

        const result = await executor.executeTestCase(mockTestCase);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Isolation error');
        expect(result.score).toBe(0.0);
        expect(result.executionTime).toBeDefined();
      });
    });

    describe('executeTestCases', () => {
      it('should execute multiple test cases in parallel', async () => {
        const testCases = [mockTestCase, mockTestCase, mockTestCase];
        mockTestCaseLoader.loadFromExamplesDir.mockResolvedValue(testCases);

        const results = await executor.executeTestCases(undefined, undefined, 2);

        expect(results).toHaveLength(3);
        expect(results.every(r => r.success)).toBe(true);
        expect(mockAgent.sendInput).toHaveBeenCalledTimes(3);
      });

      it('should handle errors in parallel execution', async () => {
        const testCases = [mockTestCase, mockTestCase, mockTestCase];
        mockTestCaseLoader.loadFromExamplesDir.mockResolvedValue(testCases);
        mockAgent.sendInput
          .mockResolvedValueOnce({ response: 'Goodbye', error: undefined })
          .mockRejectedValueOnce(new Error('Agent error'))
          .mockResolvedValueOnce({ response: 'Goodbye', error: undefined });

        const results = await executor.executeTestCases(undefined, undefined, 2);

        expect(results).toHaveLength(3);
        expect(results.filter(r => r.success)).toHaveLength(2);
        expect(results.filter(r => !r.success)).toHaveLength(1);
      });

      it('should handle empty test case list', async () => {
        mockTestCaseLoader.loadFromExamplesDir.mockResolvedValue([]);

        await expect(executor.executeTestCases()).rejects.toThrow(
          'No test cases provided and no default test cases found in examples directory',
        );
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