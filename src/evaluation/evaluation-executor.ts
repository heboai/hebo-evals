import { AgentInput } from '../agents/types/agent.types';
import { IAgent } from '../agents/interfaces/agent.interface';
import { Logger } from '../utils/logger';
import { Parser } from '../parser/parser';
import { performance } from 'perf_hooks';
import { TestCase } from '../core/types/message.types';

export interface EvaluationResult {
  testCaseId: string;
  success: boolean;
  error?: string;
  score: number;
  executionTime: number;
  response?: string;
}

/**
 * Service for executing test cases against an agent
 */
export class EvaluationExecutor {
  private parser: Parser;
  private logger: Logger;

  constructor() {
    this.parser = new Parser();
    this.logger = Logger.getInstance();
  }

  /**
   * Executes a single test case against an agent
   * @param agent The agent to test
   * @param testCase The test case to execute
   * @returns Promise that resolves with the evaluation result
   */
  public async executeTestCase(
    agent: IAgent,
    testCase: TestCase,
  ): Promise<EvaluationResult> {
    const startTime = performance.now();
    try {
      const input: AgentInput = {
        messages: testCase.messageBlocks.slice(0, -1).map((block) => ({
          role: block.role,
          content: block.content,
        })),
      };

      // Get the expected response from the last message block
      const expectedResponse =
        testCase.messageBlocks[testCase.messageBlocks.length - 1];

      // Execute the test
      const response = await agent.sendInput(input);
      const executionTime = performance.now() - startTime;

      // Validate response
      const isMatch =
        response.response.trim() === expectedResponse.content.trim();

      return {
        testCaseId: testCase.id,
        success: isMatch,
        error: isMatch ? undefined : 'Response mismatch',
        score: isMatch ? 1 : 0,
        executionTime,
        response: response.response,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        testCaseId: testCase.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        score: 0,
        executionTime,
        response: '',
      };
    }
  }

  /**
   * Executes multiple test cases against an agent
   * @param agent The agent to test
   * @param testCases The test cases to execute
   * @returns Promise that resolves with the evaluation results
   */
  public async executeTestCases(
    agent: IAgent,
    testCases: TestCase[],
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    try {
      for (const testCase of testCases) {
        try {
          results.push(await this.executeTestCase(agent, testCase));
        } catch (error) {
          this.logger.error(
            `Error executing test case ${testCase.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          results.push({
            testCaseId: testCase.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            score: 0,
            executionTime: 0,
            response: '',
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Fatal error in executeTestCases: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error; // Re-throw fatal errors that affect the entire execution
    }
    return results;
  }

  /**
   * Executes test cases in parallel with a maximum concurrency
   * @param agent The agent to test
   * @param testCases The test cases to execute
   * @param maxConcurrency Maximum number of concurrent executions
   * @returns Promise that resolves with the evaluation results
   */
  private async executeTestCasesInParallel(
    agent: IAgent,
    testCases: TestCase[],
    maxConcurrency: number,
  ): Promise<EvaluationResult[]> {
    const chunks: TestCase[][] = [];
    for (let i = 0; i < testCases.length; i += maxConcurrency) {
      chunks.push(testCases.slice(i, i + maxConcurrency));
    }

    const results: EvaluationResult[] = [];
    this.logger.info(
      `Starting parallel execution of ${testCases.length} test cases with concurrency ${maxConcurrency}`,
    );
    for (const chunk of chunks) {
      this.logger.debug(
        `Executing chunk of ${chunk.length} test cases (${results.length}/${testCases.length} completed)`,
      );
      // Process each test case with error handling
      const chunkPromises = chunk.map(async (testCase) => {
        try {
          return await this.executeTestCase(agent, testCase);
        } catch (error) {
          this.logger.error(
            `Error executing test case ${testCase.id}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
          return {
            testCaseId: testCase.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            score: 0,
            executionTime: 0,
            response: '',
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }
    this.logger.info(
      `Completed parallel execution of ${testCases.length} test cases`,
    );
    return results;
  }
}
