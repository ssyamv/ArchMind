/**
 * DeepSeek AI 模型适配器
 * 使用 OpenAI SDK 调用 DeepSeek 模型（OpenAI 兼容 API）
 */

import OpenAI from 'openai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class DeepSeekAdapter implements AIModelAdapter {
  name = 'DeepSeek'
  provider = 'deepseek'
  modelId: string
  private client: OpenAI

  constructor (apiKey: string, modelId: string = 'deepseek-chat', baseUrl?: string) {
    this.modelId = modelId
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.deepseek.com'
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
      supportsVision: false,
      maxContextLength: 64000,
      supportedLanguages: ['zh', 'en']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // DeepSeek 定价
    // DeepSeek Chat: ¥1 per 1M tokens (input), ¥2 per 1M tokens (output)
    // DeepSeek Reasoner: ¥4 per 1M tokens (input), ¥16 per 1M tokens (output)
    const isReasoner = this.modelId.includes('reasoner')
    const inputPrice = isReasoner ? 4 : 1
    const outputPrice = isReasoner ? 16 : 2

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
      console.error('DeepSeek availability check failed:', error)
      return false
    }
  }
}
