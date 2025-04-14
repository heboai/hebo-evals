import { Embeddings } from '@langchain/core/embeddings';
import { cosineSimilarity } from '@langchain/core/utils/math';
import { Message, ScoringConfig, ScoringMethod } from '../types/evaluation.type';

/**
 * Service responsible for scoring evaluation results
 */
export class ScoringService {
  private config: ScoringConfig;
  private embeddings?: Embeddings;

  /**
   * Creates a new ScoringService instance
   * @param config - The scoring configuration
   * @param embeddings - The embeddings model (required for semantic similarity)
   */
  constructor(config: ScoringConfig, embeddings?: Embeddings) {
    this.config = config;
    if (config.method === 'semantic-similarity' && !embeddings) {
      throw new Error('Embeddings model is required for semantic similarity scoring');
    }
    this.embeddings = embeddings;
  }

  /**
   * Updates the scoring configuration
   * @param config - The new configuration
   */
  setConfig(config: ScoringConfig): void {
    if (config.method === 'semantic-similarity' && !this.embeddings) {
      throw new Error('Embeddings model is required for semantic similarity scoring');
    }
    this.config = config;
  }

  /**
   * Calculates the similarity score between observed and expected outputs
   * @param observed - The observed output message
   * @param expected - The expected output message
   * @returns A promise that resolves to the similarity score
   */
  async score(observed: Message, expected: Message): Promise<number> {
    try {
      if (this.config.method === 'exact-match') {
        return this.exactMatch(observed.content, expected.content);
      } else {
        return this.semanticSimilarity(observed.content, expected.content);
      }
    } catch (error) {
      console.error('Error calculating score:', error);
      return 0;
    }
  }

  /**
   * Performs exact string matching
   * @param observed - The observed text
   * @param expected - The expected text
   * @returns 1 if exact match, 0 otherwise
   */
  private exactMatch(observed: string, expected: string): number {
    if (!this.config.caseSensitive) {
      observed = observed.toLowerCase();
      expected = expected.toLowerCase();
    }
    return observed === expected ? 1 : 0;
  }

  /**
   * Calculates semantic similarity using embeddings
   * @param observed - The observed text
   * @param expected - The expected text
   * @returns The cosine similarity score
   */
  private async semanticSimilarity(observed: string, expected: string): Promise<number> {
    if (!this.embeddings) {
      throw new Error('Embeddings model not initialized');
    }

    const [observedEmbedding, expectedEmbedding] = await Promise.all([
      this.embeddings.embedQuery(observed),
      this.embeddings.embedQuery(expected),
    ]);

    const obsEmbedding = Array.isArray(observedEmbedding)
      ? observedEmbedding
      : [observedEmbedding];
    const expEmbedding = Array.isArray(expectedEmbedding)
      ? expectedEmbedding
      : [expectedEmbedding];

    const similarityMatrix = cosineSimilarity([obsEmbedding], [expEmbedding]);
    return similarityMatrix[0][0];
  }

  /**
   * Determines if a score passes the threshold
   * @param score - The score to check
   * @returns True if the score meets or exceeds the threshold
   */
  isPassing(score: number): boolean {
    return score >= this.config.threshold;
  }
}
