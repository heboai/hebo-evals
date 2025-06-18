import { IAgent } from '../interfaces/agent.interface.js';
import { AgentConfig } from '../types/agent.types.js';
import { VercelAIAgent } from '../implementations/vercel-ai-agent.js';
import { Logger } from '../../utils/logger.js';

/**
 * Factory class for creating agent instances
 */
export class AgentFactory {
  /**
   * Creates a new agent instance based on the provided configuration
   * @param config The agent configuration
   * @returns A new agent instance
   */
  public static async createAgent(config: AgentConfig): Promise<IAgent> {
    try {
      // Currently, we only support the Vercel AI agent implementation
      const agent = new VercelAIAgent(config);
      await agent.validateConfig();
      return agent;
    } catch (error) {
      Logger.error(
        `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
