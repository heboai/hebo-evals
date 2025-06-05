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
   * Validates the response status and structure
   * @param response The API response to validate
   * @returns Object containing validation result and error details if any
   */
  private validateResponseStatus(response: Response): {
    isValid: boolean;
    error?: { message: string; details: unknown };
  } {
    // Check if response is completed
    if (response.status !== 'completed') {
      Logger.warn('Response not completed', { status: response.status });
      return {
        isValid: false,
        error: {
          message: `Response not completed: ${response.status}`,
          details: response,
        },
      };
    }

    // Check if output exists
    if (!response.output || response.output.length === 0) {
      Logger.warn('No output in response');
      return {
        isValid: false,
        error: {
          message: 'No output in response',
          details: response,
        },
      };
    }

    const output = response.output[0];
    if (output.type !== 'message' || output.status !== 'completed') {
      Logger.warn('Invalid output type or status', { output });
      return {
        isValid: false,
        error: {
          message: `Invalid output type or status: ${output.type} ${output.status}`,
          details: output,
        },
      };
    }

    return { isValid: true };
  }

  /**
   * Extracts the response text from the API response
   * @param response The API response to extract text from
   * @returns Object containing the extracted text and error details if any
   */
  private extractResponseText(response: Response): {
    text: string;
    error?: { message: string; details: unknown };
  } {
    if (!response.output?.[0]) {
      Logger.warn('No output in response');
      return {
        text: '',
        error: {
          message: 'No output in response',
          details: response,
        },
      };
    }

    const output = response.output[0];
    const content = output.content[0];

    if (content.type !== 'output_text') {
      Logger.warn('Invalid content type', { type: content.type });
      return {
        text: '',
        error: {
          message: `Invalid content type: ${content.type}`,
          details: content,
        },
      };
    }

    return { text: content.text };
  }

  /**
   * Processes the input and returns the agent's response
   */
  protected async processInput(input: AgentInput): Promise<AgentOutput> {
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

    const request: ResponseRequest = {
      model: this.config.model,
      input: this.messageHistory,
      store: this.store,
    };

    // Add system messages to instructions field if present
    if (instructions) {
      request.instructions = instructions;
      Logger.debug('System instructions added to request', {
        instructions,
      });
    }

    // Only add store and previous_response_id for Hebo provider
    if (this.provider === 'hebo') {
      request.store = this.store;
      if (this.previousResponseId) {
        request.previous_response_id = this.previousResponseId;
      }
    }

    try {
      const response = await this.makeRequest(request);
      this.previousResponseId = response.id;

      // Log the full response for debugging
      Logger.debug('Full API Response', { response });

      // Check if we have an error in the response
      if (response.error) {
        Logger.warn('Error in response', { error: response.error });
        return {
          response: '',
          error: {
            message: response.error.message,
            code: response.error.code,
            details: response.error,
          },
        };
      }

      // Validate response status and structure
      const validationResult = this.validateResponseStatus(response);
      if (!validationResult.isValid) {
        return {
          response: '',
          error: validationResult.error,
        };
      }

      // Extract response text
      const extractionResult = this.extractResponseText(response);
      if (extractionResult.error) {
        return {
          response: '',
          error: extractionResult.error,
        };
      }

      const finalResponse = extractionResult.text;

      // Add assistant's response to history
      this.messageHistory.push({
        role: roleMapper.toRole(response.output?.[0]?.role ?? 'assistant'),
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
      const endpoint = `${this.baseUrl}/responses`;
      if (Logger.isVerbose()) {
        console.log('\n=== OpenAI API Request ===');
        console.log('Endpoint:', endpoint);
        console.log('Headers:', JSON.stringify(headers, null, 2));
        console.log('Request Body:', JSON.stringify(request, null, 2));
        console.log('========================\n');
      }
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

        // Parse the error response to access structured fields
        let errorData: { error?: { type?: string; code?: string } } = {};
        try {
          errorData = JSON.parse(errorBody) as {
            error?: { type?: string; code?: string };
          };
        } catch {
          // If parsing fails, use the raw error body
          throw new Error(`OpenAI API error: ${errorBody}`);
        }

        // Check for previous response not found using structured error fields
        if (
          errorData.error?.type === 'previous_response_not_found' ||
          errorData.error?.code === 'previous_response_not_found'
        ) {
          this.previousResponseId = undefined;
        }

        throw new Error(`OpenAI API error: ${errorBody}`);
      }

      const data = await response.json();

      // Add detailed logging of the response
      if ((Logger.isVerbose as () => boolean)()) {
        console.log('\n=== OpenAI API Response ===');
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('========================\n');
      }

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
