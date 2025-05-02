import pino, { Logger as PinoLogger } from 'pino';

/**
 * Singleton logger instance
 */
let instance: Logger | null = null;

/**
 * Logger class that wraps Pino logger
 */
export class Logger {
  private logger: PinoLogger;

  private constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  /**
   * Gets the singleton instance of the logger
   * @returns The logger instance
   */
  public static getInstance(): Logger {
    if (!instance) {
      instance = new Logger();
    }
    return instance;
  }

  /**
   * Logs an error message
   * @param message The error message
   * @param meta Additional metadata
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta || {}, message);
  }

  /**
   * Logs a warning message
   * @param message The warning message
   * @param meta Additional metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta || {}, message);
  }

  /**
   * Logs an info message
   * @param message The info message
   * @param meta Additional metadata
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta || {}, message);
  }

  /**
   * Logs a debug message
   * @param message The debug message
   * @param meta Additional metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta || {}, message);
  }
}
