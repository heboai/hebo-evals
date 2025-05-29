import { jest } from '@jest/globals';
import { Command } from 'commander';
import { version } from '../utils/package-info.js';
import { HeboAgent } from '../agents/implementations/hebo-agent.js';
import { AgentAuthConfig } from '../agents/index.js';

// Mock external dependencies
jest.mock('../agents/implementations/hebo-agent.js', () => ({
  HeboAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    authenticate: jest
      .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
      .mockResolvedValue(undefined),
    cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));
jest.mock('../scoring/scoring.service.js');
jest.mock('../evaluation/evaluation-executor.js');
jest.mock('fs');

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
    let mockInitialize: jest.Mock<() => Promise<void>>;
    let mockAuthenticate: jest.Mock<
      (authConfig: AgentAuthConfig) => Promise<void>
    >;
    let mockCleanup: jest.Mock<() => Promise<void>>;

    beforeEach(() => {
      mockInitialize = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      mockAuthenticate = jest
        .fn<(authConfig: AgentAuthConfig) => Promise<void>>()
        .mockResolvedValue(undefined);
      mockCleanup = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

      // Update the mock instance's methods
      const mockInstance = new HeboAgent({
        model: 'test-model',
        provider: 'hebo',
      });
      mockInstance.initialize = mockInitialize;
      mockInstance.authenticate = mockAuthenticate;
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
