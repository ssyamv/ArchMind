/**
 * Embedding 服务抽象接口
 * 定义文本向量化服务的统一接口，支持多种 Embedding 提供商
 */

import { ragLogger } from '~/lib/logger'

export interface EmbeddingModelInfo {
  modelId: string;
  dimensions: number;
  maxInputTokens: number;
  provider: string;
}

export interface EmbeddingCostEstimate {
  inputCost: number;
  currency: string;
}

/**
 * Embedding 适配器接口
 * 所有 Embedding 服务提供商都需要实现此接口
 */
export interface IEmbeddingAdapter {
  /**
   * 获取单个文本的向量表示
   * @param text 输入文本
   * @returns 向量数组
   */
  embed(text: string): Promise<number[]>;

  /**
   * 批量获取文本的向量表示
   * @param texts 输入文本数组
   * @returns 向量数组的数组
   */
  embedMany(texts: string[]): Promise<number[][]>;

  /**
   * 计算成本估算
   * @param tokenCount token 数量
   * @returns 成本估算信息
   */
  calculateCost(tokenCount: number): EmbeddingCostEstimate;

  /**
   * 获取模型信息
   * @returns 模型配置信息
   */
  getModelInfo(): EmbeddingModelInfo;

  /**
   * 检查服务是否可用
   * @returns 是否可用
   */
  isAvailable(): Promise<boolean>;
}
/**
 * Embedding 服务工厂
 * 根据配置创建相应的 Embedding 适配器
 */
export class EmbeddingServiceFactory {
  /**
   * 创建 Embedding 适配器
   * @param provider 提供商类型 ('openai' | 'glm')
   * @param apiKey API 密钥
   * @param modelId 模型 ID（可选）
   * @returns Embedding 适配器实例
   */
  static async create(
    provider: 'openai' | 'glm',
    apiKey: string,
    modelId?: string
  ): Promise<IEmbeddingAdapter> {
    switch (provider) {
      case 'openai': {
        const { OpenAIEmbeddingAdapter } = await import('./adapters/openai-embedding')
        return new OpenAIEmbeddingAdapter(apiKey, modelId)
      }
      
      case 'glm': {
        const { GLMEmbeddingAdapter } = await import('./adapters/glm-embedding')
        return new GLMEmbeddingAdapter(apiKey, modelId)
      }
      
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`)
    }
  }

  /**
   * 根据 AI 模型配置创建对应的 Embedding 适配器
   * @param modelConfig 模型配置对象（从 ai-models.yaml 读取）
   * @param apiKeys API 密钥配置对象
   * @returns Embedding 适配器实例或 null（如果模型不支持 Embedding）
   */
  static async createFromModelConfig(
    modelConfig: {
      embedding?: {
        supported: boolean;
        provider?: string;
        model?: string;
        dimensions?: number;
      };
    },
    apiKeys: {
      glmApiKey?: string;
      openaiApiKey?: string;
    }
  ): Promise<IEmbeddingAdapter | null> {
    // 检查模型是否支持 Embedding
    if (!modelConfig.embedding || !modelConfig.embedding.supported) {
      return null
    }

    const embeddingProvider = modelConfig.embedding.provider
    const embeddingModel = modelConfig.embedding.model
    const dimensions = modelConfig.embedding.dimensions

    try {
      // 根据提供商创建对应的 Embedding 适配器
      if (embeddingProvider === 'glm' && apiKeys.glmApiKey) {
        const { GLMEmbeddingAdapter } = await import('./adapters/glm-embedding')
        return new GLMEmbeddingAdapter(apiKeys.glmApiKey, embeddingModel, dimensions)
      } else if (embeddingProvider === 'openai' && apiKeys.openaiApiKey) {
        const { OpenAIEmbeddingAdapter } = await import('./adapters/openai-embedding')
        return new OpenAIEmbeddingAdapter(apiKeys.openaiApiKey, embeddingModel)
      } else {
        ragLogger.warn({ provider: embeddingProvider }, 'Embedding provider not configured or API key missing')
        return null
      }
    } catch (error) {
      ragLogger.error({ err: error, provider: embeddingProvider }, 'Failed to create embedding adapter')
      return null
    }
  }

  /**
   * 自动选择可用的 Embedding 服务
   * 优先级：GLM > OpenAI
   * @param config 配置对象
   * @returns Embedding 适配器实例或 null
   */
  static async createAvailable(config: {
    glmApiKey?: string;
    openaiApiKey?: string;
    preferredProvider?: 'openai' | 'glm';
  }): Promise<IEmbeddingAdapter | null> {
    const { glmApiKey, openaiApiKey, preferredProvider } = config

    // 如果指定了首选提供商，优先尝试
    if (preferredProvider === 'glm' && glmApiKey) {
      try {
        const adapter = await this.create('glm', glmApiKey)
        if (await adapter.isAvailable()) {
          return adapter
        }
      } catch (error) {
        ragLogger.warn({ err: error }, 'GLM embedding service not available')
      }
    }

    if (preferredProvider === 'openai' && openaiApiKey) {
      try {
        const adapter = await this.create('openai', openaiApiKey)
        if (await adapter.isAvailable()) {
          return adapter
        }
      } catch (error) {
        ragLogger.warn({ err: error }, 'OpenAI embedding service not available')
      }
    }

    // 按默认优先级尝试
    if (glmApiKey) {
      try {
        const adapter = await this.create('glm', glmApiKey)
        if (await adapter.isAvailable()) {
          return adapter
        }
      } catch (error) {
        ragLogger.warn({ err: error }, 'GLM embedding service not available')
      }
    }

    if (openaiApiKey) {
      try {
        const adapter = await this.create('openai', openaiApiKey)
        if (await adapter.isAvailable()) {
          return adapter
        }
      } catch (error) {
        ragLogger.warn({ err: error }, 'OpenAI embedding service not available')
      }
    }

    return null
  }
}



