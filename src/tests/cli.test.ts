import { jest } from '@jest/globals';
import { Command } from 'commander';
import { version } from '../utils/package-info.js';
import { HeboAgent } from '../agents/implementations/hebo-agent';
import { ScoringService } from '../scoring/scoring.service';
import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { EmbeddingProviderFactory } from '../embeddings/config/embedding.config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EvaluationReport } from '../evaluation/types/evaluation.types';

// Increase timeout for all tests in this file
jest.setTimeout(10000);

// Create mock functions with proper Jest mocking
const mockHeboAgentInitialize = jest.fn().mockResolvedValue(undefined);
const mockHeboAgentAuthenticate = jest.fn().mockResolvedValue(undefined);
const mockHeboAgentCleanup = jest.fn().mockResolvedValue(undefined);
const mockHeboAgentValidateConfig = jest.fn();
const mockHeboAgentSendInput = jest.fn();
const mockHeboAgentGetConfig = jest.fn();

const mockEvaluateFromDirectory = jest.fn().mockResolvedValue({
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  passRate: 0,
  results: [],
  timestamp: new Date(),
  duration: 0,
});

const mockEmbeddingProviderCleanup = jest.fn().mockResolvedValue(undefined);
const mockScoreStrings = jest.fn();
const mockEmbeddingProviderFactoryCreateProvider = jest.fn();
const mockEmbeddingProviderFactoryLoadFromEnv = jest.fn();

// Mock dependencies
jest.mock('../agents/implementations/hebo-agent', () => {
  return {
    HeboAgent: jest.fn().mockImplementation(() => ({
      initialize: mockHeboAgentInitialize,
      authenticate: mockHeboAgentAuthenticate,
      cleanup: mockHeboAgentCleanup,
      validateConfig: mockHeboAgentValidateConfig,
      sendInput: mockHeboAgentSendInput,
      getConfig: mockHeboAgentGetConfig,
    })),
  };
});

jest.mock('../scoring/scoring.service', () => ({
  ScoringService: jest.fn().mockImplementation(() => ({
    scoreStrings: mockScoreStrings,
  })),
}));

jest.mock('../evaluation/evaluation-executor', () => {
  return {
    EvaluationExecutor: jest.fn().mockImplementation(() => ({
      evaluateFromDirectory: mockEvaluateFromDirectory,
      executeTestCasesFromDirectory: jest.fn(),
      executeTestCase: jest.fn(),
      executeTestCases: jest.fn(),
    })),
  };
});

