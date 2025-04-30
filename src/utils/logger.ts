import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';

/**
 * Singleton logger instance
 */
let instance: Logger | null = null;

/**
 * Logger class that wraps Winston logger
 */
export class Logger {
  private logger: WinstonLogger;

  private constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.simple(),
      ),
      transports: [new transports.Console()],
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
    this.logger.error(message, meta);
  }

  /**
   * Logs a warning message
   * @param message The warning message
   * @param meta Additional metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Logs an info message
   * @param message The info message
   * @param meta Additional metadata
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Logs a debug message
   * @param message The debug message
   * @param meta Additional metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }
}
