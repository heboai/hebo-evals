#!/usr/bin/env node

import { Command } from 'commander';
import { version } from '../package.json';

/**
 * Main CLI entry point for Hebo Eval
 * @module cli
 */

const program = new Command();

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
