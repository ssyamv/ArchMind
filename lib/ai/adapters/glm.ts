/**
 * GLM AI 模型适配器
 * 使用 OpenAI SDK 调用智谱 AI GLM 模型
 * GLM 提供 OpenAI 兼容的 API，这样可以使用 OpenAI SDK 进行调用
 */

import OpenAI from 'openai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class GLMAdapter implements AIModelAdapter {
  name = 'GLM'
  provider = 'glm'
  modelId: string
  private client: OpenAI

  constructor (apiKey: string, modelId: string = 'glm-4.7', baseUrl?: string) {
    this.modelId = modelId
    // GLM 使用 OpenAI 兼容的 API
    // 官方文档：https://docs.bigmodel.cn/cn/guide/develop/openai/introduction
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://open.bigmodel.cn/api/paas/v4'
    })
  }

  private buildMessages (prompt: string, options?: GenerateOptions) {
    if (options?.messages) {
      return options.messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
    }
    return [
      { role: 'system' as const, content: options?.systemPrompt || '' },
      { role: 'user' as const, content: prompt }
    ]
  }

  async generateText (prompt: string, options?: GenerateOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      max_tokens: options?.maxTokens || 8192,
      messages: this.buildMessages(prompt, options),
      temperature: options?.temperature,
      top_p: options?.topP
    })

    if (!response.choices || response.choices.length === 0) {
      throw new Error(`Model ${this.modelId} returned empty choices`)
    }
    const textContent = response.choices[0].message.content
    if (!textContent) {
      throw new Error('No text content in response')
    }

    return textContent
  }

  async *generateStream (prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.modelId,
      max_tokens: options?.maxTokens || 8192,
      messages: this.buildMessages(prompt, options),
      temperature: options?.temperature,
      top_p: options?.topP,
      stream: true
    })

    for await (const chunk of stream) {
      if (!chunk.choices || chunk.choices.length === 0) continue
      const delta = chunk.choices[0].delta
      if (delta && delta.content) {
        yield delta.content
      }
    }
  }

  getCapabilities (): ModelCapabilities {
    return {
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      maxContextLength: 128000,
      supportedLanguages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // GLM 定价（更新至 2026 年）
    // GLM-4.7: ¥0.0001 per token (input), ¥0.0001 per token (output)
    // GLM-4.6v: ¥0.00004 per token (input), ¥0.0001 per token (output)
    // GLM-4.5-Air: ¥0.00002 per token (input), ¥0.00006 per token (output)
    // 以 GLM-4.7 为基准
    // 假设输入输出比例为 1:1
    const inputTokens = tokens / 2
    const outputTokens = tokens / 2

    // 计算成本（以美元为单位，1 USD ≈ 7 CNY）
    const inputCnyPerToken = 0.0001
    const outputCnyPerToken = 0.0001
    const usdPerCny = 1 / 7

    const inputCost = inputTokens * inputCnyPerToken * usdPerCny
    const outputCost = outputTokens * outputCnyPerToken * usdPerCny

    return {
      inputCost,
      outputCost,
      currency: 'USD'
    }
  }

  async isAvailable (): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.modelId,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi'
          }
        ]
      })

      return response.id !== undefined
    } catch (error) {
      console.error('GLM availability check failed:', error)
      return false
    }
  }
}
