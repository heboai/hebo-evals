import { ReportGenerator } from '../core/services/report-generator.js';
import {
  EvaluationResult,
  EvaluationReport,
} from '../core/types/evaluation.type.js';

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  const defaultThreshold = 0.7;

  const mockResults: EvaluationResult[] = [
    {
      testCaseId: 'test-1',
      inputMessages: [{ role: 'user', content: 'What is the weather?' }],
      expectedOutput: { role: 'assistant', content: 'The weather is sunny' },
      observedOutput: { role: 'assistant', content: 'The weather is sunny' },
      score: 0.95,
      passed: true,
    },
    {
      testCaseId: 'test-2',
      inputMessages: [{ role: 'user', content: 'What is the weather?' }],
      expectedOutput: { role: 'assistant', content: 'The weather is sunny' },
      observedOutput: { role: 'assistant', content: 'It is raining' },
      score: 0.3,
      passed: false,
    },
  ];

  beforeEach(() => {
    reportGenerator = new ReportGenerator({ threshold: defaultThreshold });
  });

  describe('Report Generation and Scoring', () => {
    it('should generate a comprehensive report with all required components', () => {
      const report = reportGenerator.generateReport(mockResults);

      // Test aggregate summary
      expect(report.summary).toEqual({
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        passRate: 50,
        averageScore: 0.625, // (0.95 + 0.3) / 2
        threshold: defaultThreshold,
      });

      // Test detailed results
      expect(report.results).toHaveLength(2);
      expect(report.results[0]).toMatchObject({
        testCaseId: 'test-1',
        passed: true,
        score: 0.95,
        inputMessages: expect.any(Array),
        expectedOutput: expect.any(Object),
        observedOutput: expect.any(Object),
        metadata: {
          timestamp: expect.any(String),
          scoringMethod: 'semantic-similarity',
          threshold: defaultThreshold,
        },
      });
    });

    it('should correctly apply scoring threshold', () => {
      const customThreshold = 0.8;
      reportGenerator = new ReportGenerator({ threshold: customThreshold });
      const report = reportGenerator.generateReport(mockResults);

      // First test (score 0.95) should pass, second test (score 0.3) should fail
      expect(report.summary.passedTests).toBe(1);
      expect(report.summary.failedTests).toBe(1);

      // Verify individual test results
      expect(report.results[0].passed).toBe(true); // score 0.95 > 0.8
      expect(report.results[1].passed).toBe(false); // score 0.3 < 0.8
    });

    it('should support batch evaluation execution', () => {
      const batchResults: EvaluationResult[] = Array(10).fill(mockResults[0]);
      const report = reportGenerator.generateReport(batchResults);

      expect(report.summary.totalTests).toBe(10);
      expect(report.results).toHaveLength(10);
      expect(report.metadata.batchId).toBeDefined();
    });
  });

  describe('Output Formatting', () => {
    let report: EvaluationReport;

    beforeEach(() => {
      report = reportGenerator.generateReport(mockResults);
    });

    it('should format report as JSON with all required fields', () => {
      const formatted = reportGenerator.formatReport(report, 'json');
      const parsed = JSON.parse(formatted);

      expect(parsed).toMatchObject({
        summary: expect.any(Object),
        results: expect.any(Array),
        metadata: expect.any(Object),
      });

      // Verify JSON structure matches requirements
      expect(parsed.summary).toHaveProperty('threshold');
      expect(parsed.summary).toHaveProperty('averageScore');
      expect(parsed.results[0]).toHaveProperty('inputMessages');
      expect(parsed.results[0]).toHaveProperty('expectedOutput');
      expect(parsed.results[0]).toHaveProperty('observedOutput');
      expect(parsed.results[0]).toHaveProperty('metadata');
    });

    it('should format report as Markdown with clear section hierarchy', () => {
      const formatted = reportGenerator.formatReport(report, 'markdown');

      // Check markdown structure
      expect(formatted).toContain('# Evaluation Report');
      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('## Detailed Results');

      // Check threshold and scoring information
      expect(formatted).toContain(`Threshold: ${defaultThreshold}`);
      expect(formatted).toContain('Average Score:');

      // Check test case details
      expect(formatted).toContain('### Test Case: test-1');
      expect(formatted).toContain('✅ Passed');
      expect(formatted).toContain('### Test Case: test-2');
      expect(formatted).toContain('❌ Failed');

      // Check message content inclusion
      expect(formatted).toContain('#### Input Messages');
      expect(formatted).toContain('#### Expected Output');
      expect(formatted).toContain('#### Observed Output');
    });

    it('should highlight failed tests clearly in all formats', () => {
      const formats = ['json', 'markdown', 'text'] as const;

      for (const format of formats) {
        const formatted = reportGenerator.formatReport(report, format);
        expect(formatted).toContain('test-2'); // Failed test
        if (format === 'markdown') {
          expect(formatted).toContain('❌ Failed');
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty results array', () => {
      const report = reportGenerator.generateReport([]);
      expect(report.summary).toEqual({
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        passRate: 0,
        averageScore: 0,
        threshold: defaultThreshold,
      });
    });

    it('should handle missing or malformed test cases', () => {
      const incompleteResults: EvaluationResult[] = [
        {
          testCaseId: 'test-1',
          inputMessages: [],
          expectedOutput: { role: 'assistant', content: '' },
          observedOutput: { role: 'assistant', content: '' },
          score: 0,
          passed: false,
        },
      ];

      const report = reportGenerator.generateReport(incompleteResults);
      expect(report.results[0].testCaseId).toBe('test-1');
      expect(report.metadata.hasErrors).toBe(false); // No errors, just failed test
    });

    it('should handle very long messages without truncation', () => {
      const longMessage = 'a'.repeat(1000);
      const results: EvaluationResult[] = [
        {
          testCaseId: 'test-1',
          inputMessages: [{ role: 'user', content: longMessage }],
          expectedOutput: { role: 'assistant', content: longMessage },
          observedOutput: { role: 'assistant', content: longMessage },
          score: 1,
          passed: true,
        },
      ];

      const report = reportGenerator.generateReport(results);
      const formatted = reportGenerator.formatReport(report, 'markdown');
      expect(formatted).toContain(longMessage);
    });

    it('should log scoring errors when they occur', () => {
      const resultsWithError: EvaluationResult[] = [
        {
          ...mockResults[0],
          error: 'Scoring computation failed',
          score: 0,
          passed: false,
        },
      ];

      const report = reportGenerator.generateReport(resultsWithError);
      expect(report.metadata.hasErrors).toBe(true);
      expect(report.results[0].error).toBeDefined();
    });
  });
});
