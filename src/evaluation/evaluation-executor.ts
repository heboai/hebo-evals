import { AgentInput } from '../agents/types/agent.types.js';
import { IAgent } from '../agents/interfaces/agent.interface.js';
import { Logger } from '../utils/logger.js';
import { performance } from 'perf_hooks';
import { TestCase } from '../core/types/message.types.js';
import { TestCaseLoader } from '../parser/loader.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { ReportGenerator } from '../report/report-generator.js';
import {
  EvaluationConfig,
  EvaluationReport,
} from './types/evaluation.types.js';
import { TestCaseEvaluation } from './types/test-case.types.js';
import { formatTestCasePlain } from '../utils/formatter.js';

/**
 * Service for executing test cases against an agent
 */
export class EvaluationExecutor {
  private testCaseLoader: TestCaseLoader;
  private scoringService: ScoringService;
  private reportGenerator: ReportGenerator;
  private readonly threshold: number;
  private readonly maxConcurrency: number;

  constructor(scoringService: ScoringService, config: EvaluationConfig) {
    this.testCaseLoader = new TestCaseLoader();
    this.scoringService = scoringService;
    this.reportGenerator = new ReportGenerator(config);
    this.threshold = config.threshold ?? 0.8;
    this.maxConcurrency = config.maxConcurrency ?? 5;
  }

  /**
   * Loads and executes test cases from a directory and generates a report
   * @param agent The agent to test
   * @param directoryPath The path to the directory containing test case files
   * @param stopOnError Whether to stop processing files after the first error (default: true)
   * @returns Promise that resolves with the evaluation report
   */
  public async evaluateFromDirectory(
    agent: IAgent,
    directoryPath: string,
    stopOnError: boolean = true,
  ): Promise<EvaluationReport> {
    const startTime = performance.now();
    Logger.info(
      `Starting evaluation with provider: ${agent.getConfig().provider}`,
    );

    // First load the test cases
    const loadResult = await this.testCaseLoader.loadFromDirectory(
      directoryPath,
      stopOnError,
    );

    // Then execute them in parallel
    const results = await this.executeTestCasesInParallel(
      agent,
      loadResult.testCases,
      this.maxConcurrency,
    );

    const duration = (performance.now() - startTime) / 1000; // Convert to seconds

    const passedTests = results.filter((r) => r.success).length;
    const totalTests = results.length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? passedTests / totalTests : 0;

    // Log test summary using the new format
    Logger.testSummary(totalTests, passedTests, failedTests, duration);

    const report: EvaluationReport = {
      totalTests,
      passedTests,
      failedTests,
      passRate,
      results: results.map((result) => ({
        testCase: {
          id: result.testCaseId,
          input: formatTestCasePlain({
            id: result.testCaseId,
            name: result.testCaseId,
            messageBlocks: result.testCase.messageBlocks.slice(0, -1),
          }),
          expected: formatTestCasePlain({
            id: result.testCaseId,
            name: result.testCaseId,
            messageBlocks: [
              result.testCase.messageBlocks[
                result.testCase.messageBlocks.length - 1
              ],
            ],
          }),
        },
        score: result.score,
        passed: result.success,
        error: result.error,
        timestamp: new Date(),
        response: result.response || '',
      })),
      timestamp: new Date(),
      duration,
    };

    return report;
  }

