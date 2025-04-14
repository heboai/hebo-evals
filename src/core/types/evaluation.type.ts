/**
 * Represents a message in the evaluation system
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Represents the result of a single test case evaluation
 */
export interface EvaluationResult {
  testCaseId: string;
  inputMessages: Message[];
  expectedOutput: Message;
  observedOutput: Message;
  score: number;
  passed: boolean;
  error?: string;
}

/**
 * Represents the available scoring methods
 */
export type ScoringMethod = 'semantic-similarity' | 'exact-match';

/**
 * Configuration for the scoring service
 */
export interface ScoringConfig {
  method: ScoringMethod;
  threshold: number;
  caseSensitive?: boolean; // Only used for exact-match
}

/**
 * Represents a complete evaluation report
 */
export interface EvaluationReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
  };
  results: EvaluationResult[];
  metadata: {
    timestamp: string;
    threshold: number;
    scoringMethod: ScoringMethod;
    scoringConfig: ScoringConfig;
  };
}
