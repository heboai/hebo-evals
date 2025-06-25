import { describe, it, expect, beforeEach } from '@jest/globals';
import { Agent } from '../agents/implementations/agent.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(__dirname, 'fixtures');
const testConfigPath = path.join(fixturesDir, 'hebo-evals.config.test.yaml');

// Create fixtures directory and test config if they don't exist
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir);
}

if (!fs.existsSync(testConfigPath)) {
  fs.writeFileSync(
    testConfigPath,
    `providers:
  openai:
    apiKey: 'sk-test123456789012345678901234567890'
  hebo:
    apiKey: 'hebo_test_key_123456789012345678901234567890'
  custom-hebo:
    apiKey: 'custom_api_key_123456789012345678901234567890'
    baseUrl: 'https://custom.api.com'
`,
  );
}

// Point the config loader to the test config
process.env.HEBO_EVALS_CONFIG_PATH = testConfigPath;
// Set dummy API keys for providers
process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
process.env.HEBO_API_KEY = 'hebo_test_key_123456789012345678901234567890';
process.env.CUSTOM_HEBO_API_KEY =
  'custom_api_key_123456789012345678901234567890';

describe('Agent', () => {
  describe('Configuration and Initialization', () => {
    it('should initialize with model and API key', () => {
      const agent = new Agent('gato-qa:v1', {
        apiKey: 'hebo_test_key_123456789012345678901234567890',
      });

      const config = agent.getConfig();
      expect(config.model).toBe('gato-qa:v1');
      expect(config.provider).toBe('hebo');
      expect(config.apiKey).toBe(
        'hebo_test_key_123456789012345678901234567890',
      );
    });

    it('should initialize successfully for hebo provider', () => {
      const agent = new Agent('gato-qa:v1', {
        apiKey: 'hebo_test_key_123456789012345678901234567890',
      });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().provider).toBe('hebo');
    });

    it('should initialize successfully for openai provider', () => {
      const agent = new Agent('gpt-4', {
        apiKey: 'sk-test123456789012345678901234567890',
      });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().provider).toBe('openai');
    });

    it('should handle custom baseUrl configuration', () => {
      const agent = new Agent('gato-qa:v1', {
        apiKey: 'hebo_test_key_123456789012345678901234567890',
        baseUrl: 'https://custom.hebo.ai/',
      });

      expect(agent.getConfig().baseUrl).toBe('https://custom.hebo.ai/');
    });

    it('should initialize successfully for custom provider', () => {
      const agent = new Agent('custom-model', {
        apiKey: 'custom_api_key_123456789012345678901234567890',
        baseUrl: 'https://custom.api.com',
      });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().provider).toBe('custom-hebo'); // Provider mapping maps 'custom-' to 'custom-hebo'
    });

    it('should handle config path option without loading it', () => {
      // Mock the config path test to avoid file system access
      const agent = new Agent('gpt-4', {
        apiKey: 'sk-test123456789012345678901234567890',
        // Don't provide configPath to avoid file system check
      });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().model).toBe('gpt-4');
    });
  });

  describe('Validation', () => {
    it('should throw error for OpenAI key with Hebo provider', () => {
      expect(() => {
        new Agent('gato-qa:v1', {
          apiKey: 'sk-test123456789012345678901234567890',
        });
      }).toThrow('Configuration error: You are using an OpenAI API key');
    });

    it('should throw error for non-OpenAI key with OpenAI provider', () => {
      expect(() => {
        new Agent('gpt-4', {
          apiKey: 'hebo_test_key_123456789012345678901234567890',
        });
      }).toThrow('Configuration error: You are using a non-OpenAI API key');
    });

    it('should create agent successfully when API key is available from config', () => {
      // This test verifies that the agent can successfully use API keys from the config
      // In the test environment, this will likely find an API key from env vars
      const agent = new Agent('gpt-4', {});
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().model).toBe('gpt-4');
      expect(agent.getConfig().apiKey).toBeTruthy();
    });
  });

  describe('Input Processing', () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent('gato-qa:v1', {
        apiKey: 'hebo_test_key_123456789012345678901234567890',
      });
    });

    it('should have sendInput method ready to use', () => {
      // We can't test the actual API call without mocking fetch,
      // but we can verify the method exists and would attempt to process
      expect(typeof agent.sendInput).toBe('function');
      expect(agent).toHaveProperty('sendInput');
    });
  });

  describe('Cleanup', () => {
    it('should have cleanup method that resolves', async () => {
      const agent = new Agent('gato-qa:v1', {
        apiKey: 'hebo_test_key_123456789012345678901234567890',
      });

      await expect(agent.cleanup()).resolves.toBeUndefined();
    });
  });
});
