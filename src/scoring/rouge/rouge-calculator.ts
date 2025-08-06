import { tokenize } from '../utils/text-processing.js';
import {
  getNGrams,
  countOverlap,
  computeLCSLength,
} from '../utils/ngram-utils.js';

/**
 * ROUGE scores for text similarity evaluation
 */
export type RougeScores = {
  rouge1: number;
  rouge2: number;
  rougeL: number;
};

/**
 * Computes ROUGE scores between reference and candidate text
 * @param reference - The reference text
 * @param candidate - The candidate text to evaluate
 * @returns Object containing ROUGE-1, ROUGE-2, and ROUGE-L scores
 */
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

/**
 * Calculates ROUGE-N score for n-gram overlap
 * @param reference - Reference tokens
 * @param candidate - Candidate tokens
 * @param n - N-gram size
 * @returns ROUGE-N score
 */
function rougeN(reference: string[], candidate: string[], n: number): number {
  const refNGrams = getNGrams(reference, n);
  const candNGrams = getNGrams(candidate, n);

  const overlap = countOverlap(refNGrams, candNGrams);
  const total = refNGrams.length;

  if (total === 0) return 0;
  return overlap / total;
}

/**
 * Calculates ROUGE-L score using longest common subsequence
 * @param reference - Reference tokens
 * @param candidate - Candidate tokens
 * @returns ROUGE-L score
 */
function rougeLcs(reference: string[], candidate: string[]): number {
  const lcsLength = computeLCSLength(reference, candidate);
  if (reference.length === 0) return 0;
  return lcsLength / reference.length;
}
