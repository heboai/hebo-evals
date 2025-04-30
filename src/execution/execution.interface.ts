import { ExecutionConfig, ExecutionResult } from './execution.types';

/**
 * Interface for execution services
 *
 * This interface defines the contract that all execution service implementations must follow,
 * providing a consistent way to interact with different types of execution services.
 */
export interface IExecutionService {
  /**
   * Executes a task based on the provided configuration
   * @param config The execution configuration
   * @returns Promise that resolves with the execution result
   */
  execute(config: ExecutionConfig): Promise<ExecutionResult>;

  /**
   * Validates the execution configuration
   * @returns Promise that resolves with true if the configuration is valid
   * @throws Error if the configuration is invalid
   */
  validateConfig(): Promise<boolean>;

  /**
   * Cleans up any resources used by the execution service
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void>;
}

export { ExecutionConfig, ExecutionResult };
