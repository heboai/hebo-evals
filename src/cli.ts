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
import { AgentFactory } from './agents/factory/agent.factory.js';
import { getProviderBaseUrl } from './utils/provider-config.js';
import { ConfigLoader } from './config/config.loader.js';
import { EmbeddingSystemConfig } from './embeddings/config/embedding.config.js';
import { getProviderFromModel } from './utils/provider-mapping.js';
import { ProviderType } from './config/types/config.types.js';

/**
 * Main CLI entry point for Hebo Eval
 * @module cli
 */

export const program = new Command();

// Initialize configuration loader
const configLoader = ConfigLoader.getInstance();
if (!configLoader.isInitialized()) {
  configLoader.initialize();
}

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
  key?: string;
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
  .argument('<model>', 'The model to evaluate (e.g., gpt-4, hebo-*, claude-*)')
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
  .option('-k, --key <apiKey>', 'API key for authentication')
  .action(async (model: string, options: RunCommandOptions) => {
    let heboAgent: IAgent | undefined;
    let embeddingProvider: IEmbeddingProvider | undefined;
    try {
      // Configure logger verbosity
      Logger.configure({
        verbose: options.verbose,
      });

      // If a custom config path is provided, load it
      if (options.config) {
        configLoader.initialize(options.config);
      }

      // Determine provider from model name
      const { provider, modelName } = getProviderFromModel(model);

      // For custom providers, we need to get the provider name from the config
      let providerName: string = provider;
      if (provider === ProviderType.CUSTOM) {
        const config = configLoader.getConfig();
        const customProvider = Object.entries(config.providers || {}).find(
          ([_, config]) => config.provider === ProviderType.CUSTOM,
        );
        if (!customProvider) {
          throw new Error('No custom provider configuration found');
        }
        providerName = customProvider[0];
      }

      const baseUrl = getProviderBaseUrl(providerName);

      // Initialize agent using factory
      try {
        heboAgent = await AgentFactory.createAgent({
          model: modelName,
          baseUrl,
          provider: providerName,
          configPath: options.config,
        });

        // Initialize agent with configuration
        await heboAgent.initialize({
          model: modelName,
          provider: providerName,
        });

        // Get API key from command line options or configuration
        const apiKey =
          options.key || configLoader.getProviderApiKey(providerName);
        if (!apiKey) {
          throw new Error(
            `API key not found. Please provide it using --key or set it in the configuration file.`,
          );
        }

        // Authenticate agent
        await heboAgent.authenticate({ agentKey: apiKey });
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to initialize agent: ${error.message}`);
        }
        throw error;
      }

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
        Logger.info(
          `Running ${model} (${providerName}) with threshold ${threshold}`,
        );
      }

      // Initialize evaluation executor
      const executor = new EvaluationExecutor(scoringService, evaluationConfig);

      // Run evaluation
      await executor.evaluateFromDirectory(
        heboAgent,
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
