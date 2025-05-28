/**
 * Provider-specific configuration utilities
 */

/**
 * Base URLs for different providers
 */
const PROVIDER_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  hebo: 'https://app.hebo.ai',
} as const;

/**
 * Gets the base URL for a given provider
 * @param provider The provider name
 * @returns The base URL for the provider
 * @throws Error if the provider is not supported
 */
export function getProviderBaseUrl(provider: string): string {
  const normalizedProvider = provider.toLowerCase();
  const baseUrl =
    PROVIDER_BASE_URLS[normalizedProvider as keyof typeof PROVIDER_BASE_URLS];

  if (!baseUrl) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return baseUrl;
}
