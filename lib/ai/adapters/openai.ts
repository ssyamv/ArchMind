/**
 * OpenAI AI 模型适配器
 * 使用 OpenAI SDK 调用 GPT-4o 模型
 */

import OpenAI from 'openai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class OpenAIAdapter implements AIModelAdapter {
  name = 'GPT-4o'
  provider = 'openai'
  modelId: string
  private client: OpenAI

  constructor (apiKey: string, modelId: string = 'gpt-4o', baseUrl?: string) {
    this.modelId = modelId
    const options: any = { apiKey }
    if (baseUrl) options.baseURL = baseUrl
    this.client = new OpenAI(options)
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
    // GPT-4o 成本
    // Input: $5 per 1M tokens
    // Output: $15 per 1M tokens
    // 假设输入输出比例为 1:1
    const inputTokens = tokens / 2
    const outputTokens = tokens / 2

    const inputCost = (inputTokens / 1_000_000) * 5
    const outputCost = (outputTokens / 1_000_000) * 15

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
      console.error('OpenAI availability check failed:', error)
      return false
    }
  }
}