  /**
   * Loads and executes test cases from a directory
   * @param agent The agent to test
   * @param directoryPath The path to the directory containing test case files
   * @param stopOnError Whether to stop processing files after the first error (default: true)
   * @returns Promise that resolves with the evaluation results
   */
  public async executeTestCasesFromDirectory(
    agent: IAgent,
    directoryPath: string,
    stopOnError: boolean = true,
  ): Promise<TestCaseEvaluation[]> {
    Logger.info(`Loading test cases from directory: ${directoryPath}`);
    const loadResult = await this.testCaseLoader.loadFromDirectory(
      directoryPath,
      stopOnError,
    );

    if (loadResult.errors.length > 0) {
      Logger.warn(
        `Encountered ${loadResult.errors.length} errors while loading test cases:`,
        {
          errors: loadResult.errors,
        },
      );
    }

    if (loadResult.testCases.length === 0) {
      Logger.warn('No test cases were loaded successfully');
      return [];
    }

    Logger.info(
      `Successfully loaded ${loadResult.testCases.length} test cases`,
    );
    return this.executeTestCases(agent, loadResult.testCases);
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
  ): Promise<TestCaseEvaluation> {
    const startTime = performance.now();
    const agentConfig = agent.getConfig();
    Logger.debug(
      `Executing test case ${testCase.id} with provider: ${agentConfig.provider}`,
    );

    try {
      if (testCase.messageBlocks.length < 2) {
        throw new Error(
          'Test case must have at least 2 message blocks: input and expected output',
        );
      }

      // Get input messages based on provider
      let inputMessages;
      // Send all messages except the last one (expected response) for both providers
      inputMessages = testCase.messageBlocks.slice(0, -1);
      Logger.debug(
        `Using message format: sending ${inputMessages.length} messages of conversation history`,
      );

      // Get the expected response from the last message block
      const expectedResponse =
        testCase.messageBlocks[testCase.messageBlocks.length - 1];

      const input: AgentInput = {
        messages: inputMessages,
      };

      // Execute the test
      Logger.debug(`Sending input to ${agentConfig.provider} agent`);
      const response = await agent.sendInput(input);
      const executionTime = performance.now() - startTime;

      // Only calculate similarity score if we have a valid response
      if (!response.response || response.response.trim().length === 0) {
        throw new Error('Agent returned an empty response');
      }

      // Calculate semantic similarity score
      Logger.debug('Calculating similarity score');
      const score = await this.scoringService.scoreStrings(
        response.response.trim(),
        expectedResponse.content.trim(),
      );

      // Consider it a success if score is above threshold (0.8 by default)
      const isMatch = score >= this.threshold;

      // Log test result using the new format
      Logger.testResult(
        testCase.id,
        isMatch,
        isMatch ? undefined : 'Response mismatch',
        score,
        executionTime,
        {
          input: formatTestCasePlain({
            id: testCase.id,
            name: testCase.id,
            messageBlocks: testCase.messageBlocks.slice(0, -1),
          }),
          expected: formatTestCasePlain({
            id: testCase.id,
            name: testCase.id,
            messageBlocks: [
              testCase.messageBlocks[testCase.messageBlocks.length - 1],
            ],
          }),
        },
        response.response,
      );

      return {
        testCaseId: testCase.id,
        success: isMatch,
        error: isMatch ? undefined : 'Response mismatch',
        score,
        executionTime,
        response: response.response,
        testCase,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      // Log test result using the new format
      Logger.testResult(
        testCase.id,
        false,
        error instanceof Error ? error.message : 'Unknown error',
        0,
        executionTime,
        {
          input: formatTestCasePlain({
            id: testCase.id,
            name: testCase.id,
            messageBlocks: testCase.messageBlocks.slice(0, -1),
          }),
          expected: formatTestCasePlain({
            id: testCase.id,
            name: testCase.id,
            messageBlocks: [
              testCase.messageBlocks[testCase.messageBlocks.length - 1],
            ],
          }),
        },
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        testCaseId: testCase.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        score: 0,
        executionTime,
        response: error instanceof Error ? error.message : 'Unknown error',
        testCase,
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
  ): Promise<TestCaseEvaluation[]> {
    const results: TestCaseEvaluation[] = [];
    const agentConfig = agent.getConfig();
    Logger.info(
      `Executing ${testCases.length} test cases with provider: ${agentConfig.provider}`,
    );

    try {
      for (const testCase of testCases) {
        try {
          results.push(await this.executeTestCase(agent, testCase));
        } catch (error) {
          Logger.error(`Error executing test case ${testCase.id}:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            provider: agentConfig.provider,
          });
          results.push({
            testCaseId: testCase.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            score: 0,
            executionTime: 0,
            response: '',
            testCase,
          });
        }
      }
    } catch (error) {
      Logger.error('Fatal error during test execution:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: agentConfig.provider,
      });
    }

    return results;
  }

  /**
   * Executes test cases in parallel with a maximum concurrency
   * @param agent The agent to test
   * @param testCases The test cases to execute
   * @param maxConcurrency The maximum number of concurrent executions
   * @returns Promise that resolves with the evaluation results
   */
  private async executeTestCasesInParallel(
    agent: IAgent,
    testCases: TestCase[],
    maxConcurrency: number,
  ): Promise<TestCaseEvaluation[]> {
    const results: TestCaseEvaluation[] = [];
    const agentConfig = agent.getConfig();
    let completedTests = 0;

    Logger.info(
      `Executing ${testCases.length} test cases in parallel with max concurrency ${maxConcurrency}`,
      {
        provider: agentConfig.provider,
      },
    );

    // Start loading indicator
    Logger.startLoading('Running test cases', testCases.length);

    // Process test cases in chunks to limit concurrency
    for (let i = 0; i < testCases.length; i += maxConcurrency) {
      const chunk = testCases.slice(i, i + maxConcurrency);
      const chunkPromises = chunk.map((testCase) =>
        this.executeTestCase(agent, testCase).then((result) => {
          // Update loading progress after each test case completes
          completedTests++;
          Logger.updateLoadingProgress(completedTests);
          return result;
        }),
      );

      try {
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      } catch (error) {
        Logger.error('Error executing test case chunk:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          provider: agentConfig.provider,
          chunkIndex: i,
        });
      }
    }

    // Stop loading indicator
    Logger.stopLoading();

    return results;
  }
}
