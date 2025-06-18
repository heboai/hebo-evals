import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseAgent } from '../agents/interfaces/base-agent.js';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
} from '../agents/types/agent.types.js';
import {
  UnifiedAgent,
  UnifiedAgentConfig,
} from '../agents/implementations/unified-agent.js';
import { BaseMessage, MessageRole } from '../core/types/message.types.js';
import { roleMapper } from '../core/utils/role-mapper.js';

/**
 * Test implementation of BaseAgent for testing abstract functionality
 */
class TestAgent extends BaseAgent {
  protected processInput(_: AgentInput): Promise<AgentOutput> {
    return Promise.resolve({
      response: 'test response',
      metadata: {
        model: 'test-model',
        provider: 'test-provider',
      },
    });
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  const config: UnifiedAgentConfig = {
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

describe('UnifiedAgent', () => {
  let agent: UnifiedAgent;
  const config: UnifiedAgentConfig = {
    model: 'gato-qa:v1',
    provider: 'hebo',
  };

  beforeEach(() => {
    agent = new UnifiedAgent(config);
  });

  describe('Configuration', () => {
    it('should initialize with default baseUrl', () => {
      expect(agent['baseUrl']).toBe('https://app.hebo.ai');
    });

    it('should handle custom baseUrl with trailing slash', () => {
      const customConfig: UnifiedAgentConfig = {
        ...config,
        baseUrl: 'https://custom.hebo.ai/',
      };
      const customAgent = new UnifiedAgent(customConfig);
      expect(customAgent['baseUrl']).toBe('https://custom.hebo.ai');
    });

    it('should initialize with default store value', () => {
      expect(agent['store']).toBe(true);
    });

    it('should handle custom store value', () => {
      const customConfig: UnifiedAgentConfig = { ...config, store: false };
      const customAgent = new UnifiedAgent(customConfig);
      expect(customAgent['store']).toBe(false);
    });
  });

  describe('Cloning', () => {
    it('should create a clone with same configuration', async () => {
      await agent.initialize(config);
      await agent.authenticate({
        agentKey: 'test_key_123456789012345678901234567890',
      });

      const clone = await agent.clone();
      expect(clone).toBeInstanceOf(UnifiedAgent);
      const unifiedClone = clone as UnifiedAgent;
      expect(unifiedClone['config']).toEqual(agent['config']);
      expect(unifiedClone['messageHistory']).toHaveLength(0); // Clone should have empty history
    });
  });
});
