import { BaseAgent } from '../interfaces/base-agent.js';
import { AgentConfig, AgentInput, AgentOutput } from '../types/agent.types.js';
import {
  Response,
  ResponseRequest,
  OpenAIMessage,
} from '../types/openai.types.js';
import { roleMapper } from '../../core/utils/role-mapper.js';
import { AgentAuthConfig } from '../types/agent.types.js';

/**
 * Configuration specific to Hebo agent
 */
export interface HeboAgentConfig extends AgentConfig {
  /**
   * The base URL for the Hebo API
   * @default 'https://api.hebo.ai'
   */
  baseUrl?: string;

  /**
   * Whether to store the conversation
   * @default true
   */
  store?: boolean;
}

/**
 * Implementation of the Hebo agent
 */
export class HeboAgent extends BaseAgent {
  private baseUrl: string;
  private store: boolean;
  private previousResponseId?: string;
  private messageHistory: OpenAIMessage[] = [];

  constructor(config: HeboAgentConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.hebo.ai';
    this.store = config.store ?? true;
    this.messageHistory = [];
  }

  /**
   * Validates the Hebo-specific configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error('Model is required for Hebo agent');
    }
    return super.validateConfig();
  }

  /**
   * Authenticates the agent with the provided API key
   * @param authConfig Authentication configuration containing the API key
   * @returns Promise that resolves when authentication is complete
   */
  public override async authenticate(
    authConfig: AgentAuthConfig,
  ): Promise<void> {
    // Set Hebo-specific header format
    const heboAuthConfig = {
      ...authConfig,
      headerName: 'X-API-Key',
      headerFormat: '{apiKey}',
    };
    await super.authenticate(heboAuthConfig);
  }

  /**
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    // Add new messages to history
    this.messageHistory.push(...input.messages);

    const request: ResponseRequest = {
      model: this.config.model,
      store: this.store,
      previous_response_id: this.previousResponseId,
      messages: this.messageHistory,
    };

    try {
      const response = await this.makeRequest(request);
      this.previousResponseId = response.id;

      // Add assistant's response to history
      if (response.choices.length > 0 && response.choices[0].message) {
        const message = response.choices[0].message;
        this.messageHistory.push({
          role: roleMapper.toRole(message.role),
          content: message.content || '',
          toolUsages: message.toolUsages || [],
          toolResponses: message.toolResponses || [],
        });
      }

      if (response.error) {
        return {
          response: '',
          error: {
            message: response.error.message,
            code: response.error.code,
            details: response.error,
          },
        };
      }

      return {
        response: response.choices[0].message.content || '',
        metadata: {
          id: response.id,
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      return {
        response: '',
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          details: error,
        },
      };
    }
  }

  /**
   * Makes a request to the Hebo API
   */
  private async makeRequest(request: ResponseRequest): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(),
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${this.baseUrl}/response`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<Response>;
  }

  /**
   * Cleans up the agent's resources and message history
   */
  public override async cleanup(): Promise<void> {
    await super.cleanup();
    this.messageHistory = [];
  }
}
