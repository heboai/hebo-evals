/**
 * Represents a fuzzy match assertion that specifies expected content with a threshold
 */
export interface FuzzyMatchAssertion {
  /** The expected text to match */
  expectedText: string;
  /** The threshold score (0-1) that must be met */
  threshold: number;
  /** Optional description for debugging */
  description?: string;
}

/**
 * Represents the result of evaluating a fuzzy match assertion
 */
export interface FuzzyMatchResult {
  /** The assertion that was tested */
  assertion: FuzzyMatchAssertion;
  /** Whether the assertion passed */
  passed: boolean;
  /** The best matching chunk found */
  bestMatch: string;
  /** Individual ROUGE scores */
  rougeScores: {
    rouge1: number;
    rouge2: number;
    rougeL: number;
  };
  /** Final averaged score */
  finalScore: number;
  /** Position of the best match in the response */
  matchPosition: {
    start: number;
    end: number;
  };
}
