import { TestCaseLoader } from './test-case-loader';
import {
  TestIsolationService,
  TestIsolationConfig,
} from './test-isolation-service';
import { join } from 'path';
import { Logger } from '../utils/logger';
import { IAgent } from '../agents/interfaces/agent.interface';
import { TestCase, TestCaseResult } from './types/evaluation.types';
import { AgentOutput } from '../agents/types/agent.types';

export interface EvaluationResult {
  testCase: TestCase;
  agentOutput: AgentOutput;
  success: boolean;
  error?: string;
  executionTime?: number;
  score?: number;
}

/**
 * Service for executing test cases against an agent
 */
export class EvaluationExecutor {
  private testCaseLoader: TestCaseLoader;
  private testIsolationService: TestIsolationService;
  private logger: Logger;
  private defaultIsolationConfig: TestIsolationConfig = {
    resetAgentState: true,
    clearMemory: true,
    timeoutMs: 30000,
  };

  constructor(agent: IAgent) {
    this.testCaseLoader = new TestCaseLoader();
    this.testIsolationService = new TestIsolationService(agent);
    this.logger = Logger.getInstance();
  }

  /**
   * Executes a single test case against the agent
   * @param agent The agent to test
   * @param testCase The test case to execute
   * @returns The test case result
   */
  async executeTestCase(
    agent: IAgent,
    testCase: TestCase,
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    let result: TestCaseResult;

    try {
      const agentResponse = await agent.sendInput({
        messages: testCase.messages,
      });
      const executionTime = Date.now() - startTime;

      result = {
        success:
          !agentResponse.error &&
          agentResponse.response === testCase.expectedOutput.content,
        error: agentResponse.error?.message,
        score: 0,
        executionTime,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      result = {
        success: false,
        error,
        score: 0,
        executionTime: Date.now() - startTime,
      };
    }

    this.logger.debug('Test case executed', { result });
    return result;
  }

  /**
   * Executes multiple test cases against the agent
   * @param agent The agent to test
   * @param testCases The test cases to execute
   * @returns The test case results
   */
  async executeTestCasesSequential(
    agent: IAgent,
    testCases: TestCase[],
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      const result = await this.executeTestCase(agent, testCase);
      results.push(result);
    }

    return results;
  }

  /**
   * Executes multiple test cases in parallel and returns their evaluation results
   */
  async executeTestCasesParallel(
    agent: IAgent,
    testCases: TestCase[] = [],
    examplesDir?: string,
    maxConcurrency: number = 5,
  ): Promise<EvaluationResult[]> {
    // If no test cases provided, load from examples directory
    if (testCases.length === 0 && examplesDir) {
      const defaultExamplesDir = examplesDir || join(process.cwd(), 'examples');
      const loadedTestCases =
        await this.testCaseLoader.loadFromExamplesDir(defaultExamplesDir);

      if (loadedTestCases.length === 0) {
        throw new Error(
          'No test cases provided and no default test cases found in examples directory',
        );
      }

      testCases = loadedTestCases;
    }

    this.logger.info('Starting batch execution', {
      testCaseCount: testCases.length,
      maxConcurrency,
    });

    const results: EvaluationResult[] = [];
    const chunks: TestCase[][] = [];

    // Split test cases into chunks for controlled parallel execution
    for (let i = 0; i < testCases.length; i += maxConcurrency) {
      chunks.push(testCases.slice(i, i + maxConcurrency));
    }

    // Execute chunks sequentially, but test cases within each chunk in parallel
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (testCase) => {
          try {
            await this.testIsolationService.prepareTestEnvironment(
              this.defaultIsolationConfig,
            );
            const result = await this.executeTestCase(agent, testCase);
            return {
              testCase,
              agentOutput: { response: '', error: undefined },
              ...result,
            };
          } catch (error) {
            return {
              testCase,
              agentOutput: {
                response: '',
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error occurred',
                  details: error,
                },
              },
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown error occurred',
              score: 0,
            };
          }
        }),
      );

      results.push(...chunkResults);
    }

    this.logger.info('Batch execution completed', {
      totalTestCases: results.length,
      successfulTests: results.filter((r) => r.success).length,
      failedTests: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Cleans up resources after evaluation
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up evaluation resources');
    await this.testIsolationService.cleanupTestEnvironment(
      this.defaultIsolationConfig,
    );
  }
}
