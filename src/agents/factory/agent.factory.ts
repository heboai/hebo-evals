import { IAgent } from '../interfaces/agent.interface.js';
import { HeboAgent } from '../implementations/hebo-agent.js';
import { OpenAIAgent } from '../implementations/openai-agent.js';
import { AgentConfig } from '../types/agent.types.js';
import { Logger } from '../../utils/logger.js';
import { getProviderBaseUrl } from '../../utils/provider-config.js';

/**
 * Factory for creating agent instances based on provider
 */
export class AgentFactory {
  /**
   * Creates an agent instance based on the provider
   * @param config The agent configuration
   * @returns A new agent instance
   * @throws Error if the provider is not supported
   */
  public static createAgent(config: AgentConfig): IAgent {
    Logger.debug(`Creating agent with provider: ${config.provider}`);

    // Get the base URL for the provider
    const baseUrl = getProviderBaseUrl(config.provider);
    const agentConfig = { ...config, baseUrl };

    switch (config.provider.toLowerCase()) {
      case 'hebo':
        return new HeboAgent(agentConfig);
      case 'openai':
        return new OpenAIAgent(agentConfig);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
