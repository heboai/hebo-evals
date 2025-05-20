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
  private apiKey?: string;

  constructor(config: HeboAgentConfig) {
    super(config);
    // Remove trailing slash from baseUrl if present
    const rawBaseUrl = config.baseUrl || 'https://api.hebo.ai';
    this.baseUrl = rawBaseUrl.replace(/\/$/, '');
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
    this.apiKey = authConfig.apiKey;
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
      let finalResponse = '';
      if (response.choices.length > 0 && response.choices[0].message) {
        const message = response.choices[0].message;
        this.messageHistory.push({
          role: roleMapper.toRole(message.role),
          content: message.content || '',
          toolUsages: message.toolUsages || [],
          toolResponses: message.toolResponses || [],
        });
        // If there are tool usages and tool responses, format them into the response
        if (
          message.toolUsages &&
          message.toolUsages.length > 0 &&
          message.toolResponses &&
          message.toolResponses.length > 0
        ) {
          finalResponse = message.content || '';
          for (let i = 0; i < message.toolUsages.length; i++) {
            const usage = message.toolUsages[i];
            const resp = message.toolResponses[i];
            finalResponse += `\ntool use: ${usage.name} args: ${JSON.stringify(usage.args)}`;
            finalResponse += `\ntool response: ${resp.content}`;
          }
        } else {
          finalResponse = message.content || '';
        }
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
        response: finalResponse,
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
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await fetch(`${this.baseUrl}/api/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    // Log the status and response body for debugging (do not log API key)
    const responseClone = response.clone();
    let responseBody;
    try {
      responseBody = await responseClone.text();
    } catch {
      responseBody = '[Unable to read response body]';
    }
    console.log('[HeboAgent] Response status:', response.status);
    console.log('[HeboAgent] Response body:', responseBody);

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
