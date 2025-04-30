import { IAgent } from '../agents/interfaces/agent.interface';
import { AgentInput, AgentOutput } from '../agents/types/agent.types';
import { BaseMessage } from '../core/types/message.types';

export interface TestCase {
  messages: BaseMessage[];
  expectedOutput: BaseMessage;
}

export interface EvaluationResult {
  testCase: TestCase;
  agentOutput: AgentOutput;
  success: boolean;
  error?: string;
}

export class EvaluationExecutor {
  constructor(private agent: IAgent) {}

  /**
   * Executes a single test case and returns the evaluation result
   */
  public async executeTestCase(testCase: TestCase): Promise<EvaluationResult> {
    try {
      // Extract all messages except the last one (expected output)
      const inputMessages = testCase.messages.slice(0, -1);

      // Prepare input for the agent
      const input: AgentInput = {
        messages: inputMessages,
      };

      // Send input to agent and get response
      const agentOutput = await this.agent.sendInput(input);

      // Determine success based on agent's response
      const success = !agentOutput.error && agentOutput.response !== '';

      return {
        testCase,
        agentOutput,
        success,
        error: agentOutput.error?.message,
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
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Executes multiple test cases and returns their evaluation results
   */
  public async executeTestCases(
    testCases: TestCase[],
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      try {
        // Execute each test case
        const result = await this.executeTestCase(testCase);
        results.push(result);
      } catch (error) {
        // If a test case fails, log the error and continue with the next one
        results.push({
          testCase,
          agentOutput: {
            response: '',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error occurred',
              details: error,
            },
          },
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred',
        });
      }
    }

    return results;
  }

  /**
   * Cleans up resources after evaluation
   */
  public async cleanup(): Promise<void> {
    await this.agent.cleanup();
  }
}