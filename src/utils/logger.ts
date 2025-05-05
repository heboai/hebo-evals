/**
 * Simple logger utility for CLI output
 */
export class Logger {
  private static instance: Logger | null = null;

  private constructor() {}

  public static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }
    return this.instance;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR:', message);
    if (meta) console.error(meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn('\x1b[33m%s\x1b[0m', 'WARN:', message);
    if (meta) console.warn(meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info('\x1b[36m%s\x1b[0m', 'INFO:', message);
    if (meta) console.info(meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.debug('\x1b[35m%s\x1b[0m', 'DEBUG:', message);
      if (meta) console.debug(meta);
    }
  }
}
