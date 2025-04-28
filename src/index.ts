/**
 * Main entry point for Hebo Eval
 * @module index
 */

import { HeboEval } from './core/index.js';
import { EvaluationConfig } from './core/types/evaluation.js';

export { HeboEval, EvaluationConfig };
export type {
  EvaluationResult,
  EvaluationReport,
} from './core/types/evaluation';
