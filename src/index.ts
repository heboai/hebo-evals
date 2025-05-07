/**
 * Main entry point for Hebo Eval
 * @module index
 */

import { HeboEval } from './core/index';
import { EvaluationConfig } from './evaluation/types/evaluation.types';

export { HeboEval, EvaluationConfig };
export type {
  EvaluationResult,
  EvaluationReport,
} from './evaluation/types/evaluation.types';
