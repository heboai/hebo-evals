import { IAgent } from '../agents/interfaces/agent.interface';
import { Logger } from '../utils/logger';

export interface TestIsolationConfig {
  resetAgentState: boolean;
  clearMemory: boolean;
  timeoutMs: number;
}

export class TestIsolationService {
  private logger: Logger;

  constructor(private agent: IAgent) {
    this.logger = Logger.getInstance();
  }

  /**
   * Prepares the environment for a test case
   */
  public async prepareTestEnvironment(
    config: TestIsolationConfig,
  ): Promise<void> {
    try {
      this.logger.info('Preparing test environment', { config });

      if (config.resetAgentState) {
        await this.resetAgentState();
      }

      if (config.clearMemory) {
        await this.clearAgentMemory();
      }

      this.logger.info('Test environment prepared successfully');
    } catch (error) {
      this.logger.error('Failed to prepare test environment', {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }

  /**
   * Cleans up after a test case
   */
  public async cleanupTestEnvironment(
    config: TestIsolationConfig,
  ): Promise<void> {
    try {
      this.logger.info('Cleaning up test environment', { config });

      if (config.resetAgentState) {
        await this.resetAgentState();
      }

      if (config.clearMemory) {
        await this.clearAgentMemory();
      }

      this.logger.info('Test environment cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to clean up test environment', {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }

  /**
   * Resets the agent's state
   */
  private async resetAgentState(): Promise<void> {
    try {
      this.logger.debug('Resetting agent state');
      await this.agent.reset();
      this.logger.debug('Agent state reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset agent state', {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }

  /**
   * Clears the agent's memory
   */
  private async clearAgentMemory(): Promise<void> {
    try {
      this.logger.debug('Clearing agent memory');
      await this.agent.clearMemory();
      this.logger.debug('Agent memory cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear agent memory', {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }
}
