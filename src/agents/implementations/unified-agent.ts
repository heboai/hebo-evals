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
 * Configuration for the unified agent
 */
export interface UnifiedAgentConfig extends AgentConfig {
  /**
   * The base URL for the API
   * @default 'https://api.openai.com/v1' for OpenAI, 'https://app.hebo.ai' for Hebo
   */
  baseUrl?: string;

  /**
   * Whether to store the conversation
   * @default false for OpenAI, true for Hebo
   */
  store?: boolean;

  /**
   * The provider to use for the agent
   */
  provider: 'openai' | 'hebo' | 'custom';
}

/**
 * Unified agent implementation that handles both OpenAI and Hebo providers
 */
export class UnifiedAgent extends BaseAgent {
  private baseUrl: string;
  private store: boolean;
  private messageHistory: OpenAIMessage[] = [];
  private agentKey?: string;
  private provider: 'openai' | 'hebo' | 'custom';

  constructor(config: UnifiedAgentConfig) {
    super(config);
    this.provider = config.provider;

    // Set provider-specific defaults
    const defaultBaseUrl =
      this.provider === 'openai'
        ? 'https://api.openai.com/v1'
        : 'https://app.hebo.ai';

    const defaultStore = this.provider === 'openai' ? false : true;

    // Initialize baseUrl
    const rawBaseUrl = config.baseUrl || defaultBaseUrl;
    this.baseUrl =
      this.provider === 'openai'
        ? this.ensureV1Endpoint(rawBaseUrl)
        : rawBaseUrl.replace(/\/$/, '');

    this.store = config.store ?? defaultStore;
    this.messageHistory = [];
  }

  /**
   * Ensures the OpenAI baseUrl ends with /v1
   */
  private ensureV1Endpoint(url: string): string {
    const cleanUrl = url.replace(/\/$/, '');
    return cleanUrl.endsWith('/v1') ? cleanUrl : `${cleanUrl}/v1`;
  }

  /**
   * Validates the configuration
   */
  public override validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error(`Model is required for ${this.provider} agent`);
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

