import { IAgent } from '../agents/interfaces/agent.interface';
import { AgentInput, AgentOutput } from '../agents/types/agent.types';
import { BaseMessage } from '../core/types/message.types';
import { TestCaseLoader } from './test-case-loader';
import { TestIsolationService, TestIsolationConfig } from './test-isolation-service';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface TestCase {
  messages: BaseMessage[];
  expectedOutput: BaseMessage;
}

export interface EvaluationResult {
  testCase: TestCase;
  agentOutput: AgentOutput;
  success: boolean;
  error?: string;
  executionTime?: number;
  score?: number;
}

export class EvaluationExecutor {
  private testCaseLoader: TestCaseLoader;
  private testIsolationService: TestIsolationService;
  private logger: Logger;
  private defaultIsolationConfig: TestIsolationConfig = {
    resetAgentState: true,
    clearMemory: true,
    timeoutMs: 30000,
  };

  constructor(
    private agent: IAgent,
    isolationConfig?: Partial<TestIsolationConfig>,
  ) {
    this.testCaseLoader = new TestCaseLoader();
    this.testIsolationService = new TestIsolationService(agent);
    this.logger = Logger.getInstance();
    this.defaultIsolationConfig = {
      ...this.defaultIsolationConfig,
      ...isolationConfig,
    };
  }

  /**
   * Executes a single test case and returns the evaluation result
   */
  public async executeTestCase(testCase: TestCase): Promise<EvaluationResult> {
    const startTime = Date.now();
    try {
      this.logger.info('Executing test case', { 
        messageCount: testCase.messages.length - 1,
        expectedOutput: testCase.expectedOutput.content 
      });

      // Prepare test environment
      await this.testIsolationService.prepareTestEnvironment(this.defaultIsolationConfig);

      // Extract all messages except the last one (expected output)
      const inputMessages = testCase.messages.slice(0, -1);

      // Prepare input for the agent
      const input: AgentInput = {
        messages: inputMessages,
      };

      // Send input to agent and get response
      const agentOutput = await this.agent.sendInput(input);

      // Placeholder scoring - will be replaced with proper scoring service in a future PR
      const success = !agentOutput.error && agentOutput.response !== '';
      const score = success ? 1.0 : 0.0;

      const executionTime = Date.now() - startTime;
      this.logger.info('Test case completed', { 
        success, 
        score,
        executionTime,
        error: agentOutput.error?.message 
      });

      // Clean up test environment
      await this.testIsolationService.cleanupTestEnvironment(this.defaultIsolationConfig);

      return {
        testCase,
        agentOutput,
        success,
        error: agentOutput.error?.message,
        executionTime,
        score,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Test case failed', { 
        error: errorMessage,
        executionTime 
      });

      // Ensure cleanup even on error
      try {
        await this.testIsolationService.cleanupTestEnvironment(this.defaultIsolationConfig);
      } catch (cleanupError) {
        this.logger.error('Failed to clean up after test case failure', {
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error occurred'
        });
      }

      return {
        testCase,
        agentOutput: {
          response: '',
          error: {
            message: errorMessage,
            details: error,
          },
        },
        success: false,
        error: errorMessage,
        executionTime,
        score: 0.0,
      };
    }
  }

  /**
   * Executes multiple test cases in parallel and returns their evaluation results
   */
  public async executeTestCases(
    testCases?: TestCase[],
    examplesDir?: string,
    maxConcurrency: number = 5,
  ): Promise<EvaluationResult[]> {
    // If no test cases provided, load from examples directory
    if (!testCases) {
      const defaultExamplesDir = examplesDir || join(process.cwd(), 'examples');
      testCases = await this.testCaseLoader.loadFromExamplesDir(defaultExamplesDir);

      if (testCases.length === 0) {
        throw new Error(
          'No test cases provided and no default test cases found in examples directory',
        );
      }
    }

    this.logger.info('Starting batch execution', { 
      testCaseCount: testCases.length,
      maxConcurrency 
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
            return await this.executeTestCase(testCase);
          } catch (error) {
            return {
              testCase,
              agentOutput: {
                response: '',
                error: {
                  message: error instanceof Error ? error.message : 'Unknown error occurred',
                  details: error,
                },
              },
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              score: 0.0,
            };
          }
        }),
      );

      results.push(...chunkResults);
    }

    this.logger.info('Batch execution completed', { 
      totalTestCases: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length 
    });

    return results;
  }

  /**
   * Cleans up resources after evaluation
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up evaluation resources');
    await this.agent.cleanup();
  }
}
