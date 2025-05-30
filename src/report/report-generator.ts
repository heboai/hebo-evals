import {
  EvaluationConfig,
  EvaluationReport,
} from '../evaluation/types/evaluation.types.js';
import { COLORS } from '../utils/logger.js';

/**
 * Generates reports in various formats from evaluation results
 */
export class ReportGenerator {
  private config: EvaluationConfig;

  constructor(config: EvaluationConfig) {
    this.config = config;
  }

  /**
   * Generates a report from evaluation results
   */
  generateReport(results: EvaluationReport): string {
    switch (this.config.outputFormat) {
      case 'json':
        return this.generateJsonReport(results);
      case 'markdown':
        return this.generateMarkdownReport(results);
      case 'text':
        return this.generateTextReport(results);
      default: {
        const format = this.config.outputFormat as string;
        throw new Error(`Unsupported output format: ${format}`);
      }
    }
  }

  /**
   * Generates a JSON report
   */
  private generateJsonReport(results: EvaluationReport): string {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Generates a markdown report
   */
  private generateMarkdownReport(results: EvaluationReport): string {
    const lines: string[] = [
      'Test Summary',
      '============',
      `Total: ${results.totalTests}`,
      `${COLORS.test.pass}Passed: ${results.passedTests}${COLORS.reset}`,
      `${COLORS.test.fail}Failed: ${results.failedTests}${COLORS.reset}`,
      `Duration: ${results.duration.toFixed(2)}s`,
    ];

    return lines.join('\n');
  }

  /**
   * Generates a plain text report
   */
  private generateTextReport(results: EvaluationReport): string {
    const lines: string[] = [
      'Test Summary',
      '============',
      `Total: ${results.totalTests}`,
      `${COLORS.test.pass}Passed: ${results.passedTests}${COLORS.reset}`,
      `${COLORS.test.fail}Failed: ${results.failedTests}${COLORS.reset}`,
      `Duration: ${results.duration.toFixed(2)}s`,
    ];

    return lines.join('\n');
  }
}