jest.mock('../embeddings/config/embedding.config', () => ({
  EmbeddingProviderFactory: {
    createProvider: mockEmbeddingProviderFactoryCreateProvider,
    loadFromEnv: mockEmbeddingProviderFactoryLoadFromEnv,
  },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

jest.mock('path');

// Mock Commander's parse method to prevent process.exit
jest.spyOn(Command.prototype, 'parse').mockImplementation(function () {
  return this;
});

describe('CLI Commands', () => {
  let program: Command;
  let originalArgv: string[];
  
  beforeEach(() => {
    // Store original process.argv
    originalArgv = process.argv;
    // Reset process.argv
    process.argv = ['node', 'hebo-eval'];
    // Create a new Command instance
    program = new Command();

    // Reset all mocks
    jest.clearAllMocks();

    // Set up EmbeddingProviderFactory mock methods to return specific values for tests
    mockEmbeddingProviderFactoryCreateProvider.mockReturnValue({
      cleanup: mockEmbeddingProviderCleanup,
    });
    
    mockEmbeddingProviderFactoryLoadFromEnv.mockReturnValue({
      defaultProvider: 'litellm',
      litellm: { model: 'test-model' },
    });
  });

  afterEach(() => {
    // Restore process.argv
    process.argv = originalArgv;
  });

  describe('version command', () => {
    it('should be configured with the correct version', () => {
      // Configure the program
      program
        .name('hebo-eval')
        .description('A CLI tool for evaluating and testing language models')
        .version(version);

      // Add version command
      program
        .command('version')
        .description('Display the current version')
        .action(() => {
          console.log(version);
        });

      // Verify configuration
      expect(program.name()).toBe('hebo-eval');
      expect(program.description()).toBe(
        'A CLI tool for evaluating and testing language models',
      );
      expect(program.version()).toBe(version);

      // Verify version command
      const versionCommand = program.commands.find(
        (cmd) => cmd.name() === 'version',
      );
      expect(versionCommand).toBeDefined();
      expect(versionCommand?.description()).toBe('Display the current version');
    });
  });

  describe('help output', () => {
    it('should include the correct program name and description', () => {
      // Configure the program
      program
        .name('hebo-eval')
        .description('A CLI tool for evaluating and testing language models')
        .version(version);

      // Add version command
      program
        .command('version')
        .description('Display the current version')
        .action(() => {
          console.log(version);
        });

      // Verify configuration
      expect(program.name()).toBe('hebo-eval');
      expect(program.description()).toBe(
        'A CLI tool for evaluating and testing language models',
      );
      expect(program.commands).toHaveLength(1);
      expect(program.commands[0].name()).toBe('version');
    });
  });

  describe('run command', () => {
    it('should execute evaluation with environment variables', async () => {
      // Setup environment
      process.env.HEBO_API_KEY = 'test-key';
      process.env.HEBO_BASE_URL = 'https://test-api.hebo.ai';

      // Mock evaluation result
      const mockReport = {
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        passRate: 0.5,
        results: [],
        timestamp: new Date(),
        duration: 1.5,
      };

      mockEvaluateFromDirectory.mockResolvedValueOnce(mockReport);

      // Import CLI after environment setup
      const cli = await import('../cli');

      // Verify agent initialization
      expect(mockHeboAgentInitialize).toHaveBeenCalledWith({
        model: 'gato-qa:next',
      });
      expect(mockHeboAgentAuthenticate).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });

      // Verify evaluation execution
      expect(mockEvaluateFromDirectory).toHaveBeenCalledWith(
        expect.anything(),
        './test-cases',
        false,
      );

      // Verify cleanup
      expect(mockHeboAgentCleanup).toHaveBeenCalled();
      expect(mockEmbeddingProviderCleanup).toHaveBeenCalled();
    });

    it('should execute evaluation with config file', async () => {
      // Mock config file content
      const mockConfig = {
        embedding: {
          defaultProvider: 'litellm',
          litellm: { model: 'test-model' },
        },
        agent: {
          apiKey: 'test-key',
          baseUrl: 'https://test-api.hebo.ai',
        },
      };
      
      (readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockConfig));

      // Mock evaluation result
      const mockReport = {
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        passRate: 0.5,
        results: [],
        timestamp: new Date(),
        duration: 1.5,
      };

      mockEvaluateFromDirectory.mockResolvedValueOnce(mockReport);

      // Import CLI after mocks setup
      const cli = await import('../cli');

      // Verify config loading
      expect(readFileSync).toHaveBeenCalled();

      // Verify agent initialization
      expect(mockHeboAgentInitialize).toHaveBeenCalledWith({
        model: 'gato-qa:next',
      });
      expect(mockHeboAgentAuthenticate).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });

      // Verify evaluation execution
      expect(mockEvaluateFromDirectory).toHaveBeenCalledWith(
        expect.anything(),
        './test-cases',
        false,
      );
    });

    it('should handle missing API key', async () => {
      // Clear environment variables
      delete process.env.HEBO_API_KEY;

      // Import CLI
      const cli = await import('../cli');

      // Verify error handling
      expect(mockHeboAgentInitialize).not.toHaveBeenCalled();
      expect(mockHeboAgentAuthenticate).not.toHaveBeenCalled();
    });

    it('should handle evaluation errors', async () => {
      // Setup environment
      process.env.HEBO_API_KEY = 'test-key';

      mockEvaluateFromDirectory.mockRejectedValueOnce(new Error('Evaluation failed'));

      // Import CLI
      const cli = await import('../cli');

      // Verify error handling
      expect(mockHeboAgentCleanup).toHaveBeenCalled();
      expect(mockEmbeddingProviderCleanup).toHaveBeenCalled();
    });

    it('should use custom directory path when provided', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--directory',
        '/custom/path',
      ];

      const cli = await import('../cli');

      expect(mockEvaluateFromDirectory).toHaveBeenCalledWith(
        expect.anything(),
        '/custom/path',
        false,
      );
    });

    it('should use custom threshold when provided', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--threshold',
        '0.8',
      ];

      const cli = await import('../cli');

      // Verify the EvaluationExecutor was created with the correct config
      expect(EvaluationExecutor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          threshold: 0.8,
          useSemanticScoring: true,
          outputFormat: 'markdown',
          maxConcurrency: 5,
        }),
      );
    });

    it('should use custom max concurrency when provided', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--max-concurrency',
        '10',
      ];

      const cli = await import('../cli');

      expect(EvaluationExecutor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          maxConcurrency: 10,
        }),
      );
    });

    it('should disable semantic scoring when specified', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--no-use-semantic-scoring',
      ];

      const cli = await import('../cli');

      expect(EvaluationExecutor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          useSemanticScoring: false,
        }),
      );
    });

    it('should generate report in specified format', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--format',
        'json',
      ];

      const mockReport = {
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        passRate: 0.5,
        results: [],
        timestamp: new Date(),
        duration: 1.5,
      };

      mockEvaluateFromDirectory.mockResolvedValueOnce(mockReport);

      const cli = await import('../cli');

      // Verify report generation with correct format
      expect(EvaluationExecutor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outputFormat: 'json',
        }),
      );
    });

    it('should stop on first error when specified', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--stop-on-error',
      ];

      const cli = await import('../cli');

      expect(mockEvaluateFromDirectory).toHaveBeenCalledWith(
        expect.anything(),
        './test-cases',
        true,
      );
    });

    it('should handle invalid JSON in config file', async () => {
      (readFileSync as jest.Mock).mockReturnValueOnce('invalid json');
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--config',
        'invalid.json',
      ];

      const cli = await import('../cli');

      expect(mockHeboAgentInitialize).not.toHaveBeenCalled();
      expect(mockHeboAgentAuthenticate).not.toHaveBeenCalled();
    });

    it('should handle missing config file', async () => {
      (readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--config',
        'missing.json',
      ];

      const cli = await import('../cli');

      expect(mockHeboAgentInitialize).not.toHaveBeenCalled();
      expect(mockHeboAgentAuthenticate).not.toHaveBeenCalled();
    });

    it('should handle agent initialization failure', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      mockHeboAgentInitialize.mockRejectedValueOnce(new Error('Initialization failed'));

      const cli = await import('../cli');

      expect(mockHeboAgentCleanup).toHaveBeenCalled();
      expect(mockEmbeddingProviderCleanup).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      mockHeboAgentAuthenticate.mockRejectedValueOnce(new Error('Authentication failed'));

      const cli = await import('../cli');

      expect(mockHeboAgentCleanup).toHaveBeenCalled();
      expect(mockEmbeddingProviderCleanup).toHaveBeenCalled();
    });

    it('should handle embedding provider initialization failure', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      mockEmbeddingProviderFactoryCreateProvider.mockImplementationOnce(() => {
        throw new Error('Provider initialization failed');
      });

      const cli = await import('../cli');

      expect(mockHeboAgentCleanup).toHaveBeenCalled();
    });

    it('should handle invalid report format', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      process.argv = [
        'node',
        'hebo-eval',
        'run',
        'test-agent',
        '--format',
        'invalid-format',
      ];

      const cli = await import('../cli');

      expect(EvaluationExecutor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outputFormat: 'markdown', // Should default to markdown
        }),
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      process.env.HEBO_API_KEY = 'test-key';
      mockHeboAgentCleanup.mockRejectedValueOnce(new Error('Cleanup failed'));
      mockEmbeddingProviderCleanup.mockRejectedValueOnce(new Error('Provider cleanup failed'));

      const cli = await import('../cli');

      // Should not throw, but log errors
      expect(mockHeboAgentCleanup).toHaveBeenCalled();
      expect(mockEmbeddingProviderCleanup).toHaveBeenCalled();
    });
  });
});
