import { ProviderType } from '../config/types/config.types.js';

/**
 * Regular expressions for matching model names to providers
 */
const MODEL_PATTERNS = {
  [ProviderType.OPENAI]: /^gpt-/, // Matches gpt-3.5-turbo, gpt-4, etc.
  [ProviderType.HEBO]: /:/, // Matches any model containing a colon
  [ProviderType.ANTHROPIC]: /^claude-/, // Matches claude-2, claude-instant, etc.
  [ProviderType.CUSTOM]: /^custom-/, // Matches any model name starting with 'custom-'
} as const;

/**
 * Interface for provider mapping result
 */
interface ProviderMappingResult {
  provider: ProviderType;
  modelName: string;
}

/**
 * Maps a model name to its provider and extracts the actual model name
 * @param fullModelName The full name of the model (e.g., gato-qa:v1)
 * @returns Object containing the provider and the actual model name
 * @throws Error if the model name doesn't match any known pattern
 */
export function getProviderFromModel(
  fullModelName: string,
): ProviderMappingResult {
  // First check if it's a custom model
  if (fullModelName.startsWith('custom-')) {
    return {
      provider: ProviderType.CUSTOM,
      modelName: fullModelName.replace(/^custom-/, ''),
    };
  }

  // Then check if it's a Hebo model (contains colon)
  if (fullModelName.includes(':')) {
    return {
      provider: ProviderType.HEBO,
      modelName: fullModelName, // Keep the full model name including the colon
    };
  }

  // Then check other providers
  for (const [provider, pattern] of Object.entries(MODEL_PATTERNS)) {
    if (
      provider !== ProviderType.HEBO &&
      provider !== ProviderType.CUSTOM &&
      pattern.test(fullModelName)
    ) {
      return {
        provider: provider as ProviderType,
        modelName: fullModelName,
      };
    }
  }

  throw new Error(
    `Unknown model pattern: ${fullModelName}. Supported patterns are: custom-* for custom providers, models with ':' for Hebo, gpt-* for OpenAI, claude-* for Anthropic`,
  );
}

/**
 * Validates if a model name matches a known pattern
 * @param modelName The name of the model to validate
 * @returns True if the model name matches a known pattern
 */
export function isValidModelName(modelName: string): boolean {
  // First check for custom models
  if (modelName.startsWith('custom-')) {
    return true;
  }

  // Then check for Hebo models (containing colon)
  if (modelName.includes(':')) {
    return true;
  }

  // Then check other providers
  return Object.entries(MODEL_PATTERNS).some(
    ([provider, pattern]) =>
      provider !== ProviderType.HEBO &&
      provider !== ProviderType.CUSTOM &&
      pattern.test(modelName),
  );
}
