#!/usr/bin/env node

import { Command } from 'commander';
import { version } from './utils/package-info.js';
import { ScoringService } from './scoring/scoring.service.js';
import { EvaluationExecutor } from './evaluation/evaluation-executor.js';
import { EvaluationConfig } from './evaluation/types/evaluation.types.js';
import { Logger } from './utils/logger.js';
import { EmbeddingProviderFactory } from './embeddings/factory/embedding-provider.factory.js';
import { EmbeddingConfig } from './embeddings/types/embedding.types.js';
import { join } from 'path';
import { IEmbeddingProvider } from './embeddings/interfaces/embedding-provider.interface.js';
import { IAgent } from './agents/interfaces/agent.interface.js';
import { Agent } from './agents/implementations/agent.js';
import { getProviderBaseUrl } from './config/utils/provider-config.js';
import { ConfigLoader } from './config/config.loader.js';

/**
 * Main CLI entry point for Hebo Eval
 * @module cli
 */

export const program = new Command();

/**
 * Interface for run command options
 */
interface RunCommandOptions {
  directory?: string;
  config?: string;
  threshold: string;
  format: string;
  stopOnError: boolean;
  maxConcurrency: string;
  verbose: boolean;
  provider?: string;
}

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

program
  .command('run')
  .description('Run an evaluation')
  .argument(
    '<model>',
    'The model to evaluate (e.g., gpt-*, claude-*, gato-qa:v1)',
  )
  .option('-c, --config <path>', 'Path to configuration file')
  .option(
    '-t, --threshold <number>',
    'Score threshold for passing (0-1)',
    '0.8',
  )
  .option('-f, --format <format>', 'Output format (json|markdown|text)', 'text')
  .option('-s, --stop-on-error', 'Stop processing on first error', false)
  .option(
    '-m, --max-concurrency <number>',
    'Maximum number of concurrent test executions',
    '5',
  )
  .option(
    '-v, --verbose',
    'Show verbose output including test results and provider information',
    false,
  )
  .action(async (model: string, options: RunCommandOptions) => {
    let agent: IAgent | undefined;
    let embeddingProvider: IEmbeddingProvider | undefined;
    try {
      // Initialize configuration loader
      const configLoader = ConfigLoader.getInstance();
      if (!configLoader.isInitialized()) {
        configLoader.initialize();
      }

      // Configure logger verbosity
      Logger.configure({
        verbose: options.verbose,
      });

      // If a custom config path is provided, load it
      if (options.config) {
        configLoader.initialize(options.config);
      }

      // Create agent - API key will be loaded from configuration
      agent = new Agent(model, {
        configPath: options.config,
      });

      // Get configuration from loader
      const config = configLoader.getConfig();
      const embeddingConfig = config.embedding;

      if (!embeddingConfig) {
        throw new Error(
          'Configuration error: Embedding configuration is required',
        );
      }

      // Initialize embedding provider
      try {
        const providerConfig: EmbeddingConfig = {
          provider: embeddingConfig.provider,
          model: embeddingConfig.model,
          baseUrl:
            embeddingConfig.baseUrl ||
            getProviderBaseUrl(embeddingConfig.provider),
          apiKey: embeddingConfig.apiKey || '',
        };

        embeddingProvider =
          EmbeddingProviderFactory.createProvider(providerConfig);
        await embeddingProvider.initialize(providerConfig);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Configuration error: Failed to initialize embedding provider: ${errorMessage}\n\nPlease check:\n1. Your embedding API key is correct\n2. The provider (${embeddingConfig.provider}) matches your API key\n3. The base URL is correct for your provider`,
        );
      }

      // Initialize scoring service
      const scoringService = new ScoringService(embeddingProvider);

      // Parse threshold
      const threshold = parseFloat(options.threshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        throw new Error(
          'Configuration error: `--threshold` must be a number between 0 and 1',
        );
      }

      // Parse max concurrency
      const maxConcurrency = parseInt(options.maxConcurrency, 10);
      if (isNaN(maxConcurrency) || maxConcurrency < 1) {
        throw new Error(
          'Configuration error: `--max-concurrency` must be a positive number',
        );
      }

      // Create evaluation config
      const evaluationConfig: EvaluationConfig = {
        threshold,
        outputFormat: options.format as 'json' | 'markdown' | 'text',
        maxConcurrency,
      };

      if (options.verbose) {
        const agentConfig = agent.getConfig();
        Logger.info(
          `Running ${agentConfig.model} (${agentConfig.provider}) with threshold ${threshold}`,
        );
      }

      // Initialize evaluation executor
      const executor = new EvaluationExecutor(scoringService, evaluationConfig);

      // Run evaluation
      await executor.evaluateFromDirectory(
        agent,
        join(process.cwd(), options.directory ?? 'examples'),
        options.stopOnError,
      );

      Logger.info('Evaluation completed');
    } catch (error) {
      Logger.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

/**
 * Run the CLI - only called when this module is run directly
 */
export const run = () => {
  program.parse();
};

run();
