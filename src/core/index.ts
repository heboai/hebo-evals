/**
 * Core functionality for Hebo Eval
 * @module core
 */

/**
 * Represents the core functionality of Hebo Eval
 */
export class HeboEval {
  /**
   * Creates a new instance of HeboEval
   */
  constructor() {}

  /**
   * Gets the current version of Hebo Eval
   * @returns The version string
   */
  public getVersion(): string {
    return require('../../package.json').version;
  }
}
