/**
 * 图片生成管理器
 * 统一管理图片生成适配器
 */

import type { ImageGenerationAdapter, ImageGenerateOptions, ImageEditOptions, ImageTaskResult } from './image-types'
import { WanxAdapter } from './adapters/wanx-image'
import { DalleAdapter } from './adapters/dalle-image'
import { getAllImageProviders, findImageProviderByModelId } from './image-providers'

export interface ImageManagerConfig {
  dashscopeApiKey?: string // 阿里云 DashScope API Key (通义万象)
  openaiApiKey?: string // OpenAI API Key (DALL-E)
}

/**
 * 图片生成管理器
 */
export class ImageManager {
  private adapters: Map<string, ImageGenerationAdapter> = new Map()
  private config: ImageManagerConfig

  constructor(config: ImageManagerConfig) {
    this.config = config
    this.initializeAdapters()
  }

  /**
   * 初始化适配器
   */
  private initializeAdapters(): void {
    // 初始化通义万象适配器
    if (this.config.dashscopeApiKey) {
      const wanxModels = ['wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus', 'wanx2.1-imageedit', 'flux-schnell']
      for (const modelId of wanxModels) {
        const adapter = new WanxAdapter(this.config.dashscopeApiKey, modelId)
        this.adapters.set(modelId, adapter)
      }
    }

    // 初始化 DALL-E 适配器
    if (this.config.openaiApiKey) {
      const dalleAdapter = new DalleAdapter(this.config.openaiApiKey, 'dall-e-3')
      this.adapters.set('dall-e-3', dalleAdapter)
    }
  }

  /**
   * 获取适配器
   */
  getAdapter(modelId: string): ImageGenerationAdapter | null {
    return this.adapters.get(modelId) || null
  }

  /**
   * 获取默认模型 ID
   */
  getDefaultModelId(): string {
    // 优先使用快速模型
    if (this.adapters.has('wanx2.1-t2i-turbo')) {
      return 'wanx2.1-t2i-turbo'
    }
    if (this.adapters.has('flux-schnell')) {
      return 'flux-schnell'
    }
    // 返回第一个可用的模型
    const firstAdapter = this.adapters.values().next().value
    return firstAdapter?.modelId || 'wanx2.1-t2i-turbo'
  }

  /**
   * 获取所有可用的模型
   */
  getAvailableModels(): Array<{ modelId: string; providerId: string; modelName: string }> {
    const models: Array<{ modelId: string; providerId: string; modelName: string }> = []

    for (const [modelId, adapter] of this.adapters) {
      models.push({
        modelId,
        providerId: adapter.providerId,
        modelName: adapter.name
      })
    }

    return models
  }

  /**
   * 检查模型是否可用
   */
  isModelAvailable(modelId: string): boolean {
    return this.adapters.has(modelId)
  }

  /**
   * 生成图片
   */
  async generateImage(prompt: string, modelId?: string, options?: ImageGenerateOptions): Promise<ImageTaskResult> {
    const targetModelId = modelId || this.getDefaultModelId()
    const adapter = this.getAdapter(targetModelId)

    if (!adapter) {
      throw new Error(`Image model not available: ${targetModelId}`)
    }

    return adapter.generateImage(prompt, options)
  }

  /**
   * 编辑图片
   */
  async editImage(
    baseImageUrl: string,
    prompt: string,
    modelId?: string,
    options?: ImageEditOptions
  ): Promise<ImageTaskResult> {
    // 图片编辑默认使用 wanx2.1-imageedit
    const targetModelId = modelId || 'wanx2.1-imageedit'
    const adapter = this.getAdapter(targetModelId)

    if (!adapter) {
      throw new Error(`Image edit model not available: ${targetModelId}`)
    }

    return adapter.editImage(baseImageUrl, prompt, options)
  }

  /**
   * 查询任务状态
   */
  async getTaskResult(taskId: string, modelId?: string): Promise<ImageTaskResult> {
    const targetModelId = modelId || this.getDefaultModelId()
    const adapter = this.getAdapter(targetModelId)

    if (!adapter) {
      throw new Error(`Image model not available: ${targetModelId}`)
    }

    return adapter.getTaskResult(taskId)
  }

  /**
   * 等待任务完成
   */
  async waitForTask(
    taskId: string,
    modelId?: string,
    maxWaitMs?: number,
    pollIntervalMs?: number
  ): Promise<ImageTaskResult> {
    const targetModelId = modelId || this.getDefaultModelId()
    const adapter = this.getAdapter(targetModelId)

    if (!adapter) {
      throw new Error(`Image model not available: ${targetModelId}`)
    }

    return adapter.waitForTask(taskId, maxWaitMs, pollIntervalMs)
  }
}

// 单例实例
let imageManagerInstance: ImageManager | null = null

/**
 * 获取图片管理器单例
 */
export function getImageManager(config?: ImageManagerConfig): ImageManager {
  if (!imageManagerInstance && config) {
    imageManagerInstance = new ImageManager(config)
  }

  if (!imageManagerInstance) {
    throw new Error('ImageManager not initialized. Please provide config on first call.')
  }

  return imageManagerInstance
}

/**
 * 重置图片管理器（用于测试或重新配置）
 */
export function resetImageManager(): void {
  imageManagerInstance = null
}
