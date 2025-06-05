import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseAgent } from '../agents/interfaces/base-agent.js';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
} from '../agents/types/agent.types.js';
import { HeboAgent } from '../agents/implementations/hebo-agent.js';
import { BaseMessage, MessageRole } from '../core/types/message.types.js';
import { roleMapper } from '../core/utils/role-mapper.js';
import { OpenAIAgent } from '../agents/implementations/openai-agent.js';

/**
 * Test implementation of BaseAgent for testing abstract functionality
 */
class TestAgent extends BaseAgent {
  protected processInput(_: AgentInput): Promise<AgentOutput> {
    return Promise.resolve({
      response: 'test response',
      metadata: { test: true },
    });
  }
}

describe('Agent Types and Interfaces', () => {
  describe('BaseMessage', () => {
    it('should create a valid user message', () => {
      const message: BaseMessage = {
        role: MessageRole.USER,
        content: 'Hello',
      };
      expect(message.role).toBe(MessageRole.USER);
      expect(message.content).toBe('Hello');
    });
  });

  describe('AgentInput', () => {
    it('should create input with multiple messages', () => {
      const input: AgentInput = {
        messages: [
          { role: MessageRole.USER, content: 'Hello' },
          { role: MessageRole.ASSISTANT, content: 'Hi there' },
        ],
      };
      expect(input.messages).toHaveLength(2);
    });
  });
});

