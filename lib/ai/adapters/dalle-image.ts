/**
 * OpenAI DALL-E 图片生成适配器
 *
 * 支持 DALL-E 3 文生图（同步接口，直接返回图片 URL）。
 * DALL-E 3 不支持图片编辑，图片编辑需使用通义万象适配器。
 *
 * API 文档: https://platform.openai.com/docs/api-reference/images
 */

import type { ImageGenerationAdapter, ImageGenerateOptions, ImageEditOptions, ImageTaskResult } from '../image-types'

const OPENAI_BASE_URL = 'https://api.openai.com'

interface DalleResponse {
  created: number
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
  error?: {
    message: string
    type: string
    code?: string
  }
}

/**
 * DALL-E 3 尺寸映射：将通用格式转换为 OpenAI 支持的格式
 */
const SIZE_MAP: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
  '1024*1024': '1024x1024',
  '1024x1024': '1024x1024',
  '1792*1024': '1792x1024',
  '1792x1024': '1792x1024',
  '1024*1792': '1024x1792',
  '1024x1792': '1024x1792'
}

/**
 * DALL-E 图片生成适配器（基于 DALL-E 3）
 */
export class DalleAdapter implements ImageGenerationAdapter {
  readonly name = 'DALL-E 3'
  readonly providerId = 'openai'
  readonly modelId: string

  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, modelId: string = 'dall-e-3') {
    this.apiKey = apiKey
    this.modelId = modelId
    this.baseUrl = process.env.OPENAI_BASE_URL || OPENAI_BASE_URL
  }

  /**
   * 生成图片（文生图）
   * DALL-E 3 是同步接口，直接包装成统一的异步任务格式
   */
  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageTaskResult> {
    const size = SIZE_MAP[options?.size || '1024*1024'] || '1024x1024'

    const body: Record<string, any> = {
      model: this.modelId,
      prompt,
      n: 1, // DALL-E 3 每次只能生成 1 张
      size,
      response_format: 'url',
      quality: 'standard'
    }

    const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`DALL-E API error: ${response.status} - ${errorData?.error?.message || response.statusText}`)
    }

    const data: DalleResponse = await response.json()

    if (data.error) {
      throw new Error(`DALL-E API error: ${data.error.message}`)
    }

    const imageUrl = data.data?.[0]?.url
    if (!imageUrl) {
      throw new Error('DALL-E returned no image URL')
    }

    // DALL-E 是同步接口，直接返回 SUCCEEDED 状态
    const taskId = `dalle-${Date.now()}`
    return {
      taskId,
      status: 'SUCCEEDED',
      imageUrls: [imageUrl]
    }
  }

  /**
   * DALL-E 3 不支持图片编辑（该功能仅 DALL-E 2 支持）
   */
  async editImage(_baseImageUrl: string, _prompt: string, _options?: ImageEditOptions): Promise<ImageTaskResult> {
    throw new Error('DALL-E 3 不支持图片编辑功能，请使用通义万象进行图片编辑')
  }

  /**
   * DALL-E 是同步接口，任务 ID 格式为 dalle-{timestamp}，直接返回已完成状态
   */
  async getTaskResult(taskId: string): Promise<ImageTaskResult> {
    // DALL-E 无异步任务，生成时已得到结果，此方法仅作兼容
    return {
      taskId,
      status: 'SUCCEEDED'
    }
  }

  /**
   * DALL-E 同步接口，无需等待
   */
  async waitForTask(taskId: string): Promise<ImageTaskResult> {
    return this.getTaskResult(taskId)
  }

  /**
   * 检查适配器是否可用
   */
  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey) && this.apiKey.startsWith('sk-')
  }

  /**
   * 获取支持的图片尺寸（DALL-E 3 支持的三种比例）
   */
  getSupportedSizes(): string[] {
    return ['1024*1024', '1792*1024', '1024*1792']
  }
}

export function createDalleAdapter(apiKey: string, modelId?: string): DalleAdapter {
  return new DalleAdapter(apiKey, modelId)
}
