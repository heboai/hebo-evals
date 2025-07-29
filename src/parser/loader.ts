import { readFile, readdir } from 'fs/promises';
import { join, extname, basename, relative, dirname } from 'path';
import { Parser } from './parser.js';
import { TestCase } from '../core/types/message.types.js';

/**
 * Result of loading test cases
 */
export interface LoadResult {
  /**
   * Successfully loaded test cases
   */
  testCases: TestCase[];

  /**
   * Errors encountered during loading
   */
  errors: {
    /**
     * The file path where the error occurred
     */
    filePath: string;

    /**
     * The error message
     */
    message: string;
  }[];
}

/**
 * Loader for test case files
 */
export class TestCaseLoader {
  private parser: Parser;
  private rootDirectory: string;

  constructor(rootDirectory: string = process.cwd()) {
    this.parser = new Parser();
    this.rootDirectory = rootDirectory;
  }

  /**
   * Loads test cases from a directory
   * @param directoryPath The path to the directory containing test case files
   * @param stopOnError Whether to stop processing files after the first error (default: true)
   * @returns Promise that resolves with the load result
   */
  public async loadFromDirectory(
    directoryPath: string,
    stopOnError: boolean = true,
  ): Promise<LoadResult> {
    const result: LoadResult = {
      testCases: [],
      errors: [],
    };

    try {
      const files = await this.getTestFiles(directoryPath);

      for (const file of files) {
        try {
          const testCases = await this.loadFile(file);
          result.testCases.push(...testCases);
        } catch (error) {
          result.errors.push({
            filePath: file,
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
          });
          if (stopOnError) {
            return result;
          }
          // Continue processing remaining files if stopOnError is false
        }
      }
    } catch (error) {
      // If we can't read the directory, add it as an error
      result.errors.push({
        filePath: directoryPath,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }

    return result;
  }

  /**
   * Gets all test files from a directory recursively
   * @param directoryPath The path to the directory
   * @returns Promise that resolves with an array of file paths
   * @throws Error if the directory cannot be read
   */
  private async getTestFiles(directoryPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const entries = await readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getTestFiles(fullPath);
          files.push(...subFiles);
        } else if (
          entry.isFile() &&
          (extname(entry.name) === '.txt' || extname(entry.name) === '.md')
        ) {
          files.push(fullPath);
        }
      }

      return files;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Cannot read directory: ${directoryPath}. ${errorMessage}`,
      );
    }
  }

  /**
   * Loads test cases from a single file
   * @param filePath The path to the test case file
   * @returns Promise that resolves with an array of parsed test cases
   */
  public async loadFile(filePath: string): Promise<TestCase[]> {
    const content = await readFile(filePath, 'utf-8');
    const { baseName, hierarchicalId } = this.getTestCaseInfo(filePath);
    // If the file contains a '# ' header, treat as multiple test cases; otherwise, treat as a single test case with the filename as the name
    if (/^# /m.test(content)) {
      return this.parser.parseMultiple(content, baseName, hierarchicalId);
    } else {
      // Single test case: use the filename as the name
      return [this.parser.parse(content, baseName, hierarchicalId)];
    }
  }

  /**
   * Gets the test case name and hierarchical ID from a file path
   * @param filePath The path to the test case file
   * @returns Object containing the base name and hierarchical ID
   */
  private getTestCaseInfo(filePath: string): {
    baseName: string;
    hierarchicalId: string;
  } {
    const ext = extname(filePath);
    const baseName = basename(filePath, ext);
    const relativePath = relative(this.rootDirectory, dirname(filePath));
    const hierarchicalId = relativePath
      ? `${relativePath}/${baseName}`
      : baseName;
    return { baseName, hierarchicalId };
  }
}
