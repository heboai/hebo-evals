/**
 * Box drawing characters for consistent styling
 */
const BOX = {
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  SPACE: ' ',
};

/**
 * Icons for different message types
 */
const ICONS = {
  error: '❌',
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  debug: '🔍',
};

/**
 * Colors for different message types
 */
const COLORS = {
  error: '\x1b[31m', // Red
  success: '\x1b[32m', // Green
  info: '\x1b[36m', // Cyan
  warning: '\x1b[33m', // Yellow
  debug: '\x1b[35m', // Magenta
  reset: '\x1b[0m', // Reset
};

/**
 * Message types for different styles
 */
type MessageType = 'error' | 'success' | 'info' | 'warning' | 'debug';

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

  /**
   * Creates a boxed message with consistent styling
   * @param content The message content
   * @param type The type of message
   * @returns The formatted message
   */
  private static formatMessage(content: string, type: MessageType): string {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map((line) => line.length));
    const padding = 2;
    const width = maxLength + padding * 2;

    const top = `${BOX.TOP_LEFT}${BOX.HORIZONTAL.repeat(width)}${BOX.TOP_RIGHT}`;
    const bottom = `${BOX.BOTTOM_LEFT}${BOX.HORIZONTAL.repeat(width)}${BOX.BOTTOM_RIGHT}`;

    const formattedLines = lines.map((line) => {
      const paddedLine = line.padEnd(maxLength);
      return `${BOX.VERTICAL}${BOX.SPACE.repeat(padding)}${paddedLine}${BOX.SPACE.repeat(padding)}${BOX.VERTICAL}`;
    });
    
    // Add a separator between lines for better readability
    const separator = `${BOX.VERTICAL}${BOX.HORIZONTAL.repeat(width)}${BOX.VERTICAL}`;
    
    return [
      '',
      `${color}${icon} ${type.charAt(0).toUpperCase() + type.slice(1)}${reset}`,
      top,
      ...formattedLines.flatMap((line, index) => index < formattedLines.length - 1 ? [line, separator] : [line]),
      bottom,
      '',
    ].join('\n');
  }

  /**
   * Logs an info message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  static info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage(message, 'info'));
    if (meta) {
      console.log(JSON.stringify(meta, null, 2));
    }
  }

  /**
   * Logs a success message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  static success(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage(message, 'success'));
    if (meta) {
      console.log(JSON.stringify(meta, null, 2));
    }
  }

  /**
   * Logs a warning message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  static warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage(message, 'warning'));
    if (meta) {
      console.warn(JSON.stringify(meta, null, 2));
    }
  }

  /**
   * Logs an error message
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  static error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage(message, 'error'));
    if (meta) {
      console.error(JSON.stringify(meta, null, 2));
    }
  }

  /**
   * Logs a debug message (only shown when DEBUG environment variable is set)
   * @param message The message to log
   * @param meta Optional metadata to include
   */
  static debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.debug(this.formatMessage(message, 'debug'));
      if (meta) {
        console.debug(JSON.stringify(meta, null, 2));
      }
    }
  }
}
