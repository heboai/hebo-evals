import { computeRouge } from '../rouge/rouge-calculator.js';
import { isNumberMatch } from '../utils/text-processing.js';
import {
  FuzzyMatchAssertion,
  FuzzyMatchResult,
} from '../../evaluation/types/fuzzy-match.types.js';

/**
 * Service for evaluating fuzzy match assertions against actual responses
 */
export class FuzzyMatchScoringService {
  /** Maximum allowed window size to prevent excessive computation */
  private static readonly MAX_WINDOW_SIZE_CAP = 10;

  /**
   * Evaluates fuzzy match assertions against an actual response
   * @param assertions Array of fuzzy match assertions
   * @param actualResponse The actual response from the agent
   * @returns Array of fuzzy match results
   */
  evaluateAssertions(
    assertions: FuzzyMatchAssertion[],
    actualResponse: string,
  ): FuzzyMatchResult[] {
    return assertions.map((assertion) =>
      this.evaluateSingleAssertion(assertion, actualResponse),
    );
  }

  /**
   * Evaluates a single fuzzy match assertion using sliding window approach
   * @param assertion The assertion to evaluate
   * @param actualResponse The actual response
   * @returns Fuzzy match result
   */
  private evaluateSingleAssertion(
    assertion: FuzzyMatchAssertion,
    actualResponse: string,
  ): FuzzyMatchResult {
    const tokens = actualResponse.split(/\s+/);
    let bestScore = 0;
    let bestMatch = '';
    let bestPosition = { start: 0, end: 0 };
    let bestRougeScores = { rouge1: 0, rouge2: 0, rougeL: 0 };

    // Try different window sizes to find the best match
    const expectedTokens = assertion.expectedText.split(/\s+/);
    const maxWindowSize = Math.min(
      tokens.length,
      Math.min(
        expectedTokens.length * 3,
        FuzzyMatchScoringService.MAX_WINDOW_SIZE_CAP,
      ),
    );

    // Special case: if expected text is a single token, try to find it directly
    if (expectedTokens.length === 1) {
      const expectedToken = expectedTokens[0].toLowerCase();
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].toLowerCase().replace(/[.,!?;:()\[\]"]/g, '');
        if (token === expectedToken) {
          // Exact match found
          bestScore = 1.0;
          bestMatch = tokens[i];
          bestPosition = { start: i, end: i + 1 };
          bestRougeScores = { rouge1: 1.0, rouge2: 1.0, rougeL: 1.0 };
          break;
        }

        // Try number word matching (e.g., "4" matches "four")
        if (isNumberMatch(expectedToken, token)) {
          bestScore = 1.0;
          bestMatch = tokens[i];
          bestPosition = { start: i, end: i + 1 };
          bestRougeScores = { rouge1: 1.0, rouge2: 1.0, rougeL: 1.0 };
          break;
        }
      }
    }

    // If no exact match found or for multi-token assertions, use sliding window
    if (bestScore === 0) {
      for (let windowSize = 1; windowSize <= maxWindowSize; windowSize++) {
        for (let i = 0; i <= tokens.length - windowSize; i++) {
          const window = tokens.slice(i, i + windowSize).join(' ');
          const scores = computeRouge(assertion.expectedText, window);
          const maxScore = Math.max(
            scores.rouge1,
            scores.rouge2,
            scores.rougeL,
          );

          if (maxScore > bestScore) {
            bestScore = maxScore;
            bestMatch = window;
            bestPosition = { start: i, end: i + windowSize };
            bestRougeScores = scores;
          }
        }
      }
    }

    return {
      assertion,
      passed: bestScore >= assertion.threshold,
      bestMatch,
      rougeScores: bestRougeScores,
      finalScore: bestScore,
      matchPosition: bestPosition,
    };
  }

  /**
   * Calculates the overall score based on fuzzy match results
   * @param results Array of fuzzy match results
   * @returns Overall score between 0 and 1
   */
  calculateOverallScore(results: FuzzyMatchResult[]): number {
    if (results.length === 0) return 1.0;

    const totalScore = results.reduce(
      (sum, result) => sum + result.finalScore,
      0,
    );
    return totalScore / results.length;
  }

  /**
   * Checks if all fuzzy match assertions passed
   * @param results Array of fuzzy match results
   * @returns True if all assertions passed
   */
  allAssertionsPassed(results: FuzzyMatchResult[]): boolean {
    return results.every((result) => result.passed);
  }
}
