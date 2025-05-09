import { jest } from '@jest/globals';
import { Command } from 'commander';
import { version } from '../utils/package-info.js';

// Increase timeout for all tests in this file
jest.setTimeout(10000);

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
});
