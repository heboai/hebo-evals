type RougeScores = {
  rouge1: number;
  rouge2: number;
  rougeL: number;
};

export function computeRouge(
  reference: string,
  candidate: string,
): RougeScores {
  const refTokens = tokenize(reference);
  const candTokens = tokenize(candidate);

  const rouge1 = rougeN(refTokens, candTokens, 1);
  const rouge2 = rougeN(refTokens, candTokens, 2);
  const rougeL = rougeLcs(refTokens, candTokens);

  return {
    rouge1,
    rouge2,
    rougeL,
  };
}

// -------------------------------
// Utility Functions
// -------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function rougeN(reference: string[], candidate: string[], n: number): number {
  const refNGrams = getNGrams(reference, n);
  const candNGrams = getNGrams(candidate, n);

  const overlap = countOverlap(refNGrams, candNGrams);
  const total = refNGrams.length;

  if (total === 0) return 0;
  return overlap / total;
}

function getNGrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function countOverlap(a: string[], b: string[]): number {
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

function rougeLcs(reference: string[], candidate: string[]): number {
  const lcsLength = computeLCSLength(reference, candidate);
  if (reference.length === 0) return 0;
  return lcsLength / reference.length;
}

function computeLCSLength(a: string[], b: string[]): number {
  const dp = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));

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
