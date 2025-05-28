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
 * Configuration specific to Hebo agent
 */
export interface HeboAgentConfig extends AgentConfig {
  /**
   * The base URL for the Hebo API
   * @default 'https://app.hebo.ai'
   */
  baseUrl?: string;

  /**
   * Whether to store the conversation
   * @default true
   */
  store?: boolean;

  /**
   * The provider to use for the agent
   * @default 'hebo'
   */
  provider: string;
}

/**
 * Implementation of the Hebo agent
 */
export class HeboAgent extends BaseAgent {
  private baseUrl: string;
  private store: boolean;
  private messageHistory: OpenAIMessage[] = [];
  private agentKey?: string;
  private provider: string;

  constructor(config: HeboAgentConfig) {
    super(config);
    // Remove trailing slash from baseUrl if present
    const rawBaseUrl = config.baseUrl || 'https://app.hebo.ai';
    this.baseUrl = rawBaseUrl.replace(/\/$/, '');
    this.store = config.store ?? true;
    this.messageHistory = [];
    this.provider = config.provider;
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
    if (!authConfig.agentKey || authConfig.agentKey.trim() === '') {
      throw new Error('API key is required and cannot be empty');
    }

    // Basic API key format validation
    if (!/^[a-zA-Z0-9_-]{32,}$/.test(authConfig.agentKey)) {
      throw new Error(
        'Invalid API key format. API keys should be at least 32 characters long and contain only letters, numbers, underscores, and hyphens.',
      );
    }

    // Set provider-specific header format
    const providerAuthConfig = {
      ...authConfig,
      headerName: this.provider === 'openai' ? 'Authorization' : 'X-API-Key',
      headerFormat:
        this.provider === 'openai' ? 'Bearer {agentKey}' : '{agentKey}',
    };
    this.agentKey = authConfig.agentKey;
    await super.authenticate(providerAuthConfig);
  }

  /**
   * Clears the message history
   */
  private clearMessageHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    // Clear previous message history before processing new input
    this.clearMessageHistory();

    // Add only the current test case messages to history
    for (const msg of input.messages) {
      this.messageHistory.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const request: ResponseRequest = {
      model: this.config.model,
      store: this.store,
      messages: this.messageHistory,
    };

    // Log message preparation only in verbose mode
    if (Logger.isVerbose()) {
      console.log('\n=== Message Preparation ===');
      console.log('Input Messages:', JSON.stringify(input.messages, null, 2));
      console.log(
        'Current Message History:',
        JSON.stringify(this.messageHistory, null, 2),
      );
      console.log('========================\n');
    }

    try {
      const response = await this.makeRequest(request);

      // Add assistant's response to history
      let finalResponse = '';
      if (response.choices.length > 0 && response.choices[0].message) {
        const message = response.choices[0].message;

        if (!message.content && !message.function_call) {
          console.log('[HeboAgent] Warning: Empty response received from API');
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
        console.log('[HeboAgent] Warning: No message in response choices');
        return {
          response: '',
          error: {
            message: 'No message in response choices',
            details: response,
          },
        };
      }

      if (response.error) {
        console.log('[HeboAgent] Error in response:', response.error);
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
      console.log('[HeboAgent] Error processing input:', error);
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
   * Makes a request to the API
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
    const timeoutId = setTimeout(() => controller.abort(), 100000); // 100 seconds timeout

    try {
      const endpoint =
        this.provider === 'openai'
          ? 'https://api.openai.com/v1/responses'
          : `${this.baseUrl}/api/responses`;

      // Log the request details only in verbose mode
      if (Logger.isVerbose()) {
        console.log('\n=== Hebo API Request ===');
        console.log('Endpoint:', endpoint);
        console.log('Headers:', JSON.stringify(headers, null, 2));
        console.log('Request Payload:', JSON.stringify(request, null, 2));
        console.log('========================\n');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Gateway timeout - server took too long to respond');
        }
        if (response.status === 403) {
          const errorBody = await response
            .text()
            .catch(() => 'No error details available');
          if (errorBody.includes('Invalid or inactive API key')) {
            console.log(errorBody);
            throw new Error(
              'Invalid or inactive API key. Please:\n' +
                '1. Check that your API key is correct\n' +
                '2. Verify that your API key is active in your account\n' +
                '3. Ensure you have the necessary permissions\n' +
                'You can find your API key in your account settings at https://app.hebo.ai/settings',
            );
          }
          throw new Error(
            `Authentication failed (403 Forbidden). Please check your API key and permissions. Details: ${errorBody}`,
          );
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json() as Promise<Response>;
    } catch (error) {
      // Clear timeout in case of error
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out after 100 seconds');
        }
        // If it's already a gateway timeout error, pass it through
        if (error.message.includes('Gateway timeout')) {
          throw error;
        }
        // Handle connection errors
        if (
          error.message.includes('fetch failed') ||
          error.message.includes('connect')
        ) {
          throw new Error(
            `Connection failed: ${error.message}. Please check your internet connection and try again.`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Cleans up the agent's resources and message history
   */
  public override async cleanup(): Promise<void> {
    this.messageHistory = [];
    // Add a small delay to ensure proper cleanup
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Creates a clone of the agent with the same configuration
   * @returns Promise that resolves with a new agent instance
   */
  public async clone(): Promise<IAgent> {
    const newAgent = new HeboAgent(this.config);
    await newAgent.initialize({
      model: this.config.model,
      provider: this.config.provider,
    });
    if (this.agentKey) {
      await newAgent.authenticate({ agentKey: this.agentKey });
    }
    // Don't copy message history to ensure test isolation
    return newAgent;
  }
}
