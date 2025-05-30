#!/usr/bin/env node

import { Command } from 'commander';
import { version } from './utils/package-info.js';
import { ScoringService } from './scoring/scoring.service.js';
import { EvaluationExecutor } from './evaluation/evaluation-executor.js';
import { EvaluationConfig } from './evaluation/types/evaluation.types.js';
import { Logger } from './utils/logger.js';
import { EmbeddingProviderFactory } from './embeddings/config/embedding.config.js';
import { readFileSync } from 'fs';
import { EmbeddingConfig } from './embeddings/types/embedding.types.js';
import { join } from 'path';
import { IEmbeddingProvider } from './embeddings/interfaces/embedding-provider.interface.js';
import { IAgent } from './agents/interfaces/agent.interface.js';
import { createAgent } from './agents/factory/agent.factory.js';
import { getProviderBaseUrl } from './utils/provider-config.js';

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
}

/**
 * Interface for cli config
 */
interface CliConfig {
  embedding: EmbeddingConfig;
  agent: {
    agentKey: string;
    provider: string;
  };
}

/**
 * Loads configuration from a file
 * @param configPath Path to the configuration file
 * @returns The loaded configuration
 */
function loadConfig(configPath: string): CliConfig {
  try {
    const resolvedPath = join(process.cwd(), configPath);
    const configContent = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(configContent) as CliConfig;
    return parsed;
  } catch (error: unknown) {
    const errorMessage = `Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(errorMessage);
    throw new Error(errorMessage);
  }
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
  .command('run <agent>')
  .description('Run evaluation on an agent')
  .option('-d, --directory <path>', 'Directory containing test cases')
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
  .action(async (agent: string, options: RunCommandOptions) => {
    let heboAgent: IAgent | undefined;
    let embeddingProvider: IEmbeddingProvider | undefined;
    try {
      // Configure logger verbosity
      Logger.configure({
        verbose: options.verbose,
      });

      // Load configuration from file, environment, or defaults
      let config;
      if (options.config) {
        config = loadConfig(options.config);

        // Validate agent configuration
        if (!config.agent?.agentKey) {
          throw new Error(
            'Configuration error: Agent API key is required in config file',
          );
        }

        // Validate embedding configuration
        if (!config.embedding?.provider) {
          throw new Error(
            'Configuration error: Embedding provider is required in config file',
          );
        }
        if (!config.embedding?.apiKey) {
          throw new Error(
            'Configuration error: Embedding API key is required in config file',
          );
        }
        if (!config.embedding?.model) {
          throw new Error(
            'Configuration error: Embedding model is required in config file',
          );
        }
      } else {
        // Load from environment variables
        config = {
          embedding: EmbeddingProviderFactory.loadFromEnv(),
          agent: {
            agentKey: process.env.HEBO_AGENT_API_KEY,
            provider: process.env.HEBO_AGENT_PROVIDER || 'hebo', // Default to hebo if not specified
          },
        };

        //Validate embedding configuration
        if (!config.embedding || Object.keys(config.embedding).length === 0) {
          Logger.warn(
            'Configuration warning: No embedding configuration found in environment variables',
          );
        }
      }
      // Validate required configuration
      if (
        !config.agent ||
        !('agentKey' in config.agent) ||
        !config.agent.agentKey
      ) {
        throw new Error(
          'Configuration error: HEBO_AGENT_API_KEY or HEBO_API_KEY environment variable or config file is required',
        );
      }

      // Initialize agent using factory
      try {
        heboAgent = createAgent({
          model: agent,
          baseUrl: getProviderBaseUrl(config.agent.provider),
          provider: config.agent.provider,
        });

        // Validate agent initialization
        await heboAgent.initialize({
          model: agent,
          provider: config.agent.provider,
        });
        await heboAgent.authenticate({ agentKey: config.agent.agentKey });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Configuration error')
        ) {
          throw new Error(error.message);
        }
        throw new Error(
          `Failed to initialize agent: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Initialize scoring service with embedding provider
      let embeddingSystemConfig;
      if ('defaultProvider' in config.embedding) {
        // Already an EmbeddingSystemConfig
        embeddingSystemConfig = config.embedding;
      } else if ('provider' in config.embedding) {
        // Convert EmbeddingConfig to EmbeddingSystemConfig
        embeddingSystemConfig = {
          defaultProvider: config.embedding.provider,
          model: config.embedding.model,
          baseUrl: config.embedding.baseUrl,
          apiKey: config.embedding.apiKey,
        };
      } else {
        throw new Error(
          'Configuration error: Invalid embedding configuration: missing provider information',
        );
      }

      // Validate embedding provider initialization
      try {
        embeddingProvider = EmbeddingProviderFactory.createProvider(
          embeddingSystemConfig,
        );
        await embeddingProvider.initialize({
          provider: embeddingSystemConfig.defaultProvider,
          model: embeddingSystemConfig.model,
          baseUrl: embeddingSystemConfig.baseUrl,
          apiKey: embeddingSystemConfig.apiKey,
        });

        // Test embedding provider with a simple request
        try {
          await embeddingProvider.generateEmbedding('test');
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('401')) {
            throw new Error(
              `Configuration error: Failed to authenticate embedding provider: ${errorMessage}\n\nPlease check:\n1. Your embedding API key is correct and has not expired\n2. The provider (${embeddingSystemConfig.defaultProvider}) matches your API key\n3. The base URL (${embeddingSystemConfig.baseUrl}) is correct for your provider`,
            );
          }
          throw new Error(
            `Configuration error: Failed to authenticate embedding provider: ${errorMessage}`,
          );
        }
      } catch (error) {
        throw new Error(
          `Configuration error: Failed to initialize embedding provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Create scoring service only after both services are initialized
      const scoringService = new ScoringService(embeddingProvider);

      // Validate evaluation configuration
      const threshold = Number(options.threshold);
      const maxConcurrency = Number(options.maxConcurrency);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        throw new Error(
          'Configuration error: `--threshold` must be a number between 0 and 1',
        );
      }
      if (!Number.isInteger(maxConcurrency) || maxConcurrency <= 0) {
        throw new Error(
          'Configuration error: `--max-concurrency` must be a positive integer',
        );
      }
      const evalConfig: EvaluationConfig = {
        threshold,
        outputFormat: options.format as 'json' | 'markdown' | 'text',
        maxConcurrency,
      };

      // Only show configuration in verbose mode
      if (options.verbose) {
        Logger.info(
          `Running ${agent} (${config.agent.provider}) with threshold ${options.threshold}`,
        );
      }

      // Create and run evaluation
      const executor = new EvaluationExecutor(scoringService, evalConfig);
      await executor.evaluateFromDirectory(
        heboAgent,
        options.directory || join(process.cwd(), 'examples'),
        options.stopOnError || false,
      );

      Logger.info('Evaluation completed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(errorMessage);
      process.exit(1);
    } finally {
      // Always attempt to free resources
      await Promise.allSettled([
        heboAgent?.cleanup?.(),
        embeddingProvider?.cleanup?.(),
      ]);
    }
  });

/**
 * Run the CLI - only called when this module is run directly
 */
export const run = () => {
  program.parse();
};

run();
