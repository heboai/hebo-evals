import { jest } from '@jest/globals';
import {
  EmbeddingProviderFactory,
  EmbeddingSystemConfig,
} from '../embeddings/config/embedding.config';
import { LiteLLMEmbeddingProvider } from '../embeddings/implementations/litellm-embedding-provider.js';
import { OpenAIEmbeddingProvider } from '../embeddings/implementations/openai-embedding-provider.js';
import { EmbeddingResponse } from '../embeddings/types/embedding.types.js';

// Mock fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Helper to create mock response
const createMockResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

describe('Embedding System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('EmbeddingProviderFactory', () => {
    it('should create LiteLLM provider with correct configuration', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'litellm',
        litellm: {
          model: 'test-model',
          baseUrl: 'http://test-url',
        },
      };

      const provider = EmbeddingProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(LiteLLMEmbeddingProvider);
      expect(provider.getConfig()).toEqual({
        provider: 'litellm',
        model: 'test-model',
        baseUrl: 'http://test-url',
      });
    });

    it('should create OpenAI provider with correct configuration', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'openai',
        openai: {
          model: 'test-model',
          apiKey: 'test-key',
          baseUrl: 'http://test-url',
        },
      };

      const provider = EmbeddingProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(provider.getConfig()).toEqual({
        provider: 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
      });
    });

    it('should throw error for invalid provider', () => {
      const config = {
        defaultProvider: 'invalid' as 'litellm' | 'openai',
      };

      expect(() => EmbeddingProviderFactory.createProvider(config)).toThrow(
        'Unsupported provider',
      );
    });

    it('should throw error for missing OpenAI API key', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'openai',
        openai: {
          model: 'test-model',
          apiKey: '',
          baseUrl: 'http://test-url',
        },
      };

      expect(() => EmbeddingProviderFactory.createProvider(config)).toThrow(
        'OpenAI API key is required',
      );
    });

    it('should load configuration from environment variables', () => {
      process.env.EMBEDDING_PROVIDER = 'litellm';
      process.env.LITELLM_EMBEDDING_MODEL = 'test-model';
      process.env.LITELLM_BASE_URL = 'http://test-url';

      const config = EmbeddingProviderFactory.loadFromEnv();
      expect(config).toEqual({
        defaultProvider: 'litellm',
        litellm: {
          model: 'test-model',
          baseUrl: 'http://test-url',
        },
        openai: {
          model: 'text-embedding-3-small',
          apiKey: '',
          baseUrl: undefined,
        },
      });
    });
  });

  describe('LiteLLMEmbeddingProvider', () => {
    const mockResponse: EmbeddingResponse = {
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        model: 'test-model',
        provider: 'litellm',
      },
    };

    it('should generate embedding successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          data: [{ embedding: mockResponse.embedding }],
        }),
      );

      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: 'test-model',
      });

      await provider.initialize({
        provider: 'litellm',
        model: 'test-model',
      });

      const result = await provider.generateEmbedding('test text');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/embeddings',
        expect.any(Object),
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal Server Error' }, 500),
      );

      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: 'test-model',
      });

      await provider.initialize({
        provider: 'litellm',
        model: 'test-model',
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'HTTP error! status: 500',
      );
    });

    it('should validate model presence', async () => {
      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: '',
      });

      await expect(
        provider.initialize({
          provider: 'litellm',
          model: '',
        }),
      ).rejects.toThrow('Model is required for LiteLLM embedding provider');
    });
  });

  describe('OpenAIEmbeddingProvider', () => {
    const mockResponse: EmbeddingResponse = {
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        model: 'test-model',
        provider: 'openai',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      },
    };

    it('should generate embedding successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          data: [{ embedding: mockResponse.embedding }],
          usage: mockResponse.metadata?.usage,
        }),
      );

      const provider = new OpenAIEmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
      });

      const result = await provider.generateEmbedding('test text');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.any(Object),
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401),
      );

      const provider = new OpenAIEmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'HTTP error! status: 401',
      );
    });

    it('should validate API key presence', async () => {
      const provider = new OpenAIEmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
        },
        '',
      );

      await expect(
        provider.initialize({
          provider: 'openai',
          model: 'test-model',
        }),
      ).rejects.toThrow('API key is required for OpenAI embedding provider');
    });
  });

  describe('BaseEmbeddingProvider', () => {
    it('should throw error when initializing an already initialized provider', async () => {
      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: 'test-model',
      });

      await provider.initialize({
        provider: 'litellm',
        model: 'test-model',
      });

      await expect(
        provider.initialize({
          provider: 'litellm',
          model: 'test-model',
        }),
      ).rejects.toThrow('Embedding provider is already initialized');
    });

    it('should throw error when generating embeddings before initialization', async () => {
      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: 'test-model',
      });

      await expect(provider.generateEmbedding('test')).rejects.toThrow(
        'Embedding provider must be initialized before generating embeddings',
      );
    });

    it('should allow reinitialization after cleanup', async () => {
      const provider = new LiteLLMEmbeddingProvider({
        provider: 'litellm',
        model: 'test-model',
      });

      await provider.initialize({
        provider: 'litellm',
        model: 'test-model',
      });

      await provider.cleanup();

      // Should not throw
      await expect(
        provider.initialize({
          provider: 'litellm',
          model: 'updated-model',
        }),
      ).resolves.not.toThrow();

      expect(provider.getConfig().model).toBe('updated-model');
    });
  });
});
