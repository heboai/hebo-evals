/**
 * Calculates the cosine similarity between two vectors
 *
 * @param vectorA - First vector
 * @param vectorB - Second vector
 * @returns Cosine similarity score between -1 and 1
 * @throws Error if vectors are empty or have different dimensions
 */
export function calculateCosineSimilarity(
  vectorA: number[],
  vectorB: number[],
): number {
  if (vectorA.length === 0 || vectorB.length === 0) {
    throw new Error('Vectors cannot be empty');
  }

  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(
    vectorA.reduce((sum, val) => sum + val * val, 0),
  );
  const magnitudeB = Math.sqrt(
    vectorB.reduce((sum, val) => sum + val * val, 0),
  );

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error('Vectors cannot have zero magnitude');
  }

  // Calculate cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}
