import { jest } from '@jest/globals';
import { Command } from 'commander';
import { version } from '../utils/package-info.js';
import { HeboAgent } from '../agents/implementations/hebo-agent';
import { ScoringService } from '../scoring/scoring.service';
import { EvaluationExecutor } from '../evaluation/evaluation-executor';
import { EmbeddingProviderFactory } from '../embeddings/config/embedding.config';
import { readFileSync } from 'fs';
import { join } from 'path';

// Increase timeout for all tests in this file
jest.setTimeout(10000);

// Mock dependencies
jest.mock('../agents/implementations/hebo-agent', () => {
  const mockHeboAgent = {
    initialize: jest.fn(),
    authenticate: jest.fn(),
    cleanup: jest.fn(),
    validateConfig: jest.fn(),
    sendInput: jest.fn(),
    getConfig: jest.fn(),
  };
  return {
    HeboAgent: jest.fn().mockImplementation(() => mockHeboAgent),
  };
});
jest.mock('../scoring/scoring.service', () => ({
  ScoringService: jest.fn().mockImplementation(() => ({
    scoreStrings: jest.fn(),
  })),
}));
jest.mock('../evaluation/evaluation-executor', () => ({
  EvaluationExecutor: jest.fn().mockImplementation(() => ({
    evaluateFromDirectory: jest.fn(),
    executeTestCasesFromDirectory: jest.fn(),
    executeTestCase: jest.fn(),
  })),
}));
jest.mock('../embeddings/config/embedding.config', () => ({
  EmbeddingProviderFactory: {
    createProvider: jest.fn(),
    loadFromEnv: jest.fn(),
  },
}));
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));
jest.mock('path');

// Mock Commander's parse method to prevent process.exit
jest.spyOn(Command.prototype, 'parse').mockImplementation(function (
  this: Command,
) {
  return this;
});

describe('CLI Commands', () => {
  let program: Command;
  let originalArgv: string[];
  let mockHeboAgent: jest.Mocked<HeboAgent>;
  let mockScoringService: jest.Mocked<ScoringService>;
  let mockEvaluationExecutor: jest.Mocked<EvaluationExecutor>;
  let mockEmbeddingProvider: jest.Mocked<any>;

  beforeEach(() => {
    // Store original process.argv
    originalArgv = process.argv;
    // Reset process.argv
    process.argv = ['node', 'hebo-eval'];
    // Create a new Command instance
    program = new Command();

    // Reset all mocks
    jest.clearAllMocks();

    // Get mock instances
    mockHeboAgent = new (HeboAgent as any)({
      model: 'test-model',
    }) as jest.Mocked<HeboAgent>;
    mockScoringService =
      new (ScoringService as any)() as jest.Mocked<ScoringService>;
    mockEvaluationExecutor =
      new (EvaluationExecutor as any)() as jest.Mocked<EvaluationExecutor>;
    mockEmbeddingProvider = {
      cleanup: jest.fn(),
    };

    // Set up EmbeddingProviderFactory mock methods
    const { EmbeddingProviderFactory: mockFactory } = jest.requireMock(
      '../embeddings/config/embedding.config',
    ) as {
      EmbeddingProviderFactory: {
        createProvider: jest.Mock;
        loadFromEnv: jest.Mock;
      };
    };
    mockFactory.createProvider.mockReturnValue(mockEmbeddingProvider);
    mockFactory.loadFromEnv.mockReturnValue({
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
      mockEvaluationExecutor.evaluateFromDirectory.mockResolvedValue(
        mockReport,
      );

      // Import CLI after environment setup
      const cli = await import('../cli');

      // Verify agent initialization
      expect(mockHeboAgent.initialize).toHaveBeenCalledWith({
        model: 'gato-qa:next',
      });
      expect(mockHeboAgent.authenticate).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });

      // Verify evaluation execution
      expect(mockEvaluationExecutor.evaluateFromDirectory).toHaveBeenCalledWith(
        mockHeboAgent,
        './test-cases',
        false,
      );

      // Verify cleanup
      expect(mockHeboAgent.cleanup).toHaveBeenCalled();
      expect(mockEmbeddingProvider.cleanup).toHaveBeenCalled();
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
      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

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
      mockEvaluationExecutor.evaluateFromDirectory.mockResolvedValue(
        mockReport,
      );

      // Import CLI after mocks setup
      const cli = await import('../cli');

      // Verify config loading
      expect(readFileSync).toHaveBeenCalled();

      // Verify agent initialization
      expect(mockHeboAgent.initialize).toHaveBeenCalledWith({
        model: 'gato-qa:next',
      });
      expect(mockHeboAgent.authenticate).toHaveBeenCalledWith({
        apiKey: 'test-key',
      });

      // Verify evaluation execution
      expect(mockEvaluationExecutor.evaluateFromDirectory).toHaveBeenCalledWith(
        mockHeboAgent,
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
      expect(mockHeboAgent.initialize).not.toHaveBeenCalled();
      expect(mockHeboAgent.authenticate).not.toHaveBeenCalled();
    });

    it('should handle evaluation errors', async () => {
      // Setup environment
      process.env.HEBO_API_KEY = 'test-key';

      // Mock evaluation error
      mockEvaluationExecutor.evaluateFromDirectory.mockRejectedValue(
        new Error('Evaluation failed'),
      );

      // Import CLI
      const cli = await import('../cli');

      // Verify error handling
      expect(mockHeboAgent.cleanup).toHaveBeenCalled();
      expect(mockEmbeddingProvider.cleanup).toHaveBeenCalled();
    });
  });
});
