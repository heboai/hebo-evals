/**
 * Main entry point for Hebo Eval
 * @module index
 */

import { HeboEval } from './core/index.js';
import { EvaluationConfig } from './report/evaluationTypes.js';

export { HeboEval, EvaluationConfig };
export type {
  EvaluationResult,
  EvaluationReport,
} from './report/evaluationTypes.js';
