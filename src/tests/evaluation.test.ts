import { jest } from '@jest/globals';
import { Embeddings } from 'langchain/embeddings/base';
import { AsyncCaller } from 'langchain/dist/util/async_caller';
import { EvaluationService } from '../core/evaluation/evaluation-service';
import { EvaluationConfig } from '../core/types/evaluation';

describe('EvaluationService', () => {
  let evaluationService: EvaluationService;
  const defaultConfig: EvaluationConfig = {
    threshold: 0.7,
    useSemanticScoring: false,
    outputFormat: 'markdown',
  };

  const testCases = [
    {
      id: 'test-1',
      input: 'What is 2+2?',
      expected: '4',
    },
    {
      id: 'test-2',
      input: 'What is 3+3?',
      expected: '6',
    },
  ];

  beforeEach(() => {
    evaluationService = new EvaluationService(defaultConfig);
  });

  describe('evaluate', () => {
    it('should generate a report for all test cases', async () => {
      const report = await evaluationService.evaluate(testCases);

      expect(report).toContain('# Evaluation Report');
      expect(report).toContain('Total Tests: 2');
      expect(report).toContain('test-1');
      expect(report).toContain('test-2');
    });

    it('should include duration in the report', async () => {
      const report = await evaluationService.evaluate(testCases);
      expect(report).toMatch(/Duration: \d+\.\d+s/);
    });

    it('should handle test execution errors gracefully', async () => {
      // Mock the executeTest method to throw an error
      jest
        .spyOn(evaluationService as any, 'executeTest')
        .mockImplementation(() => {
          throw new Error('Test execution failed');
        });

      const report = await evaluationService.evaluate(testCases);

      expect(report).toContain('Test execution failed');
      expect(report).toContain('❌ Failed');
    });

    it('should calculate correct pass/fail statistics', async () => {
      // Mock the executeTest method to return different results
      jest
        .spyOn(evaluationService as any, 'executeTest')
        .mockImplementationOnce(() => '4') // Correct answer
        .mockImplementationOnce(() => '5'); // Wrong answer

      const report = await evaluationService.evaluate(testCases);

      expect(report).toContain('Passed: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Pass Rate: 50.00%');
    });
  });

  describe('with semantic scoring', () => {
    it('should use semantic scoring when configured', async () => {
      const semanticConfig: EvaluationConfig = {
        ...defaultConfig,
        useSemanticScoring: true,
      };

      // Properly type the mock embeddings with explicit return types
      const mockEmbeddings: Embeddings = {
        caller: {} as AsyncCaller,
        embedQuery: jest
          .fn<(input: string) => Promise<number[]>>()
          .mockResolvedValue([0.1, 0.2, 0.3]),
        embedDocuments: jest
          .fn<(inputs: string[]) => Promise<number[][]>>()
          .mockResolvedValue([[0.1, 0.2, 0.3]]),
      };

      const semanticService = new EvaluationService(
        semanticConfig,
        mockEmbeddings,
      );
      await semanticService.evaluate(testCases);

      expect(mockEmbeddings.embedQuery).toHaveBeenCalled();
    });
  });

  describe('with different output formats', () => {
    it('should generate JSON report when configured', async () => {
      const jsonConfig: EvaluationConfig = {
        ...defaultConfig,
        outputFormat: 'json',
      };
      const jsonService = new EvaluationService(jsonConfig);

      const report = await jsonService.evaluate(testCases);
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it('should generate text report when configured', async () => {
      const textConfig: EvaluationConfig = {
        ...defaultConfig,
        outputFormat: 'text',
      };
      const textService = new EvaluationService(textConfig);

      const report = await textService.evaluate(testCases);
      expect(report).toContain('Evaluation Report');
      expect(report).not.toContain('#');
    });
  });
});
