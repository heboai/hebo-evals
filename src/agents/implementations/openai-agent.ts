import { BaseAgent } from '../interfaces/base-agent.js';
import { AgentConfig, AgentInput, AgentOutput } from '../types/agent.types.js';
import {
  Response,
  ResponseRequest,
  OpenAIMessage,
} from '../types/openai.types.js';
import { roleMapper } from '../../core/utils/role-mapper.js';
import { AgentAuthConfig } from '../types/agent.types.js';
import { IAgent } from '../interfaces/agent.interface.js';
import { Logger } from '../../utils/logger.js';

/**
 * Configuration specific to OpenAI agent
 */
export interface OpenAIAgentConfig extends AgentConfig {
  /**
   * The base URL for the OpenAI API
   * @default 'https://api.openai.com/v1'
   */
  baseUrl?: string;

  /**
   * Whether to store the conversation
   * @default false
   */
  store?: boolean;

  /**
   * The provider to use for the agent
   * @default 'openai'
   */
  provider: string;
}

/**
 * Implementation of the OpenAI agent
 */
export class OpenAIAgent extends BaseAgent {
  private baseUrl: string;
  private store: boolean;
  private previousResponseId?: string;
  private messageHistory: OpenAIMessage[] = [];
  private agentKey?: string;
  private provider: string;

  constructor(config: OpenAIAgentConfig) {
    super(config);
    // Remove trailing slash from baseUrl if present and ensure it ends with /v1
    const rawBaseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.baseUrl = rawBaseUrl.replace(/\/$/, '');
    if (!this.baseUrl.endsWith('/v1')) {
      this.baseUrl = this.baseUrl.endsWith('/')
        ? `${this.baseUrl}v1`
        : `${this.baseUrl}/v1`;
    }
    this.store = config.store ?? false;
    this.messageHistory = [];
    this.provider = config.provider;
  }

  /**
   * Validates the OpenAI-specific configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error('Model is required for OpenAI agent');
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
    if (!authConfig.agentKey || authConfig.agentKey.trim() === '') {
      throw new Error('API key is required and cannot be empty');
    }

    // Accept both OpenAI and Hebo key formats
    if (
      !/^(sk-[a-zA-Z0-9]{32,}|sk-proj-[a-zA-Z0-9_-]{32,})$/.test(
        authConfig.agentKey,
      )
    ) {
      throw new Error(
        'Invalid API key format. API keys should either:\n' +
          '1. Start with "sk-" followed by at least 32 characters (OpenAI format)\n' +
          '2. Start with "sk-proj-" followed by at least 32 characters (Hebo format)',
      );
    }

    // Set OpenAI-specific header format
    const providerAuthConfig = {
      ...authConfig,
      headerName: 'Authorization',
      headerFormat: 'Bearer {agentKey}',
    };
    this.agentKey = authConfig.agentKey;
    await super.authenticate(providerAuthConfig);
  }

  /**
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    // Add all messages to history
    for (const msg of input.messages) {
      this.messageHistory.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const request: ResponseRequest = {
      model: this.config.model,
      messages: this.messageHistory,
    };

    // Only add store and previous_response_id for Hebo provider
    if (this.provider === 'hebo') {
      request.store = this.store;
      request.previous_response_id = this.previousResponseId;
    }

    try {
      const response = await this.makeRequest(request);
      this.previousResponseId = response.id;

      // Add assistant's response to history
      let finalResponse = '';
      if (response.choices.length > 0 && response.choices[0].message) {
        const message = response.choices[0].message;

        if (!message.content && !message.function_call) {
          console.log(
            '[OpenAIAgent] Warning: Empty response received from API',
          );
          return {
            response: '',
            error: {
              message: 'Empty response received from API',
              details: response,
            },
          };
        }

        // Convert function_call back to tool usage format
        const toolUsages = message.function_call
          ? [
              {
                name: message.function_call.name,
                args: message.function_call.arguments,
              },
            ]
          : [];

        // Add assistant's response to history
        this.messageHistory.push({
          role: roleMapper.toRole(message.role),
          content: message.content || '',
          toolUsages,
          toolResponses: [],
        });

        // Format the response
        finalResponse = message.content || '';
        if (message.function_call) {
          finalResponse += `\ntool use: ${message.function_call.name} args: ${message.function_call.arguments}`;
        }
      } else {
        console.log('[OpenAIAgent] Warning: No message in response choices');
        return {
          response: '',
          error: {
            message: 'No message in response choices',
            details: response,
          },
        };
      }

      if (response.error) {
        console.log('[OpenAIAgent] Error in response:', response.error);
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
        response: finalResponse,
        metadata: {
          id: response.id,
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      console.log('[OpenAIAgent] Error processing input:', error);
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
   * Makes a request to the OpenAI API
   */
  private async makeRequest(request: ResponseRequest): Promise<Response> {
    if (!this.agentKey) {
      throw new Error('Agent is not authenticated');
    }

    const headers = {
      ...this.getAuthHeaders(),
      'Content-Type': 'application/json',
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

    try {
      const endpoint = `${this.baseUrl}/chat/completions`;
      Logger.debug(`Making request to OpenAI API endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Invalid API endpoint (404): ${endpoint}. Please check your baseUrl configuration.`,
          );
        }
        if (response.status === 504) {
          throw new Error('Gateway timeout - server took too long to respond');
        }
        if (response.status === 401) {
          throw new Error(
            'Invalid API key. Please check your OpenAI API key and try again.',
          );
        }
        if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please try again later or contact OpenAI support.',
          );
        }

        const errorBody = await response
          .text()
          .catch(() => 'No error details available');
        throw new Error(`OpenAI API error: ${errorBody}`);
      }

      const data = await response.json();
      return data as Response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out after 5 minutes');
        }
        throw error;
      }
      throw new Error(
        'Unknown error occurred while making request to OpenAI API',
      );
    }
  }

  /**
   * Cleans up any resources used by the agent
   */
  public override async cleanup(): Promise<void> {
    this.messageHistory = [];
    this.previousResponseId = undefined;
    await super.cleanup();
  }

  /**
   * Creates a clone of the current agent
   */
  public async clone(): Promise<IAgent> {
    const config = {
      ...this.config,
      baseUrl: this.baseUrl,
      store: this.store,
      provider: this.provider,
    };
    const agent = new OpenAIAgent(config);
    if (this.agentKey) {
      await agent.authenticate({ agentKey: this.agentKey });
    }
    return agent;
  }
}
