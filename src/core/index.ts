/**
 * Core functionality for Hebo Eval
 * @module core
 */

// Import package.json using URL import
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

interface PackageJson {
  version: string;
  name: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
) as PackageJson;

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
    return packageJson.version;
  }
}
