/**
 * 通义千问 (Qwen) AI 模型适配器
 * 使用 OpenAI SDK 调用阿里云通义千问模型（OpenAI 兼容 API）
 */

import OpenAI from 'openai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class QwenAdapter implements AIModelAdapter {
  name = '通义千问'
  provider = 'qwen'
  modelId: string
  private client: OpenAI

  constructor (apiKey: string, modelId: string = 'qwen-plus') {
    this.modelId = modelId
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
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
    const isMax = this.modelId.includes('max')
    return {
      supportsStreaming: true,
      supportsStructuredOutput: false,
      supportsVision: true,
      maxContextLength: isMax ? 30000 : 128000,
      supportedLanguages: ['zh', 'en']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // 通义千问定价
    // Qwen Max: ¥20 per 1M tokens (input), ¥60 per 1M tokens (output)
    // Qwen Plus: ¥4 per 1M tokens (input), ¥12 per 1M tokens (output)
    const isMax = this.modelId.includes('max')
    const inputPrice = isMax ? 20 : 4
    const outputPrice = isMax ? 60 : 12

    // 假设输入输出比例为 1:1
    const inputTokens = tokens / 2
    const outputTokens = tokens / 2

    // 转换为美元 (1 USD ≈ 7 CNY)
    const usdPerCny = 1 / 7
    const inputCost = (inputTokens / 1_000_000) * inputPrice * usdPerCny
    const outputCost = (outputTokens / 1_000_000) * outputPrice * usdPerCny

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
      console.error('Qwen availability check failed:', error)
      return false
    }
  }
}