    // Validate API key format based on provider
    if (this.provider === 'openai') {
      if (
        !/^(sk-[a-zA-Z0-9]{32,}|sk-proj-[a-zA-Z0-9_-]{32,})$/.test(
          authConfig.agentKey,
        )
      ) {
        throw new Error(
          'Invalid OpenAI API key format. API keys should start with "sk-" or "sk-proj-" followed by at least 32 characters.',
        );
      }
    } else {
      if (!/^[a-zA-Z0-9_-]{32,}$/.test(authConfig.agentKey)) {
        throw new Error(
          'Invalid Hebo API key format. API keys should be at least 32 characters long and contain only letters, numbers, underscores, and hyphens.',
        );
      }
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
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
    // Clear message history at the start of each test case
    this.messageHistory = [];

    // Separate system messages and process them
    const { nonSystemMessages, instructions } = this.separateSystemMessages(
      input.messages,
    );

    // Add non-system messages to history
    for (const msg of nonSystemMessages) {
      this.messageHistory.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Prepare request based on provider
    const providerRequest = this.prepareProviderSpecificRequest();
    const request: ResponseRequest = {
      model: providerRequest.model || this.config.model,
      ...providerRequest,
    };

    // Add system messages to instructions field if present
    if (instructions) {
      request.instructions = instructions;
      Logger.debug('System instructions added to request', { instructions });
    }

    try {
      const response = await this.makeRequest(request);

      // Log the full response for debugging
      Logger.debug('Full API Response', { response });

      // Handle errors
      if (response.error) {
        return this.handleErrorResponse(response);
      }

      // Process response based on provider
      return this.processProviderResponse(response);
    } catch (error) {
      return this.handleRequestError(error);
    }
  }

  /**
   * Prepares provider-specific request parameters
   */
  private prepareProviderSpecificRequest(): Partial<ResponseRequest> {
    if (this.provider === 'custom') {
      return {
        model: this.config.model,
        messages: this.messageHistory,
        store: false,
      };
    } else if (this.provider === 'hebo') {
      return {
        model: this.config.model,
        messages: this.messageHistory.map((msg) => ({
          role: roleMapper.toOpenAI(msg.role),
          content: msg.content,
        })),
        store: this.store,
      };
    } else {
      return {
        model: this.config.model,
        messages: this.messageHistory,
        store: false,
      };
    }
  }

  /**
   * Processes the response based on the provider
   */
  private processProviderResponse(response: Response): AgentOutput {
    if (!response.output?.[0]) {
      return {
        response: '',
        error: {
          message: 'Invalid response format',
          details: response,
        },
      };
    }

    const output = response.output[0];
    if (output.status !== 'completed') {
      return {
        response: '',
        error: {
          message: `Invalid output status: ${output.status}`,
          details: output,
        },
      };
    }

    const content = output.content[0];
    if (
      !content ||
      (content.type !== 'text' && content.type !== 'output_text')
    ) {
      return {
        response: '',
        error: {
          message: `Invalid content type: ${content?.type ?? 'undefined'}`,
          details: content,
        },
      };
    }

    const finalResponse = content.text;
    this.messageHistory.push({
      role: roleMapper.toRole(output.role),
      content: finalResponse,
      toolUsages: [],
      toolResponses: [],
    });

    return {
      response: `assistant: ${finalResponse}`,
      metadata: {
        id: response.id,
        model: response.model,
        usage: response.usage,
      },
    };
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

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.provider === 'openai' ? 300000 : 100000,
    );

    try {
      const endpoint = this.getEndpoint();
      this.logRequest(endpoint, headers, request);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorDetails: Record<string, unknown> = {};

        try {
          const errorBody = (await response.json()) as Record<string, unknown>;
          errorDetails = errorBody;
          errorMessage =
            (errorBody.error as { message?: string })?.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, try to get text
          const errorText = await response.text();
          errorDetails = { raw: errorText as string };
        }

        if (response.status === 504) {
          throw new Error('Gateway timeout - server took too long to respond');
        }
        if (response.status === 403) {
          if (
            this.provider === 'hebo' &&
            (errorDetails.raw as string)?.includes(
              'Invalid or inactive API key',
            )
          ) {
            throw new Error(
              'Invalid or inactive API key. Please:\n' +
                '1. Check that your API key is correct\n' +
                '2. Verify that your API key is active in your account\n' +
                '3. Ensure you have the necessary permissions\n' +
                'You can find your API key in your account settings at https://app.hebo.ai/settings',
            );
          }
          throw new Error(
            `Authentication failed (403 Forbidden). Please check your API key and permissions. Details: ${JSON.stringify(errorDetails)}`,
          );
        }

        // Log the full error details for debugging
        Logger.error('API Error Response', {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
        });

        throw new Error(
          `${errorMessage}\nDetails: ${JSON.stringify(errorDetails)}`,
        );
      }

      const data = await response.json();
      this.logResponse(data);
      return data as Response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(
            `Request timed out after ${this.provider === 'openai' ? '300' : '100'} seconds`,
          );
        }
        if (error.message.includes('Gateway timeout')) {
          throw error;
        }
        if (
          error.message.includes('fetch failed') ||
          error.message.includes('connect')
        ) {
          throw new Error(
            `Connection failed: ${error.message}. Please check your internet connection and try again.`,
          );
        }
      }

      // Log the full error for debugging
      Logger.error('Request Error', { error });
      throw error;
    }
  }

  /**
   * Gets the appropriate endpoint for the provider
   */
  private getEndpoint(): string {
    // For custom provider, use the exact URL from config without any modification
    if (this.provider === 'custom') {
      return this.baseUrl;
    }

    // For other providers, use the standard endpoint construction
    return this.provider === 'openai'
      ? `${this.baseUrl}/responses`
      : `${this.baseUrl}/api/responses`;
  }

  /**
   * Handles error responses
   */
  private handleErrorResponse(response: Response): AgentOutput {
    Logger.warn('Error in response', { error: response.error });
    return {
      response: '',
      error: {
        message: response.error?.message || 'Unknown error occurred',
        code: response.error?.code,
        details: response.error,
      },
    };
  }

  /**
   * Handles request errors
   */
  private handleRequestError(error: unknown): AgentOutput {
    Logger.error('Error processing input', { error });
    return {
      response: '',
      error: {
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
      },
    };
  }

  /**
   * Logs request details
   */
  private logRequest(
    endpoint: string,
    headers: Record<string, string>,
    request: ResponseRequest,
  ): void {
    if (Logger.isVerbose()) {
      console.log(`\n=== ${this.provider.toUpperCase()} API Request ===`);
      console.log('Endpoint:', endpoint);
      console.log('Headers:', JSON.stringify(headers, null, 2));
      console.log('Request Body:', JSON.stringify(request, null, 2));
      console.log('========================\n');
    }
  }

  /**
   * Logs response details
   */
  private logResponse(response: unknown): void {
    if (Logger.isVerbose()) {
      console.log(`\n=== ${this.provider.toUpperCase()} API Response ===`);
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log('========================\n');
    }
    // Also log to debug level for non-verbose mode
    Logger.debug('API Response', { response });
  }

  /**
   * Cleans up any resources used by the agent
   */
  public override async cleanup(): Promise<void> {
    this.messageHistory = [];
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
    const agent = new UnifiedAgent(config);
    if (this.agentKey) {
      await agent.authenticate({ agentKey: this.agentKey });
    }
    return agent;
  }
}
