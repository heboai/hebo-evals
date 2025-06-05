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
import { MessageRole } from '../../core/types/message.types.js';

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

    // Filter out system messages and log warning if any are found
    const systemMessages = input.messages.filter(
      (msg) => msg.role === MessageRole.SYSTEM,
    );

    if (systemMessages.length > 0) {
      console.warn(
        `[HeboAgent] Warning: ${systemMessages.length} system message(s) found and will be ignored. System messages are not supported by Hebo agents.`,
      );
    }

    // Add only non-system messages to history
    for (const msg of input.messages) {
      if (msg.role !== MessageRole.SYSTEM) {
        this.messageHistory.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const request: ResponseRequest = {
      model: this.config.model,
      messages: this.messageHistory.map((msg) => ({
        role: roleMapper.toOpenAI(msg.role),
        content: msg.content,
      })),
    };

    // Add system messages to instructions field if present
    if (systemMessages.length > 0) {
      request.instructions = systemMessages
        .map((msg) => msg.content)
        .join('\n');
    }

    // Log message preparation only in verbose mode
    if ((Logger.isVerbose as () => boolean)()) {
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

      // Log the full response for debugging
      Logger.debug('Full API Response', { response });

      // Check if we have an error in the response
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

      // Extract the response content from the output array (for OpenAI API format)
      if (response.output && response.output.length > 0) {
        const output = response.output[0];
        if (output.type === 'message' && output.status === 'completed') {
          const content = output.content[0];
          if (content.type === 'output_text') {
            finalResponse = content.text;
          }
        }
      }
      // Extract the response content from the choices array (for Hebo API format)
      else if (response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        if (choice.message && choice.message.content) {
          finalResponse = choice.message.content;
        }
      }

      if (!finalResponse) {
        console.log('[HeboAgent] Warning: No valid response content found');
        return {
          response: '',
          error: {
            message: 'No valid response content found',
            details: response,
          },
        };
      }

      // Add assistant's response to history
      this.messageHistory.push({
        role: MessageRole.ASSISTANT,
        content: finalResponse,
        toolUsages: [],
        toolResponses: [],
      });

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
      const endpoint = `${this.baseUrl}/api/responses`;

      // Log the request details only in verbose mode
      if ((Logger.isVerbose as () => boolean)()) {
        console.log('\n=== Hebo API Request ===');
        console.log('Endpoint:', endpoint);
        console.log('Headers:', JSON.stringify(headers, null, 2));
        console.log('Request Payload:', JSON.stringify(request, null, 2));
        console.log('========================\n');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.agentKey,
        },
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
