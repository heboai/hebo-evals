import {
  EvaluationResult,
  EvaluationReport,
  Message,
} from '../types/evaluation.type';

/**
 * Service responsible for generating evaluation reports in various formats
 */
export class ReportGenerator {
  /**
   * Generates a complete evaluation report from individual results
   * @param results - Array of evaluation results
   * @returns A promise that resolves to the complete evaluation report
   */
  async generateReport(results: EvaluationResult[]): Promise<EvaluationReport> {
    const passedTests = results.filter((result) => result.passed).length;
    const totalTests = results.length;

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      },
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        threshold: results[0]?.score ?? 0,
        scoringMethod: 'semantic-similarity',
        scoringConfig: {
          method: 'semantic-similarity',
          threshold: results[0]?.score ?? 0,
          caseSensitive: false,
        },
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
    markdown += `- Pass Rate: ${summary.passRate.toFixed(2)}%\n\n`;

    markdown += `## Detailed Results\n\n`;
    results.forEach((result) => {
      markdown += `### Test Case: ${result.testCaseId}\n\n`;
      markdown += `- Status: ${result.passed ? '✅ Passed' : '❌ Failed'}\n`;
      markdown += `- Score: ${result.score.toFixed(2)}\n\n`;

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
    text += `Pass Rate: ${summary.passRate.toFixed(2)}%\n\n`;

    text += 'DETAILED RESULTS\n\n';
    results.forEach((result) => {
      text += `Test Case: ${result.testCaseId}\n`;
      text += `Status: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
      text += `Score: ${result.score.toFixed(2)}\n\n`;

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
