import { describe, it, expect, beforeEach } from '@jest/globals';
import { BaseAgent } from '../agents/interfaces/base-agent';
import {
  AgentConfig,
  AgentInput,
  AgentMessage,
  AgentOutput,
} from '../agents/types/agent.types';
import { HeboAgent } from '../agents/implementations/hebo-agent';

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
  describe('AgentMessage', () => {
    it('should create a valid user message', () => {
      const message: AgentMessage = {
        role: 'user',
        content: 'Hello',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });
  });

  describe('AgentInput', () => {
    it('should create input with multiple messages', () => {
      const input: AgentInput = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
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
      await agent.authenticate({ apiKey: 'test-key' });
      // No error means success
    });

    it('should throw error if not initialized before authentication', async () => {
      await expect(
        agent.authenticate({ apiKey: 'test-key' }),
      ).rejects.toThrow();
    });
  });

  describe('Input Processing', () => {
    it('should process input after initialization and authentication', async () => {
      await agent.initialize(config);
      await agent.authenticate({ apiKey: 'test-key' });

      const input: AgentInput = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const output = await agent.sendInput(input);
      expect(output.response).toBe('test response');
    });

    it('should throw error if not authenticated before sending input', async () => {
      await agent.initialize(config);
      const input: AgentInput = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      await expect(agent.sendInput(input)).rejects.toThrow();
    });
  });
});

describe('HeboAgent', () => {
  let agent: HeboAgent;
  const config = {
    model: 'gpt-4o',
    systemMessage: 'You are a test agent',
  };

  beforeEach(() => {
    agent = new HeboAgent(config);
  });

  describe('Message History', () => {
    it('should initialize with system message', () => {
      expect(agent['messageHistory']).toHaveLength(1);
      expect(agent['messageHistory'][0].role).toBe('system');
    });

    it('should maintain conversation history', async () => {
      await agent.initialize(config);
      await agent.authenticate({ apiKey: 'test-key' });

      const input: AgentInput = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };

      await agent.sendInput(input);
      expect(agent['messageHistory']).toHaveLength(3); // system + 2 messages
    });
  });

  describe('Message Conversion', () => {
    it('should convert agent messages to Hebo format', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const converted = agent['convertToHeboMessages'](messages);
      expect(converted).toHaveLength(2);
      expect(converted[0].role).toBe('user');
    });

    it('should handle role conversion correctly', () => {
      expect(agent['convertRole']('user')).toBe('user');
      expect(agent['convertRole']('assistant')).toBe('assistant');
      expect(agent['convertRole']('system')).toBe('system');
    });
  });
});
