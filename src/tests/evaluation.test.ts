import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { ScoringService } from '../scoring/scoring.service';
import { IAgent } from '../agents/interfaces/agent.interface';
import { TestCase, MessageRole } from '../core/types/message.types';
import { EvaluationConfig } from '../report/evaluation-types';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../scoring/scoring.service');
jest.mock('../parser/loader');
jest.mock('../report/report-generator');

describe('EvaluationExecutor', () => {
  let evaluationExecutor: EvaluationExecutor;
  let mockScoringService: jest.Mocked<ScoringService>;
  let mockAgent: jest.Mocked<IAgent>;
  let mockConfig: EvaluationConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock scoring service
    mockScoringService = {
      scoreStrings: jest.fn(),
    } as unknown as jest.Mocked<ScoringService>;

    // Setup mock agent
    mockAgent = {
      sendInput: jest.fn(),
    } as unknown as jest.Mocked<IAgent>;

    // Setup mock config
    mockConfig = {
      threshold: 0.7,
      useSemanticScoring: true,
      outputFormat: 'json',
      maxConcurrency: 5,
    };

    evaluationExecutor = new EvaluationExecutor(mockScoringService, mockConfig);
  });

  describe('executeTestCase', () => {
    const mockTestCase: TestCase = {
      id: 'test-1',
      name: 'test-1',
      messageBlocks: [
        { role: MessageRole.USER, content: 'Hello' },
        { role: MessageRole.ASSISTANT, content: 'Hi there!' },
      ],
    };

    it('should successfully execute a test case and return correct result', async () => {
      // Setup
      const mockResponse = { response: 'Hi there!' };
      mockAgent.sendInput.mockResolvedValue(mockResponse);
      mockScoringService.scoreStrings.mockResolvedValue(0.9);

      // Execute
      const result = await evaluationExecutor.executeTestCase(
        mockAgent,
        mockTestCase,
      );

      // Assert
      expect(result.testCaseId).toBe('test-1');
      expect(result.success).toBe(true);
      expect(result.score).toBe(0.9);
      expect(result.error).toBeUndefined();
      expect(result.response).toBe('Hi there!');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.testCase).toBe(mockTestCase);
    });

    it('should handle test case with insufficient message blocks', async () => {
      // Setup
      const invalidTestCase: TestCase = {
        id: 'test-2',
        name: 'test-2',
        messageBlocks: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      // Execute
      const result = await evaluationExecutor.executeTestCase(
        mockAgent,
        invalidTestCase,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Test case must have at least 2 message blocks: input and expected output',
      );
      expect(result.score).toBe(0);
      expect(result.testCase).toBe(invalidTestCase);
    });

    it('should handle agent errors gracefully', async () => {
      // Setup
      mockAgent.sendInput.mockRejectedValue(new Error('Agent error'));

      // Execute
      const result = await evaluationExecutor.executeTestCase(
        mockAgent,
        mockTestCase,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent error');
      expect(result.score).toBe(0);
      expect(result.testCase).toBe(mockTestCase);
    });
  });

  describe('executeTestCases', () => {
    const mockTestCases: TestCase[] = [
      {
        id: 'test-1',
        name: 'test-1',
        messageBlocks: [
          { role: MessageRole.USER, content: 'Hello' },
          { role: MessageRole.ASSISTANT, content: 'Hi there!' },
        ],
      },
      {
        id: 'test-2',
        name: 'test-2',
        messageBlocks: [
          { role: MessageRole.USER, content: 'How are you?' },
          { role: MessageRole.ASSISTANT, content: 'I am fine, thank you!' },
        ],
      },
    ];

    it('should execute multiple test cases successfully', async () => {
      // Setup
      mockAgent.sendInput
        .mockResolvedValueOnce({ response: 'Hi there!' })
        .mockResolvedValueOnce({ response: 'I am fine, thank you!' });
      mockScoringService.scoreStrings
        .mockResolvedValueOnce(0.9)
        .mockResolvedValueOnce(0.8);

      // Execute
      const results = await evaluationExecutor.executeTestCases(
        mockAgent,
        mockTestCases,
      );

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].score).toBe(0.9);
      expect(results[1].score).toBe(0.8);
      expect(results[0].testCase).toBe(mockTestCases[0]);
      expect(results[1].testCase).toBe(mockTestCases[1]);
    });

    it('should continue execution even if one test case fails', async () => {
      // Setup
      mockAgent.sendInput
        .mockResolvedValueOnce({ response: 'Hi there!' })
        .mockRejectedValueOnce(new Error('Agent error'));
      mockScoringService.scoreStrings.mockResolvedValueOnce(0.9);

      // Execute
      const results = await evaluationExecutor.executeTestCases(
        mockAgent,
        mockTestCases,
      );

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Agent error');
      expect(results[0].testCase).toBe(mockTestCases[0]);
      expect(results[1].testCase).toBe(mockTestCases[1]);
    });
  });

  describe('evaluateFromDirectory', () => {
    it('should generate a complete evaluation report', async () => {
      // Setup
      const mockTestCase1: TestCase = {
        id: 'test-1',
        name: 'test-1',
        messageBlocks: [
          { role: MessageRole.USER, content: 'Hello' },
          { role: MessageRole.ASSISTANT, content: 'Hi there!' },
        ],
      };
      const mockTestCase2: TestCase = {
        id: 'test-2',
        name: 'test-2',
        messageBlocks: [
          { role: MessageRole.USER, content: 'How are you?' },
          { role: MessageRole.ASSISTANT, content: 'I am fine, thank you!' },
        ],
      };

      const mockResults = [
        {
          testCaseId: 'test-1',
          success: true,
          score: 0.9,
          executionTime: 100,
          response: 'Hi there!',
          testCase: mockTestCase1,
        },
        {
          testCaseId: 'test-2',
          success: false,
          score: 0.3,
          executionTime: 100,
          error: 'Response mismatch',
          response: 'Wrong answer',
          testCase: mockTestCase2,
        },
      ];

      // Mock the internal method to return our test results
      jest
        .spyOn(
          evaluationExecutor as unknown as {
            executeTestCasesInParallel: (typeof evaluationExecutor)['executeTestCasesInParallel'];
          },
          'executeTestCasesInParallel',
        )
        .mockResolvedValue(mockResults);

      // Execute
      const report = await evaluationExecutor.evaluateFromDirectory(
        mockAgent,
        './test-cases',
        true,
      );

      // Assert
      expect(report.totalTests).toBe(2);
      expect(report.passedTests).toBe(1);
      expect(report.failedTests).toBe(1);
      expect(report.passRate).toBe(0.5);
      expect(report.results).toHaveLength(2);
      expect(report.duration).toBeGreaterThan(0);
    });

    it('should handle empty directory gracefully', async () => {
      // Setup
      jest
        .spyOn(
          evaluationExecutor as unknown as {
            executeTestCasesInParallel: (typeof evaluationExecutor)['executeTestCasesInParallel'];
          },
          'executeTestCasesInParallel',
        )
        .mockResolvedValue([]);

      // Execute
      const report = await evaluationExecutor.evaluateFromDirectory(
        mockAgent,
        './empty-directory',
        true,
      );

      // Assert
      expect(report.totalTests).toBe(0);
      expect(report.passedTests).toBe(0);
      expect(report.failedTests).toBe(0);
      expect(report.passRate).toBe(0);
      expect(report.results).toHaveLength(0);
    });
  });
});
