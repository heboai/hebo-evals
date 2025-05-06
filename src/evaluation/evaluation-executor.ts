import { AgentInput } from '../agents/types/agent.types';
import { IAgent } from '../agents/interfaces/agent.interface';
import { Logger } from '../utils/logger';
import { Parser } from '../parser/parser';
import { performance } from 'perf_hooks';
import { TestCase } from '../core/types/message.types';

export interface EvaluationResult {
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
      const executionTime = Date.now() - startTime;

      // Validate response
      const isMatch =
        response.response.trim() === expectedResponse.content.trim();

      return {
        success: isMatch,
        error: isMatch ? undefined : 'Response mismatch',
        score: isMatch ? 1 : 0,
        executionTime,
        response: response.response,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
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
    for (const testCase of testCases) {
      results.push(await this.executeTestCase(agent, testCase));
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
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((testCase) => this.executeTestCase(agent, testCase)),
      );
      results.push(...chunkResults);
    }
    return results;
  }
}
