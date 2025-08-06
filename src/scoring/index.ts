/**
 * Scoring module index
 *
 * This module provides various scoring and similarity evaluation capabilities:
 * - Similarity algorithms (cosine similarity)
 * - ROUGE metrics for text evaluation
 * - Fuzzy matching for flexible text comparison
 * - High-level scoring services
 * - Common utilities for text processing
 */

// Core similarity algorithms
export * from './similarity/index.js';

// ROUGE metrics
export * from './rouge/index.js';

// Fuzzy matching
export * from './fuzzy-match/index.js';

// High-level services
export * from './services/index.js';

// Utilities
export * from './utils/index.js';
