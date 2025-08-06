/**
 * N-gram utilities for text similarity calculations
 */

/**
 * Generates n-grams from a sequence of tokens
 * @param tokens - Array of tokens
 * @param n - Size of n-grams to generate
 * @returns Array of n-gram strings
 */
export function getNGrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Counts the overlap between two arrays of n-grams, accounting for duplicates
 * @param a - First array of n-grams
 * @param b - Second array of n-grams
 * @returns Number of overlapping n-grams
 */
export function countOverlap(a: string[], b: string[]): number {
  const bCounts = new Map<string, number>();
  for (const ngram of b) {
    bCounts.set(ngram, (bCounts.get(ngram) || 0) + 1);
  }

  let overlap = 0;
  for (const ngram of a) {
    const count = bCounts.get(ngram) || 0;
    if (count > 0) {
      overlap++;
      bCounts.set(ngram, count - 1);
    }
  }

  return overlap;
}

/**
 * Calculates the longest common subsequence (LCS) length between two arrays
 * @param a - First array
 * @param b - Second array
 * @returns Length of the longest common subsequence
 */
export function computeLCSLength(a: string[], b: string[]): number {
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = new Array<number>(b.length + 1).fill(0);
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[a.length][b.length];
}
