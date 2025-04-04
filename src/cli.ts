#!/usr/bin/env node

import { Command } from 'commander';
import { version } from './utils/package-info.js';

/**
 * Main CLI entry point for Hebo Eval
 * @module cli
 */

const program = new Command();

/**
 * Creates and configures the CLI program
 * @returns Configured Commander program
 */
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

program.parse();
