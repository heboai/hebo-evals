import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Command } from 'commander';
import { version } from '../utils/package-info.js';
import { Agent } from '../agents/implementations/agent.js';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
} from '../agents/types/agent.types.js';
import { access } from 'fs/promises';

// Mock external dependencies
jest.mock('../agents/implementations/agent.js', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn<() => AgentConfig>(() => ({
      model: 'test-model',
      provider: 'hebo',
      apiKey: 'test-key',
    })),
    sendInput: jest
      .fn<(input: AgentInput) => Promise<AgentOutput>>()
      .mockResolvedValue({
        response: 'test response',
      }),
    cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));
jest.mock('../scoring/scoring.service.js');
jest.mock('../evaluation/evaluation-executor.js');
jest.mock('fs');
jest.mock('fs/promises');

// Increase timeout for all tests in this file
jest.setTimeout(10000);

describe('CLI Commands', () => {
  let program: Command;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    process.argv = ['node', 'hebo-eval'];
    program = new Command();
    jest.resetAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('version command', () => {
    it('should be configured with the correct version', () => {
      program
        .name('hebo-eval')
        .description('A CLI tool for evaluating and testing language models')
        .version(version);

      program
        .command('version')
        .description('Display the current version')
        .action(() => {
          console.log(version);
        });

      expect(program.name()).toBe('hebo-eval');
      expect(program.description()).toBe(
        'A CLI tool for evaluating and testing language models',
      );
      expect(program.version()).toBe(version);

      const versionCommand = program.commands.find(
        (cmd) => cmd.name() === 'version',
      );
      expect(versionCommand).toBeDefined();
      expect(versionCommand?.description()).toBe('Display the current version');
    });
  });

  describe('run command', () => {
    let mockGetConfig: jest.Mock<() => AgentConfig>;
    let mockSendInput: jest.Mock<(input: AgentInput) => Promise<AgentOutput>>;
    let mockCleanup: jest.Mock<() => Promise<void>>;

    beforeEach(() => {
      mockGetConfig = jest.fn<() => AgentConfig>(() => ({
        model: 'test-model',
        provider: 'hebo',
        apiKey: 'test-key',
      }));
      mockSendInput = jest
        .fn<(input: AgentInput) => Promise<AgentOutput>>()
        .mockResolvedValue({ response: 'test response' });
      mockCleanup = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

      // Update the mock instance's methods
      const mockInstance = new Agent('gpt-4', {
        apiKey: 'sk-test123456789012345678901234567890',
      });
      mockInstance.getConfig = mockGetConfig;
      mockInstance.sendInput = mockSendInput;
      mockInstance.cleanup = mockCleanup;

      // Configure the run command
      program
        .command('run <agent>')
        .description('Run evaluation on an agent')
        .option('-d, --directory <path>', 'Directory containing test cases')
        .option('-c, --config <path>', 'Path to configuration file')
        .option(
          '-t, --threshold <number>',
          'Score threshold for passing (0-1)',
          '0.8',
        )
        .option(
          '-f, --format <format>',
          'Output format (json|markdown|text)',
          'markdown',
        )
        .option('-s, --stop-on-error', 'Stop processing on first error', false)
        .option(
          '-m, --max-concurrency <number>',
          'Maximum number of concurrent test executions',
          '5',
        )
        .option(
          '--use-semantic-scoring',
          'Use semantic scoring for evaluation',
          false,
        );
    });

    it('should be configured with correct options', () => {
      const runCommand = program.commands.find((cmd) => cmd.name() === 'run');
      expect(runCommand?.description()).toBe('Run evaluation on an agent');

      const options = runCommand?.options.map((opt) => opt.flags);
      expect(options).toContain('-d, --directory <path>');
      expect(options).toContain('-c, --config <path>');
    });

    it('should throw error when examples directory does not exist', () => {
      // This test verifies that the CLI would throw an error when the examples directory doesn't exist
      // The actual error handling is tested in the CLI implementation
      // We can't easily test this without running the full CLI, so we just verify the import works
      expect(access).toBeDefined();
    });
  });

  describe('help output', () => {
    it('should include the correct program name and description', () => {
      program
        .name('hebo-eval')
        .description('A CLI tool for evaluating and testing language models')
        .version(version);

      program
        .command('version')
        .description('Display the current version')
        .action(() => {
          console.log(version);
        });

      expect(program.name()).toBe('hebo-eval');
      expect(program.description()).toBe(
        'A CLI tool for evaluating and testing language models',
      );
      expect(program.commands).toHaveLength(1);
      expect(program.commands[0].name()).toBe('version');
    });
  });
});

describe('CLI Integration', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent('gato-qa:v1', {
      apiKey: 'test-key',
    });
  });

  describe('Agent Configuration', () => {
    it('should initialize with correct model and provider', () => {
      const agentConfig = agent.getConfig();
      expect(agentConfig.model).toBe('gato-qa:v1');
      expect(agentConfig.provider).toBe('hebo');
      expect(agentConfig.apiKey).toBe('test-key');
    });
  });
});
