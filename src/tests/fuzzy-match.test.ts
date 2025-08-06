import { FuzzyMatchParser } from '../parser/fuzzy-match-parser.js';
import { FuzzyMatchScoringService } from '../scoring/fuzzy-match/fuzzy-match-scoring.service.js';
import type { FuzzyMatchResult } from '../evaluation/types/fuzzy-match.types.js';

describe('FuzzyMatchParser', () => {
  let parser: FuzzyMatchParser;

  beforeEach(() => {
    parser = new FuzzyMatchParser();
  });

  describe('parseAssertions', () => {
    it('should extract fuzzy match assertions from content', () => {
      const content =
        "I'll search for the weather in [New York, NY|0.8], with a [temperature of 59°F|0.95]";
      const assertions = parser.parseAssertions(content);

      expect(assertions).toHaveLength(2);
      expect(assertions[0]).toEqual({
        expectedText: 'New York, NY',
        threshold: 0.8,
        description: 'New York, NY',
      });
      expect(assertions[1]).toEqual({
        expectedText: 'temperature of 59°F',
        threshold: 0.95,
        description: 'temperature of 59°F',
      });
    });

    it('should handle content without assertions', () => {
      const content = 'This is a normal message without any assertions';
      const assertions = parser.parseAssertions(content);

      expect(assertions).toHaveLength(0);
    });
  });

  describe('cleanContent', () => {
    it('should remove fuzzy match syntax from content', () => {
      const content =
        "I'll search for the weather in [New York, NY|0.8], with a [temperature of 59°F|0.95]";
      const cleaned = parser.cleanContent(content);

      expect(cleaned).toBe(
        "I'll search for the weather in New York, NY, with a temperature of 59°F",
      );
    });
  });

  describe('hasAssertions', () => {
    it('should return true when content has assertions', () => {
      const content = "I'll search for the weather in [New York, NY|0.8]";
      expect(parser.hasAssertions(content)).toBe(true);
    });

    it('should return false when content has no assertions', () => {
      const content = 'This is a normal message';
      expect(parser.hasAssertions(content)).toBe(false);
    });
  });
});

describe('FuzzyMatchScoringService', () => {
  let scoringService: FuzzyMatchScoringService;

  beforeEach(() => {
    scoringService = new FuzzyMatchScoringService();
  });

  describe('evaluateAssertions', () => {
    it('should evaluate fuzzy match assertions correctly', () => {
      const assertions = [
        {
          expectedText: 'temperature of 59°F',
          threshold: 0.8,
          description: 'temperature',
        },
        { expectedText: 'New York', threshold: 0.6, description: 'location' },
      ];

      const actualResponse =
        "It's rainy in New York, NY, today, with a temperature of 59°F, 80 percent precipitation, and 96 percent humidity.";

      const results = scoringService.evaluateAssertions(
        assertions,
        actualResponse,
      );

      expect(results).toHaveLength(2);

      // Temperature assertion should pass with high score
      expect(results[0].passed).toBe(true);
      expect(results[0].finalScore).toBeGreaterThan(0.8);
      expect(results[0].bestMatch).toContain('59°F');

      // Location assertion should pass with lower score
      expect(results[1].passed).toBe(true);
      expect(results[1].bestMatch).toContain('New York');
    });

    it('should handle assertions that fail to meet threshold', () => {
      const assertions = [
        {
          expectedText: 'temperature of 100°F',
          threshold: 0.9,
          description: 'temperature',
        },
      ];

      const actualResponse =
        "It's rainy in New York, NY, today, with a temperature of 59°F, 80 percent precipitation, and 96 percent humidity.";

      const results = scoringService.evaluateAssertions(
        assertions,
        actualResponse,
      );

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].finalScore).toBeLessThan(0.9);
    });

    it('should use maximum ROUGE score as final score', () => {
      const assertions = [
        {
          expectedText: 'test phrase',
          threshold: 0.5,
          description: 'test',
        },
      ];

      const actualResponse = 'This is a test phrase with some content';

      const results = scoringService.evaluateAssertions(
        assertions,
        actualResponse,
      );

      expect(results).toHaveLength(1);
      const result = results[0];

      // The final score should be the maximum of the three ROUGE scores
      const expectedMaxScore = Math.max(
        result.rougeScores.rouge1,
        result.rougeScores.rouge2,
        result.rougeScores.rougeL,
      );

      expect(result.finalScore).toBe(expectedMaxScore);
    });

    it('should match number words correctly', () => {
      const assertions = [
        {
          expectedText: '4',
          threshold: 0.8,
          description: 'number',
        },
      ];

      const actualResponse = 'Sure, two plus two equals four.';

      const results = scoringService.evaluateAssertions(
        assertions,
        actualResponse,
      );

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].finalScore).toBe(1.0);
      expect(results[0].bestMatch).toBe('four.');
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate average score from results', () => {
      const results = [
        {
          assertion: { expectedText: 'test1', threshold: 0.8 },
          passed: true,
          bestMatch: 'test1',
          rougeScores: { rouge1: 1.0, rouge2: 1.0, rougeL: 1.0 },
          finalScore: 1.0,
          matchPosition: { start: 0, end: 1 },
        },
        {
          assertion: { expectedText: 'test2', threshold: 0.8 },
          passed: true,
          bestMatch: 'test2',
          rougeScores: { rouge1: 0.8, rouge2: 0.8, rougeL: 0.8 },
          finalScore: 0.8,
          matchPosition: { start: 0, end: 1 },
        },
      ];

      const overallScore = scoringService.calculateOverallScore(results);
      expect(overallScore).toBe(0.9);
    });

    it('should return 1.0 for empty results', () => {
      const results: FuzzyMatchResult[] = [];
      const overallScore = scoringService.calculateOverallScore(results);
      expect(overallScore).toBe(1.0);
    });
  });

  describe('allAssertionsPassed', () => {
    it('should return true when all assertions pass', () => {
      const results = [
        {
          assertion: { expectedText: 'test1', threshold: 0.8 },
          passed: true,
          bestMatch: 'test1',
          rougeScores: { rouge1: 1.0, rouge2: 1.0, rougeL: 1.0 },
          finalScore: 1.0,
          matchPosition: { start: 0, end: 1 },
        },
        {
          assertion: { expectedText: 'test2', threshold: 0.8 },
          passed: true,
          bestMatch: 'test2',
          rougeScores: { rouge1: 0.8, rouge2: 0.8, rougeL: 0.8 },
          finalScore: 0.8,
          matchPosition: { start: 0, end: 1 },
        },
      ];

      expect(scoringService.allAssertionsPassed(results)).toBe(true);
    });

    it('should return false when any assertion fails', () => {
      const results = [
        {
          assertion: { expectedText: 'test1', threshold: 0.8 },
          passed: true,
          bestMatch: 'test1',
          rougeScores: { rouge1: 1.0, rouge2: 1.0, rougeL: 1.0 },
          finalScore: 1.0,
          matchPosition: { start: 0, end: 1 },
        },
        {
          assertion: { expectedText: 'test2', threshold: 0.8 },
          passed: false,
          bestMatch: 'test2',
          rougeScores: { rouge1: 0.5, rouge2: 0.5, rougeL: 0.5 },
          finalScore: 0.5,
          matchPosition: { start: 0, end: 1 },
        },
      ];

      expect(scoringService.allAssertionsPassed(results)).toBe(false);
    });
  });
});
