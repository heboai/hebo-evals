import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogMeta {
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logger: WinstonLogger;

  private constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || LogLevel.INFO,
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.errors({ stack: true }),
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple(),
          ),
        }),
      ],
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public error(message: string, meta?: LogMeta): void {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, meta);
  }

  public info(message: string, meta?: LogMeta): void {
    this.logger.info(message, meta);
  }

  public debug(message: string, meta?: LogMeta): void {
    this.logger.debug(message, meta);
  }
} 