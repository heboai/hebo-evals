import { ReportGenerator } from '../core/services/report-generator.js';
import {
  EvaluationResult,
  Message,
  ScoringMethod,
  ScoringConfig,
} from '../core/types/evaluation.type.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ScoringService } from '../core/services/scoring-service.js';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

interface GenerateReportOptions {
  scoringMethod?: ScoringMethod;
  threshold?: number;
  caseSensitive?: boolean;
  openAIApiKey?: string;
}

/**
 * Parses a message from the example file format
 */
function parseMessage(line: string): Message | null {
  const [role, ...contentParts] = line.split(': ');
  if (!role || !contentParts.length) return null;

  return {
    role: role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: contentParts.join(': '),
  };
}

/**
 * Reads and parses an example file
 */
async function parseExampleFile(filePath: string): Promise<{
  inputMessages: Message[];
  expectedOutput: Message;
  observedOutput: Message;
}> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  const messages: Message[] = [];
  const assistantMessages: Message[] = [];

  for (const line of lines) {
    const message = parseMessage(line);
    if (!message) continue;

    if (message.role === 'user') {
      messages.push(message);
    } else if (message.role === 'assistant') {
      assistantMessages.push(message);
    }
  }

  if (assistantMessages.length < 2) {
    throw new Error(
      `File ${filePath} must contain at least two assistant messages`,
    );
  }

  // The last assistant message is the final response
  const observedOutput = assistantMessages[assistantMessages.length - 2];
  const expectedOutput = assistantMessages[assistantMessages.length - 1];

  return {
    inputMessages: messages,
    expectedOutput,
    observedOutput,
  };
}

/**
 * Generates an evaluation report with the specified scoring configuration
 * @param options Configuration options for report generation
 * @returns A promise that resolves when the report is generated
 */
async function generateReport(
  options: GenerateReportOptions = {},
): Promise<void> {
  const {
    scoringMethod = 'semantic-similarity',
    threshold = 0.98,
    caseSensitive = false,
    openAIApiKey = process.env.OPENAI_API_KEY,
  } = options;

  const scoringConfig: ScoringConfig = {
    method: scoringMethod,
    threshold,
    caseSensitive,
  };

  // Initialize scoring service based on method
  let scoringService: ScoringService;
  if (scoringMethod === 'semantic-similarity') {
    if (!openAIApiKey) {
      throw new Error(
        'OpenAI API key is required for semantic similarity scoring',
      );
    }

    console.log('Initializing OpenAI embeddings model...');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openAIApiKey,
      modelName: 'text-embedding-3-small',
    });

    // Test the embeddings model
    console.log('Testing embeddings model...');
    try {
      await embeddings.embedQuery('test');
      console.log('Embeddings model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize embeddings model:', error);
      process.exit(1);
    }

    scoringService = new ScoringService(scoringConfig, embeddings);
  } else {
    scoringService = new ScoringService(scoringConfig);
  }

  // Read all example files
  const examplesDir = join(process.cwd(), 'examples');
  const files = await readdir(examplesDir);
  const txtFiles = files.filter((file) => file.endsWith('.txt'));

  // Process each example file
  const results: EvaluationResult[] = [];

  for (const file of txtFiles) {
    try {
      const filePath = join(examplesDir, file);
      const { inputMessages, expectedOutput, observedOutput } =
        await parseExampleFile(filePath);

      // Calculate the score
      const score = await scoringService.score(observedOutput, expectedOutput);

      results.push({
        testCaseId: file.replace('.txt', ''),
        inputMessages,
        expectedOutput,
        observedOutput,
        score,
        passed: scoringService.isPassing(score),
      });
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  // Initialize the report generator
  const reportGenerator = new ReportGenerator({ threshold });

  // Generate the report
  const report = reportGenerator.generateReport(results);

  // Format and output the report in different formats
  console.log('\n=== JSON Format ===\n');
  console.log(reportGenerator.formatReport(report, 'json'));

  console.log('\n=== Markdown Format ===\n');
  console.log(reportGenerator.formatReport(report, 'markdown'));

  console.log('\n=== Text Format ===\n');
  console.log(reportGenerator.formatReport(report, 'text'));
}

// When running directly as a script
if (import.meta.url === import.meta.resolve('./generate-report.ts')) {
  try {
    const [
      ,
      ,
      method = 'semantic-similarity',
      thresholdStr = '0.98',
      caseSensitiveStr = 'false',
    ] = process.argv;

    console.log('Starting report generation with:', {
      method,
      thresholdStr,
      caseSensitiveStr,
    });

    const threshold = parseFloat(thresholdStr);
    const caseSensitive = caseSensitiveStr.toLowerCase() === 'true';

    generateReport({
      scoringMethod: method as ScoringMethod,
      threshold,
      caseSensitive,
      openAIApiKey: process.env.OPENAI_API_KEY,
    }).catch((error) => {
      console.error('Failed to generate report:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to generate report:', error);
    process.exit(1);
  }
}

export { generateReport };
