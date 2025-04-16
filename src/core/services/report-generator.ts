import {
  EvaluationResult,
  EvaluationReport,
  Message,
  ScoringMethod,
  ScoringConfig,
} from '../types/evaluation.type';

/**
 * Service responsible for generating evaluation reports in various formats
 */
export class ReportGenerator {
  private readonly threshold: number;
  private readonly scoringMethod: ScoringMethod;

  /**
   * Creates a new ReportGenerator instance
   * @param options - Configuration options for the report generator
   * @param options.threshold - The minimum score required for a test to pass
   * @param options.scoringMethod - The method used for scoring (default: semantic-similarity)
   */
  constructor(options: { threshold: number; scoringMethod?: ScoringMethod }) {
    this.threshold = options.threshold;
    this.scoringMethod = options.scoringMethod ?? 'semantic-similarity';
  }

  /**
   * Generates a complete evaluation report from individual results
   * @param results - Array of evaluation results
   * @returns A promise that resolves to the complete evaluation report
   */
  async generateReport(results: EvaluationResult[]): Promise<EvaluationReport> {
    // Process results with threshold-based pass/fail determination
    const processedResults = results.map((result) => ({
      ...result,
      // If there's an error, the test should fail regardless of score
      passed: result.error ? false : result.score >= this.threshold,
      metadata: {
        timestamp: new Date().toISOString(),
        scoringMethod: this.scoringMethod,
        threshold: this.threshold,
      },
    }));

    const passedTests = processedResults.filter(
      (result) => result.passed,
    ).length;
    const totalTests = processedResults.length;
    const averageScore =
      totalTests > 0
        ? processedResults.reduce((sum, result) => sum + result.score, 0) /
          totalTests
        : 0;

    const hasErrors = processedResults.some(
      (result) => result.error !== undefined,
    );

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageScore,
        threshold: this.threshold,
      },
      results: processedResults,
      metadata: {
        timestamp: new Date().toISOString(),
        threshold: this.threshold,
        scoringMethod: this.scoringMethod,
        scoringConfig: {
          method: this.scoringMethod,
          threshold: this.threshold,
          caseSensitive: false,
        },
        batchId: `batch-${Date.now()}`,
        hasErrors,
      },
    };
  }

  /**
   * Formats the evaluation report in the specified format
   * @param report - The evaluation report to format
   * @param format - The desired output format
   * @returns The formatted report as a string
   */
  formatReport(
    report: EvaluationReport,
    format: 'json' | 'markdown' | 'text',
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'markdown':
        return this.formatMarkdown(report);
      case 'text':
        return this.formatText(report);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private formatMarkdown(report: EvaluationReport): string {
    const { summary, results, metadata } = report;

    let markdown = `# Evaluation Report\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- Total Tests: ${summary.totalTests}\n`;
    markdown += `- Passed Tests: ${summary.passedTests}\n`;
    markdown += `- Failed Tests: ${summary.failedTests}\n`;
    markdown += `- Pass Rate: ${summary.passRate.toFixed(2)}%\n`;
    markdown += `- Average Score: ${summary.averageScore.toFixed(2)}\n`;
    markdown += `- Threshold: ${summary.threshold}\n\n`;

    markdown += `## Detailed Results\n\n`;
    results.forEach((result) => {
      markdown += `### Test Case: ${result.testCaseId}\n\n`;
      markdown += `- Status: ${result.passed ? '✅ Passed' : '❌ Failed'}\n`;
      markdown += `- Score: ${result.score.toFixed(2)}\n\n`;

      if (result.inputMessages?.length) {
        markdown += `#### Input Messages\n`;
        result.inputMessages.forEach((msg) => {
          markdown += `- ${msg.role}: ${msg.content}\n`;
        });
        markdown += '\n';
      }

      if (result.expectedOutput) {
        markdown += `#### Expected Output\n${result.expectedOutput.content}\n\n`;
      }

      if (result.observedOutput) {
        markdown += `#### Observed Output\n${result.observedOutput.content}\n\n`;
      }

      if (result.error) {
        markdown += `#### Error\n\`\`\`\n${result.error}\n\`\`\`\n\n`;
      }
    });

    markdown += `## Metadata\n\n`;
    markdown += `- Timestamp: ${metadata.timestamp}\n`;
    markdown += `- Threshold: ${metadata.threshold}\n`;
    markdown += `- Scoring Method: ${metadata.scoringMethod}\n`;

    return markdown;
  }

  private formatText(report: EvaluationReport): string {
    const { summary, results, metadata } = report;

    let text = 'EVALUATION REPORT\n\n';
    text += 'SUMMARY\n';
    text += `Total Tests: ${summary.totalTests}\n`;
    text += `Passed Tests: ${summary.passedTests}\n`;
    text += `Failed Tests: ${summary.failedTests}\n`;
    text += `Pass Rate: ${summary.passRate.toFixed(2)}%\n`;
    text += `Average Score: ${summary.averageScore.toFixed(2)}\n`;
    text += `Threshold: ${summary.threshold}\n\n`;

    text += 'DETAILED RESULTS\n\n';
    results.forEach((result) => {
      text += `Test Case: ${result.testCaseId}\n`;
      text += `Status: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
      text += `Score: ${result.score.toFixed(2)}\n\n`;

      if (result.inputMessages?.length) {
        text += `Input Messages:\n`;
        result.inputMessages.forEach((msg) => {
          text += `${msg.role}: ${msg.content}\n`;
        });
        text += '\n';
      }

      if (result.expectedOutput) {
        text += `Expected Output:\n${result.expectedOutput.content}\n\n`;
      }

      if (result.observedOutput) {
        text += `Observed Output:\n${result.observedOutput.content}\n\n`;
      }

      if (result.error) {
        text += `Error:\n${result.error}\n\n`;
      }
    });

    text += 'METADATA\n';
    text += `Timestamp: ${metadata.timestamp}\n`;
    text += `Threshold: ${metadata.threshold}\n`;
    text += `Scoring Method: ${metadata.scoringMethod}\n`;

    return text;
  }
}
