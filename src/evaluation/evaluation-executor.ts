import { IAgent } from '../agents/interfaces/agent.interface';
import { AgentInput } from '../agents/types/agent.types';
import { ParsedTestCase, Parser } from '../parser/parser';
import { Logger } from '../utils/logger';

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
   * Executes a single test case against the agent
   * @param agent The agent to test
   * @param testCase The test case to execute
   * @returns The test case result
   */
  public async executeTestCase(
    agent: IAgent,
    testCase: ParsedTestCase,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
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
   * Executes multiple test cases against the agent
   * @param agent The agent to test
   * @param testCases The test cases to execute
   * @returns The test case results
   */
  public async executeTestCasesSequential(
    agent: IAgent,
    testCases: ParsedTestCase[],
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    for (const testCase of testCases) {
      results.push(await this.executeTestCase(agent, testCase));
    }
    return results;
  }

  /**
   * Executes multiple test cases in parallel and returns their evaluation results
   */
  public async executeTestCasesParallel(
    agent: IAgent,
    testCases: ParsedTestCase[],
    maxConcurrency = 5,
  ): Promise<EvaluationResult[]> {
    const chunks: ParsedTestCase[][] = [];
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
