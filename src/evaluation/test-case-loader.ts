import { readFile } from 'fs/promises';
import { join } from 'path';
import { BaseMessage, MessageRole } from '../core/types/message.types';
import { TestCase } from './evaluation-executor';

export class TestCaseLoader {
  /**
   * Loads test cases from a file
   */
  public async loadFromFile(filePath: string): Promise<TestCase> {
    const content = await readFile(filePath, 'utf-8');
    const messages: BaseMessage[] = [];
    const lines = content.split('\n').filter((line) => line.trim() !== '');

    for (let i = 0; i < lines.length; i += 2) {
      const roleStr = lines[i].split(':')[0].trim();
      const content = lines[i].split(':').slice(1).join(':').trim();
      messages.push({ role: roleStr as MessageRole, content });

      // If there's a next line and it starts with 'tool', add it and its response
      if (i + 1 < lines.length && lines[i + 1].startsWith('tool')) {
        messages.push({
          role: MessageRole.TOOL,
          content: lines[i + 1].trim(),
        });
        // Skip the tool response line as it's part of the tool message
        i++;
      }
    }

    // The last message is the expected output
    const expectedOutput = messages.pop()!;

    return {
      messages,
      expectedOutput,
    };
  }

  /**
   * Loads all test cases from the examples directory
   */
  public async loadFromExamplesDir(examplesDir: string): Promise<TestCase[]> {
    const testCases: TestCase[] = [];
    const files = await this.getExampleFiles(examplesDir);

    for (const file of files) {
      try {
        const testCase = await this.loadFromFile(join(examplesDir, file));
        testCases.push(testCase);
      } catch (error) {
        console.error(`Error loading test case from ${file}:`, error);
      }
    }

    return testCases;
  }

  /**
   * Gets a list of example files from the examples directory
   */
  private async getExampleFiles(examplesDir: string): Promise<string[]> {
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(examplesDir);
      return files.filter((file) => file.endsWith('.txt'));
    } catch (error) {
      console.error('Error reading examples directory:', error);
      return [];
    }
  }
}
