import { jest, expect } from '@jest/globals';
import type { AsymmetricMatchers } from '@jest/expect';
import {
  EmbeddingProviderFactory,
  EmbeddingSystemConfig,
} from '../embeddings/config/embedding.config';
import { EmbeddingProvider } from '../embeddings/implementations/embedding-provider.js';
import { EmbeddingResponse } from '../embeddings/types/embedding.types.js';

// Mock fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

interface MockOpenAIResponse extends Record<string, unknown> {
  data: Array<{
    embedding: number[];
    object: string;
    index: number;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface MockHeboResponse extends Record<string, unknown> {
  data: Array<{
    embedding: string; // Base64 encoded embedding
    object: string;
    index: number;
  }>;
  model: string;
  object: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Helper to create mock response with proper typing
const createMockResponse = <T extends Record<string, unknown>>(
  data: T,
  status = 200,
): Response => {
  const responseBody = JSON.stringify(data);
  return new Response(responseBody, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Helper to create base64 encoded embedding for Hebo tests
const createBase64Embedding = (embedding: number[]): string => {
  const floatArray = new Float32Array(embedding);
  const bytes = new Uint8Array(floatArray.buffer);
  return btoa(String.fromCharCode(...bytes));
};

describe('Embedding System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('EmbeddingProviderFactory', () => {
    it('should create unified provider for OpenAI configuration', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      };

      const provider = EmbeddingProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(EmbeddingProvider);
      expect(provider.getConfig()).toEqual({
        provider: 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      });
    });

    it('should create unified provider for Hebo configuration', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'hebo',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      };

      const provider = EmbeddingProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(EmbeddingProvider);
      expect(provider.getConfig()).toEqual({
        provider: 'hebo',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      });
    });

    it('should throw error for invalid provider', () => {
      const config = {
        defaultProvider: 'invalid' as 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      };

      expect(() => EmbeddingProviderFactory.createProvider(config)).toThrow(
        'Configuration error: Unsupported embedding provider: invalid. Supported providers are: openai, hebo',
      );
    });

    it('should throw error for missing API key', () => {
      const config: EmbeddingSystemConfig = {
        defaultProvider: 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: '',
      };

      expect(() => EmbeddingProviderFactory.createProvider(config)).toThrow(
        'API key is required',
      );
    });

    it('should load configuration from environment variables', () => {
      process.env.EMBEDDING_PROVIDER = 'openai';
      process.env.EMBEDDING_MODEL = 'test-model';
      process.env.EMBEDDING_BASE_URL = 'http://test-url';
      process.env.HEBO_API_KEY = 'test-key';

      const config = EmbeddingProviderFactory.loadFromEnv();
      expect(config).toEqual({
        defaultProvider: 'openai',
        model: 'test-model',
        baseUrl: 'http://test-url',
        apiKey: 'test-key',
      });
    });
  });

  describe('EmbeddingProvider - OpenAI Mode', () => {
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

    it('should generate embedding successfully with OpenAI format', async () => {
      const mockData: MockOpenAIResponse = {
        data: [
          {
            embedding: mockResponse.embedding,
            object: 'embedding',
            index: 0,
          },
        ],
        model: 'test-model',
        object: 'list',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };
      const response = createMockResponse(mockData);
      mockFetch.mockResolvedValueOnce(response);

      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        apiKey: 'test-key',
      });

      const result = await provider.generateEmbedding('test text');
      const expectedEmbeddings = mockResponse.embedding.map(
        (v) => expect.closeTo(v, 5) as unknown as AsymmetricMatchers,
      );
      expect(result.embedding).toEqual(
        expect.arrayContaining(expectedEmbeddings),
      );
      expect(result.metadata).toEqual(mockResponse.metadata);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: expect.not.stringContaining('"encoding_format"'),
        }),
      );
    });

    it('should use custom base URL when provided for OpenAI', async () => {
      const mockData: MockOpenAIResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
            object: 'embedding',
            index: 0,
          },
        ],
        model: 'test-model',
        object: 'list',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };
      const response = createMockResponse(mockData);
      mockFetch.mockResolvedValueOnce(response);

      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          baseUrl: 'https://custom.api.com/v1',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        baseUrl: 'https://custom.api.com/v1',
        apiKey: 'test-key',
      });

      await provider.generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/embeddings',
        expect.any(Object),
      );
    });

    it('should handle API errors in OpenAI mode', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding: Network error',
      );
    });

    it('should validate model presence for OpenAI', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: '',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await expect(
        provider.initialize({
          provider: 'openai',
          model: '',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('Model is required for openai embedding provider');
    });
  });

  describe('EmbeddingProvider - Hebo Mode', () => {
    const mockResponse: EmbeddingResponse = {
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        model: 'test-model',
        provider: 'hebo',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      },
    };

    it('should generate embedding successfully with Hebo format', async () => {
      const base64Embedding = createBase64Embedding(mockResponse.embedding);
      const mockData: MockHeboResponse = {
        data: [{ embedding: base64Embedding, object: 'embedding', index: 0 }],
        model: 'test-model',
        object: 'list',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };
      const response = createMockResponse(mockData);
      mockFetch.mockResolvedValueOnce(response);

      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'hebo',
        model: 'test-model',
        apiKey: 'test-key',
      });

      const result = await provider.generateEmbedding('test text');
      const expectedEmbeddings = mockResponse.embedding.map(
        (v) => expect.closeTo(v, 5) as unknown as AsymmetricMatchers,
      );
      expect(result.embedding).toEqual(
        expect.arrayContaining(expectedEmbeddings),
      );
      expect(result.metadata).toEqual(mockResponse.metadata);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hebo.ai/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key',
          }),
          body: expect.stringContaining('"encoding_format":"base64"'),
        }),
      );
    });

    it('should use custom base URL when provided for Hebo', async () => {
      const base64Embedding = createBase64Embedding([0.1, 0.2, 0.3]);
      const mockData: MockHeboResponse = {
        data: [{ embedding: base64Embedding, object: 'embedding', index: 0 }],
        model: 'test-model',
        object: 'list',
      };
      const response = createMockResponse(mockData);
      mockFetch.mockResolvedValueOnce(response);

      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: 'test-model',
          baseUrl: 'https://custom.hebo.com/v1',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'hebo',
        model: 'test-model',
        baseUrl: 'https://custom.hebo.com/v1',
        apiKey: 'test-key',
      });

      await provider.generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.hebo.com/v1/embeddings',
        expect.any(Object),
      );
    });

    it('should handle API errors in Hebo mode', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'hebo',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding: Network error',
      );
    });

    it('should validate model presence for Hebo', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: '',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await expect(
        provider.initialize({
          provider: 'hebo',
          model: '',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('Model is required for hebo embedding provider');
    });

    it('should handle invalid base64 response in Hebo mode', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse<MockHeboResponse>({
          data: [
            { embedding: 'invalid-base64', object: 'embedding', index: 0 },
          ],
          model: 'test-model',
          object: 'list',
        }),
      );

      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'hebo',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Invalid base64 encoding in embedding response',
      );
    });

    it('should retry on server errors', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Second call succeeds
      const base64Embedding = createBase64Embedding([0.1, 0.2, 0.3]);
      const mockData: MockHeboResponse = {
        data: [{ embedding: base64Embedding, object: 'embedding', index: 0 }],
        model: 'test-model',
        object: 'list',
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockData));

      const provider = new EmbeddingProvider(
        {
          provider: 'hebo',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'hebo',
        model: 'test-model',
        apiKey: 'test-key',
      });

      // Since the first call is not a retryable error (not status 5xx), it should fail immediately
      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding: Network error',
      );
    });
  });

  describe('BaseEmbeddingProvider', () => {
    it('should throw error when initializing an already initialized provider', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(
        provider.initialize({
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        }),
      ).rejects.toThrow('Embedding provider is already initialized');
    });

    it('should throw error when generating embedding without initialization', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Embedding provider must be initialized before generating embeddings',
      );
    });

    it('should throw error for empty text input', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(provider.generateEmbedding('')).rejects.toThrow(
        'Input text cannot be empty',
      );
    });

    it('should cleanup provider successfully', async () => {
      const provider = new EmbeddingProvider(
        {
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        },
        'test-key',
      );

      await provider.initialize({
        provider: 'openai',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await provider.cleanup();

      // Should be able to initialize again after cleanup
      await expect(
        provider.initialize({
          provider: 'openai',
          model: 'test-model',
          apiKey: 'test-key',
        }),
      ).resolves.not.toThrow();
    });
  });
});
