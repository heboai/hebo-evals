import { AgentConfig, AgentInput, AgentOutput } from '../types/agent.types';

/**
 * Simplified agent interface for direct agent interactions
 *
 * This interface provides a streamlined way to interact with agents,
 * eliminating unnecessary lifecycle complexity.
 */
export interface IAgent {
  /**
   * Gets the configuration of the agent
   * @returns The agent's configuration
   */
  getConfig: () => AgentConfig;

  /**
   * Sends input to the agent and receives its response
   * @param input The input to send to the agent
   * @returns Promise that resolves with the agent's output
   */
  sendInput: (input: AgentInput) => Promise<AgentOutput>;

  /**
   * Cleans up any resources used by the agent
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup: () => Promise<void>;
}
