import { jest } from '@jest/globals';
import { ReportGenerator } from '../core/services/report-generator.js';
import { EvaluationResult, Message } from '../core/types/evaluation.type.js';

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  const mockResults: EvaluationResult[] = [
    {
      testCaseId: 'test-1',
      inputMessages: [
        { role: 'user', content: 'What is the weather?' }
      ],
      expectedOutput: { role: 'assistant', content: 'The weather is sunny' },
      observedOutput: { role: 'assistant', content: 'The weather is sunny' },
      score: 0.95,
      passed: true
    },
    {
      testCaseId: 'test-2',
      inputMessages: [
        { role: 'user', content: 'What is the weather?' }
      ],
      expectedOutput: { role: 'assistant', content: 'The weather is sunny' },
      observedOutput: { role: 'assistant', content: 'It is raining' },
      score: 0.3,
      passed: false
    }
  ];

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  describe('generateReport', () => {
    it('should generate a report with correct summary statistics', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      
      expect(report.summary.totalTests).toBe(2);
      expect(report.summary.passedTests).toBe(1);
      expect(report.summary.failedTests).toBe(1);
      expect(report.summary.passRate).toBe(0.5);
    });

    it('should handle empty results array', async () => {
      const report = await reportGenerator.generateReport([]);
      
      expect(report.summary.totalTests).toBe(0);
      expect(report.summary.passedTests).toBe(0);
      expect(report.summary.failedTests).toBe(0);
      expect(report.summary.passRate).toBe(0);
    });

    it('should include all test cases in the results', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      
      expect(report.results).toHaveLength(2);
      expect(report.results[0].testCaseId).toBe('test-1');
      expect(report.results[1].testCaseId).toBe('test-2');
    });
  });

  describe('formatReport', () => {
    it('should format report as JSON', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      const formatted = reportGenerator.formatReport(report, 'json');
      
      expect(() => JSON.parse(formatted)).not.toThrow();
      const parsed = JSON.parse(formatted);
      expect(parsed.summary.totalTests).toBe(2);
    });

    it('should format report as Markdown', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      const formatted = reportGenerator.formatReport(report, 'markdown');
      
      expect(formatted).toContain('# Evaluation Report');
      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('## Test Results');
      expect(formatted).toContain('### test-1');
      expect(formatted).toContain('### test-2');
    });

    it('should format report as plain text', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      const formatted = reportGenerator.formatReport(report, 'text');
      
      expect(formatted).toContain('Evaluation Report');
      expect(formatted).toContain('Summary:');
      expect(formatted).toContain('Test Results:');
      expect(formatted).toContain('test-1');
      expect(formatted).toContain('test-2');
    });

    it('should handle invalid format type', async () => {
      const report = await reportGenerator.generateReport(mockResults);
      
      expect(() => reportGenerator.formatReport(report, 'invalid' as any))
        .toThrow('Invalid format type: invalid');
    });
  });

  describe('edge cases', () => {
    it('should handle results with missing fields', async () => {
      const incompleteResults: EvaluationResult[] = [
        {
          testCaseId: 'test-1',
          inputMessages: [],
          expectedOutput: { role: 'assistant', content: '' },
          observedOutput: { role: 'assistant', content: '' },
          score: 0,
          passed: false
        }
      ];
      
      const report = await reportGenerator.generateReport(incompleteResults);
      expect(report.results[0].testCaseId).toBe('test-1');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(1000);
      const results: EvaluationResult[] = [
        {
          testCaseId: 'test-1',
          inputMessages: [{ role: 'user', content: longMessage }],
          expectedOutput: { role: 'assistant', content: longMessage },
          observedOutput: { role: 'assistant', content: longMessage },
          score: 1,
          passed: true
        }
      ];
      
      const report = await reportGenerator.generateReport(results);
      const formatted = reportGenerator.formatReport(report, 'markdown');
      expect(formatted).toContain(longMessage);
    });
  });
});