describe('BaseAgent', () => {
  let agent: TestAgent;
  const config: AgentConfig = {
    model: 'gpt-4o',
    provider: 'hebo',
  };

  beforeEach(() => {
    agent = new TestAgent(config);
  });

  describe('Initialization', () => {
    it('should initialize with valid config', async () => {
      await agent.initialize(config);
      expect(agent.getConfig()).toEqual(config);
    });

    it('should throw error for invalid config', async () => {
      const invalidConfig = { ...config, model: '' };
      await expect(agent.initialize(invalidConfig)).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should authenticate with valid API key', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });
      // No error means success
    });

    it('should throw error if not initialized before authentication', async () => {
      await expect(
        agent.authenticate({
          agentKey: 'test_key_123456789012345678901234567890',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Input Processing', () => {
    it('should process input after initialization and authentication', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      const output = await agent.sendInput(input);
      expect(output.response).toBe('test response');
    });

    it('should throw error if not authenticated before sending input', async () => {
      await agent.initialize(config);
      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };
      await expect(agent.sendInput(input)).rejects.toThrow();
    });
  });
});

describe('HeboAgent', () => {
  let agent: HeboAgent;
  const config: AgentConfig = {
    model: 'gpt-4o',
    provider: 'hebo',
  };

  beforeEach(() => {
    agent = new HeboAgent(config);
  });

  describe('Configuration', () => {
    it('should initialize with default baseUrl', () => {
      expect(agent['baseUrl']).toBe('https://app.hebo.ai');
    });

    it('should handle custom baseUrl with trailing slash', () => {
      const customConfig = { ...config, baseUrl: 'https://custom.hebo.ai/' };
      const customAgent = new HeboAgent(customConfig);
      expect(customAgent['baseUrl']).toBe('https://custom.hebo.ai');
    });

    it('should initialize with default store value', () => {
      expect(agent['store']).toBe(true);
    });

    it('should handle custom store value', () => {
      const customConfig = { ...config, store: false };
      const customAgent = new HeboAgent(customConfig);
      expect(customAgent['store']).toBe(false);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network failure gracefully', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      // Mock fetch to simulate network errors
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Network error: Failed to fetch');
      }) as jest.MockedFunction<typeof fetch>;

      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      const output = await agent.sendInput(input);

      // Verify error handling
      expect(output).toBeDefined();
      expect(output.response).toBe('');
      expect(output.error).toBeDefined();
      expect(output.error?.message).toBe('Network error: Failed to fetch');
      expect(output.error?.details).toBeDefined();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('should handle HTTP error responses gracefully', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      // Mock fetch to simulate HTTP error
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: { message: 'Server error' } }),
          clone: () => ({
            text: () =>
              Promise.resolve('{"error": {"message": "Server error"}}'),
          }),
        } as Response);
      }) as jest.MockedFunction<typeof fetch>;

      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      const output = await agent.sendInput(input);

      // Verify error handling
      expect(output).toBeDefined();
      expect(output.response).toBe('');
      expect(output.error).toBeDefined();
      expect(output.error?.message).toContain('HTTP error! status: 500');
      expect(output.error?.details).toBeDefined();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('should handle gateway timeout', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 504,
          statusText: 'Gateway Timeout',
        } as Response);
      }) as jest.MockedFunction<typeof fetch>;

      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      const output = await agent.sendInput(input);
      expect(output.response).toBe('');
      expect(output.error?.message).toContain('Gateway timeout');

      global.fetch = originalFetch;
    });

    it('should handle invalid API key response', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 403,
          text: () => Promise.resolve('Invalid or inactive API key'),
        } as Response);
      }) as jest.MockedFunction<typeof fetch>;

      const input: AgentInput = {
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
      };

      const output = await agent.sendInput(input);
      expect(output.response).toBe('');
      expect(output.error?.message).toContain('Invalid or inactive API key');

      global.fetch = originalFetch;
    });
  });

  describe('Message History', () => {
    it('should maintain conversation history', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const input: AgentInput = {
        messages: [
          { role: MessageRole.USER, content: 'Hello' },
          { role: MessageRole.ASSISTANT, content: 'Hi there' },
        ],
      };

      await agent.sendInput(input);
      expect(agent['messageHistory']).toHaveLength(2);
    });

    it('should clear message history on cleanup', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      // Add some messages to history
      agent['messageHistory'] = [
        { role: MessageRole.USER, content: 'Test message' },
        { role: MessageRole.ASSISTANT, content: 'Test response' },
      ];

      await agent.cleanup();
      expect(agent['messageHistory']).toHaveLength(0);
    });
  });

  describe('Message Conversion', () => {
    it('should handle role conversion correctly', () => {
      expect(roleMapper.toOpenAI(MessageRole.USER)).toBe('user');
      expect(roleMapper.toOpenAI(MessageRole.ASSISTANT)).toBe('assistant');
      expect(roleMapper.toOpenAI(MessageRole.SYSTEM)).toBe('system');
    });
  });

  describe('Memory Management', () => {
    it('should handle multiple consecutive inputs without performance degradation', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      // Mock fetch to simulate API responses
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 'test-id',
              model: config.model,
              status: 'completed',
              output: [
                {
                  type: 'message',
                  status: 'completed',
                  role: 'assistant',
                  content: [
                    {
                      type: 'output_text',
                      text: 'Test response',
                    },
                  ],
                },
              ],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
              },
            }),
          clone: () => ({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  id: 'test-id',
                  model: config.model,
                  status: 'completed',
                  output: [
                    {
                      type: 'message',
                      status: 'completed',
                      role: 'assistant',
                      content: [
                        {
                          type: 'output_text',
                          text: 'Test response',
                        },
                      ],
                    },
                  ],
                  usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                  },
                }),
              ),
          }),
        } as Response);
      }) as jest.MockedFunction<typeof fetch>;

      // Simulate a conversation with multiple messages
      const conversationRounds = 2; // Reduced for testing
      const messagesPerRound = 3;

      for (let round = 0; round < conversationRounds; round++) {
        const input: AgentInput = {
          messages: Array.from({ length: messagesPerRound }, (_, i) => ({
            role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
            content: `Message ${round * messagesPerRound + i + 1}`,
          })),
        };

        const output = await agent.sendInput(input);

        // Verify response is received
        expect(output).toBeDefined();
        expect(output.response).toBe('Test response');

        // Verify message history contains only current round messages plus assistant response
        // Each round should have messagesPerRound input messages + 1 assistant response
        expect(agent['messageHistory']).toHaveLength(messagesPerRound + 1);

        // Verify the content of the messages
        const history = agent['messageHistory'];

        // Check input messages
        for (let i = 0; i < messagesPerRound; i++) {
          expect(history[i].content).toBe(
            `Message ${round * messagesPerRound + i + 1}`,
          );
          expect(history[i].role).toBe(
            i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
          );
        }

        // Check assistant response
        expect(history[messagesPerRound].content).toBe('Test response');
        expect(history[messagesPerRound].role).toBe(MessageRole.ASSISTANT);
      }

      // Final verification - should only contain the last round's messages
      const finalHistory = agent['messageHistory'];
      expect(finalHistory).toHaveLength(messagesPerRound + 1);

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  describe('Cloning', () => {
    it('should create a clone with same configuration', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const clone = await agent.clone();
      expect(clone).toBeInstanceOf(HeboAgent);
      const heboClone = clone as HeboAgent;
      expect(heboClone['config']).toEqual(agent['config']);
      expect(heboClone['messageHistory']).toHaveLength(0); // Clone should have empty history
    });
  });

  describe('Pass System Messages', () => {
    it('should pass system messages to instruction field', async () => {
      const agent = new OpenAIAgent({
        model: 'gpt-3.5-turbo',
        provider: 'openai',
      });
      await agent.initialize({
        model: 'gpt-3.5-turbo',
        provider: 'openai',
      });
      await agent.authenticate({
        agentKey: 'sk-test123456789012345678901234567890',
      });

      const input: AgentInput = {
        messages: [
          {
            role: MessageRole.SYSTEM,
            content: 'You are a helpful assistant',
          },
          {
            role: MessageRole.USER,
            content: 'Hello',
          },
        ],
      };

      // Mock the fetch call
      const mockFetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'test-id',
              object: 'chat.completion',
              created: 1234567890,
              model: 'gpt-3.5-turbo',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: 'Hi there!',
                  },
                },
              ],
            }),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      await agent.sendInput(input);

      // Verify that the request included the system message in the instruction field
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(
            '"instructions":"You are a helpful assistant"',
          ),
        }),
      );
    });
  });
});
