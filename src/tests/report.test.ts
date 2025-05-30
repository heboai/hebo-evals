import { ReportGenerator } from '../report/report-generator';
import {
  EvaluationConfig,
  EvaluationReport,
} from '../evaluation/types/evaluation.types';

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  const defaultConfig: EvaluationConfig = {
    threshold: 0.8,
    outputFormat: 'markdown',
    maxConcurrency: 5,
  };

  const sampleReport: EvaluationReport = {
    totalTests: 2,
    passedTests: 1,
    failedTests: 1,
    passRate: 0.5,
    results: [
      {
        testCase: {
          id: 'test-1',
          input: '2 + 2',
          expected: '4',
        },
        response: '4',
        score: 1,
        passed: true,
        timestamp: new Date(),
      },
      {
        testCase: {
          id: 'test-2',
          input: '2 + 3',
          expected: '5',
        },
        response: '6',
        score: 0,
        passed: false,
        timestamp: new Date(),
      },
    ],
    timestamp: new Date(),
    duration: 1.5,
  };

  beforeEach(() => {
    reportGenerator = new ReportGenerator(defaultConfig);
  });

  describe('generateReport', () => {
    it('should generate markdown report by default', () => {
      const report: string = reportGenerator.generateReport(sampleReport);
      expect(report).toContain('Test Summary');
      expect(report).toContain('============');
      expect(report).toContain('Total: 2');
      expect(report).toContain('Passed: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Duration: 1.50s');
    });

    it('should generate JSON report when configured', () => {
      const jsonConfig: EvaluationConfig = {
        ...defaultConfig,
        outputFormat: 'json',
      };
      const jsonGenerator = new ReportGenerator(jsonConfig);
      const report = jsonGenerator.generateReport(sampleReport);

      expect(() => {
        JSON.parse(report);
      }).not.toThrow();
      const parsed = JSON.parse(report) as unknown as Partial<EvaluationReport>;
      expect(parsed).toMatchObject({
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
      } satisfies Partial<EvaluationReport>);
    });

    it('should generate text report when configured', () => {
      const textConfig: EvaluationConfig = {
        ...defaultConfig,
        outputFormat: 'text',
      };
      const textGenerator = new ReportGenerator(textConfig);
      const report = textGenerator.generateReport(sampleReport);

      expect(report).toContain('Test Summary');
      expect(report).toContain('============');
      expect(report).toContain('Total: 2');
      expect(report).toContain('Passed: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Duration: 1.50s');
    });

    it('should throw error for unsupported format', () => {
      const invalidConfig: EvaluationConfig = {
        ...defaultConfig,
        outputFormat: 'invalid' as 'json' | 'markdown' | 'text',
      };
      const invalidGenerator = new ReportGenerator(invalidConfig);

      expect(() => invalidGenerator.generateReport(sampleReport)).toThrow(
        'Unsupported output format',
      );
    });
  });

  describe('report content', () => {
    it('should include summary statistics in the report', () => {
      const report: string = reportGenerator.generateReport(sampleReport);
      expect(report).toContain('Total: 2');
      expect(report).toContain('Passed: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Duration: 1.50s');
    });

    it('should handle reports with errors', () => {
      const errorReport: EvaluationReport = {
        ...sampleReport,
        results: [
          ...sampleReport.results,
          {
            testCase: {
              id: 'test-3',
              input: 'invalid',
              expected: 'error',
            },
            response: '',
            score: 0,
            passed: false,
            error: 'Invalid input',
            timestamp: new Date(),
          },
        ],
        totalTests: 3,
        failedTests: 2,
      };

      const report = reportGenerator.generateReport(errorReport);
      expect(report).toContain('Total: 3');
      expect(report).toContain('Failed: 2');
    });
  });
});
