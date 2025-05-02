import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { BaseMessage, MessageRole } from '../core/types/message.types';
import { TestCase } from './types/evaluation.types';
import { Logger } from '../utils/logger';

export class TestCaseLoader {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Loads test cases from a file
   */
  public async loadFromFile(filePath: string): Promise<TestCase> {
    try {
      this.logger.info('Loading test case from file', { filePath });
      const content = await readFile(filePath, 'utf-8');
      const messages: BaseMessage[] = [];
      const lines = content.split('\n').filter((line) => line.trim() !== '');

      if (lines.length < 2) {
        throw new Error('Test case file must contain at least two messages');
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const [roleStr, ...contentParts] = line.split(':');
        const content = contentParts.join(':').trim();

        if (!Object.values(MessageRole).includes(roleStr as MessageRole)) {
          throw new Error(`Invalid message role: ${roleStr}`);
        }

        messages.push({ role: roleStr as MessageRole, content });
      }

      // The last message is the expected output
      const expectedOutput = messages.pop()!;

      this.logger.info('Successfully loaded test case', {
        messageCount: messages.length,
        expectedOutput: expectedOutput.content,
      });

      return {
        messages,
        expectedOutput,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Failed to load test case from file', {
        filePath,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Loads all test cases from the examples directory
   */
  public async loadFromExamplesDir(examplesDir: string): Promise<TestCase[]> {
    try {
      this.logger.info('Loading test cases from directory', { examplesDir });
      const testCases: TestCase[] = [];
      const files = await this.getExampleFiles(examplesDir);

      if (files.length === 0) {
        this.logger.warn('No test case files found in directory', {
          examplesDir,
        });
        return [];
      }

      for (const file of files) {
        try {
          const testCase = await this.loadFromFile(join(examplesDir, file));
          testCases.push(testCase);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';
          this.logger.error('Failed to load test case', {
            file,
            error: errorMessage,
          });
          // Continue with other files even if one fails
        }
      }

      this.logger.info('Successfully loaded test cases', {
        totalTestCases: testCases.length,
        directory: examplesDir,
      });

      return testCases;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Failed to load test cases from directory', {
        examplesDir,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Gets a list of example files from the examples directory
   */
  private async getExampleFiles(examplesDir: string): Promise<string[]> {
    try {
      const files = await readdir(examplesDir);
      return files.filter((file) => file.endsWith('.txt'));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Failed to read examples directory', {
        examplesDir,
        error: errorMessage,
      });
      return [];
    }
  }
}
