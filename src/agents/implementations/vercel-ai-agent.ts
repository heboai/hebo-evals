import { BaseAgent } from '../interfaces/base-agent.js';
import { AgentConfig, AgentInput, AgentOutput } from '../types/agent.types.js';
import { AgentAuthConfig } from '../types/agent.types.js';
import { IAgent } from '../interfaces/agent.interface.js';
import { Logger } from '../../utils/logger.js';
import { MessageRole } from '../../core/types/message.types.js';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Vercel AI agent implementation that uses the Vercel AI SDK
 */
export class VercelAIAgent extends BaseAgent {
  private baseUrl: string;
  private agentKey?: string;

  constructor(config: AgentConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  /**
   * Validates the configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error('Model is required for Vercel AI agent');
    }
    return super.validateConfig();
  }

  /**
   * Authenticates the agent with the provided API key
   */
  public override async authenticate(
    authConfig: AgentAuthConfig,
  ): Promise<void> {
    if (!authConfig.agentKey || authConfig.agentKey.trim() === '') {
      throw new Error('API key is required and cannot be empty');
    }

    this.agentKey = authConfig.agentKey;
    await super.authenticate(authConfig);
  }

  /**
   * Creates an OpenAI provider instance with appropriate settings
   */
  private createOpenAIProvider(isHebo: boolean = false) {
    return createOpenAI({
      apiKey: this.agentKey,
      baseURL: this.baseUrl,
      // For Hebo, we use compatible mode since it's a proxy
      compatibility: isHebo ? 'compatible' : 'strict',
      // For Hebo, we set a custom provider name
      name: isHebo ? 'hebo' : 'openai',
      // Add any custom headers if needed
      headers:
        isHebo && this.agentKey
          ? ({
              'X-API-Key': this.agentKey,
            } as Record<string, string>)
          : undefined,
    });
  }

  /**
   * Processes input using the Vercel AI SDK
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    try {
      // Convert messages to a single prompt
      const prompt = input.messages
        .map((msg) => {
          const role = msg.role === MessageRole.USER ? 'User' : 'Assistant';
          return `${role}: ${msg.content}`;
        })
        .join('\n');

      // Determine provider based on model name
      const model = this.config.model.toLowerCase();
      let aiModel;

      if (model.startsWith('gpt-')) {
        // Use strict mode for OpenAI
        aiModel = this.createOpenAIProvider(false)(this.config.model);
      } else if (model.includes(':')) {
        // Hebo models contain a colon (e.g., 'gato:v1')
        aiModel = this.createOpenAIProvider(true)(this.config.model);
      } else {
        throw new Error(`Unsupported model: ${this.config.model}`);
      }

      // Generate text using the Vercel AI SDK
      const { text } = await generateText({
        model: aiModel,
        prompt,
      });

      return {
        response: text,
        metadata: {
          model: this.config.model,
          provider: model.includes(':') ? 'hebo' : 'openai',
        },
      };
    } catch (error) {
      Logger.error(
        `Error processing input: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cleans up any resources used by the agent
   */
  public override async cleanup(): Promise<void> {
    await super.cleanup();
  }

  /**
   * Creates a clone of the current agent
   */
  public async clone(): Promise<IAgent> {
    const config = {
      ...this.config,
      baseUrl: this.baseUrl,
    };
    const agent = new VercelAIAgent(config);
    if (this.agentKey) {
      await agent.authenticate({ agentKey: this.agentKey });
    }
    return agent;
  }
}
