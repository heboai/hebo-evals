import { ExecutionConfig, ExecutionResult } from './execution.types';
import { IExecutionService } from './execution.interface';
import fs from "fs";
import path from "path";
import { ReportGenerator } from '../report/report-generator';

class ExecutionService implements IExecutionService {
  async execute(config: ExecutionConfig, directory: string = path.join(__dirname, '../../examples')): Promise<ExecutionResult> {
    console.log('Executing with config:', config);
    const files = fs.readdirSync(directory);
    let output = '';

    const reportGenerator = new ReportGenerator({
      threshold: config.threshold || 0.8,
      useSemanticScoring: config.useSemanticScoring || false,
      outputFormat: (config.outputFormat as 'json' | 'markdown' | 'text') || 'json'
    });

    for (const file of files) {
        const filePath = path.join(directory, file);
          try {
              const data = fs.readFileSync(filePath, 'utf-8');
              // Invoke reporting service with data
              try {
                  const scores = this.generateScores(data);
                  const reportResult = reportGenerator.generateReport({
                    totalTests: scores.length,
                    passedTests: scores.filter(score => score > 0).length,
                    failedTests: scores.filter(score => score <= 0).length,
                    passRate: scores.filter(score => score > 0).length / scores.length,
                    results: scores.map((score, index) => ({
                      testCase: {
                        expected: '',
                        id: `test-${index}`,
                        input: ''
                      },
                      observed: '',
                      score: score,
                      passed: score > 0,
                      timestamp: new Date()
                    })),
                    timestamp: new Date(),
                    duration: 0
                  });
                  console.log(`Report generated for ${file}:`, reportResult);
              } catch (reportError) {
                  console.error(`Error processing report for ${file}:`, reportError);
              }
              // Pass data to reporting service
              console.log(`Processing file: ${file}`);
            output += `Processed ${file}: ${data}
`;
        } catch (error) {
            console.error(`Error reading file ${file}:`, error);
        }
    }

    return { success: true, output };
  }

  async validateConfig(): Promise<boolean> {
    console.log('Validating configuration');
    // Implement validation logic here
    return true;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up resources');
    // Implement cleanup logic here
  }

  generateScores(data: string): number[] {
      // Implement the logic to compute scores from the data
      // This is a placeholder implementation
      return data.split('\n').map(line => line.length);
  }
}

export const executionService = new ExecutionService();