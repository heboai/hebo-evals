import { IAgent } from '../interfaces/agent.interface.js';
import { HeboAgent } from '../implementations/hebo-agent.js';
import { OpenAIAgent } from '../implementations/openai-agent.js';
import { AgentConfig } from '../types/agent.types.js';
import { Logger } from '../../utils/logger.js';
import { getProviderBaseUrl } from '../../utils/provider-config.js';

/**
 * Creates an agent instance based on the provider
 * @param config The agent configuration
 * @returns A new agent instance
 * @throws Error if the provider is not supported or if the model-provider combination is invalid
 */
export function createAgent(config: AgentConfig): IAgent {
  Logger.debug(`Creating agent with provider: ${config.provider}`);

  const provider = config.provider.toLowerCase();
  const model = config.model.toLowerCase();

  // Validate model-provider combination
  if (model.startsWith('gpt-') && provider !== 'openai') {
    throw new Error(
      `Configuration error: Model ${config.model} requires OpenAI provider, but ${config.provider} was specified`,
    );
  }

  // Validate Hebo models
  if (provider === 'hebo' && !model.includes(':')) {
    throw new Error(
      `Configuration error: Hebo models must be in the format 'name:version' (e.g., 'gato:v1'). Received: ${config.model}`,
    );
  }

  // Validate OpenAI models
  if (provider === 'openai' && !model.startsWith('gpt-')) {
    throw new Error(
      `Configuration error: OpenAI models must start with 'gpt-' (e.g., 'gpt-4'). Received: ${config.model}`,
    );
  }

  // Get the base URL for the provider
  const baseUrl = getProviderBaseUrl(provider);
  const agentConfig = { ...config, baseUrl };

  switch (provider) {
    case 'hebo':
      return new HeboAgent(agentConfig);
    case 'openai':
      return new OpenAIAgent(agentConfig);
    default:
      throw new Error(
        `Configuration error: Unsupported provider: ${config.provider}. Supported providers are: openai, hebo`,
      );
  }
}
