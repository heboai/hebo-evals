import { BaseAgent } from '../interfaces/base-agent';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentMessage,
} from '../types/agent.types';
import {
  Message,
  MessageRole,
  Response,
  ResponseRequest,
} from '../types/openai.types';

/**
 * Configuration specific to Hebo agent
 */
export interface HeboAgentConfig extends AgentConfig {
  /**
   * The model to use for the agent
   */
  model: string;

  /**
   * The base URL for the Hebo API
   * @default 'https://api.hebo.ai'
   */
  baseUrl?: string;

  /**
   * Whether to store the conversation
   * @default false
   */
  store?: boolean;

  /**
   * Optional system message to set the behavior of the agent
   */
  systemMessage?: string;
}

/**
 * Implementation of the Hebo agent
 */
export class HeboAgent extends BaseAgent {
  private model: string;
  private baseUrl: string;
  private store: boolean;
  private previousResponseId?: string;
  private systemMessage?: string;
  private messageHistory: AgentMessage[] = [];

  constructor(config: HeboAgentConfig) {
    super(config);
    this.model = config.model;
    this.baseUrl = config.baseUrl || 'https://api.hebo.ai';
    this.store = config.store || false;
    this.systemMessage = config.systemMessage;

    if (this.systemMessage) {
      this.messageHistory.push({
        role: 'system',
        content: this.systemMessage,
      });
    }
  }

  /**
   * Validates the Hebo-specific configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.model) {
      throw new Error('Model is required for Hebo agent');
    }
    return super.validateConfig();
  }

  /**
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    // Add new messages to history
    this.messageHistory.push(...input.messages);

    const request: ResponseRequest = {
      model: this.model,
      messages: this.convertToHeboMessages(this.messageHistory),
      store: this.store,
      previous_response_id: this.previousResponseId,
    };

    try {
      const response = await this.makeRequest(request);
      this.previousResponseId = response.id;

      // Add assistant's response to history
      if (response.choices[0]?.message) {
        this.messageHistory.push({
          role: 'assistant',
          content: response.choices[0].message.content || '',
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
   * Converts agent messages to Hebo API messages
   */
  private convertToHeboMessages(messages: AgentMessage[]): Message[] {
    return messages.map((message) => ({
      role: this.convertRole(message.role),
      content: message.content,
      name: message.name,
    }));
  }

  /**
   * Converts agent message role to Hebo message role
   */
  private convertRole(role: AgentMessage['role']): MessageRole {
    switch (role) {
      case 'user':
        return MessageRole.USER;
      case 'assistant':
        return MessageRole.ASSISTANT;
      case 'system':
        return MessageRole.SYSTEM;
      default:
        return MessageRole.USER;
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
    if (this.systemMessage) {
      this.messageHistory.push({
        role: 'system',
        content: this.systemMessage,
      });
    }
  }
}
