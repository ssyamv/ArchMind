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

  private buildMessages (prompt: string, options?: GenerateOptions): OpenAI.ChatCompletionMessageParam[] {
    if (options?.messages) {
      return options.messages.map((m): OpenAI.ChatCompletionMessageParam => {
        // 处理多模态内容
        if (Array.isArray(m.content)) {
          const content: OpenAI.ChatCompletionContentPart[] = m.content.map((block) => {
            if (block.type === 'image') {
              // OpenAI 支持 base64 和 URL
              if (block.imageBase64) {
                return {
                  type: 'image_url' as const,
                  image_url: {
                    url: `data:${block.mimeType || 'image/jpeg'};base64,${block.imageBase64}`
                  }
                }
              } else if (block.imageUrl) {
                return {
                  type: 'image_url' as const,
                  image_url: { url: block.imageUrl }
                }
              }
            }
            return { type: 'text' as const, text: block.text || '' }
          })
          return { role: 'user', content }
        }
        if (m.role === 'system') return { role: 'system', content: m.content as string }
        if (m.role === 'assistant') return { role: 'assistant', content: m.content as string }
        return { role: 'user', content: m.content as string }
      })
    }
    return [
      { role: 'system', content: options?.systemPrompt || '' },
      { role: 'user', content: prompt }
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
    // gpt-4o、gpt-4.1、gpt-4-vision 系列支持视觉；o3-mini、gpt-4.1-mini 等不支持
    const visionModels = ['gpt-4o', 'gpt-4.1', 'gpt-4-vision', 'gpt-4-turbo', 'o4-mini']
    const supportsVision = visionModels.some(m => this.modelId.startsWith(m) || this.modelId.includes(m))
    return {
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision,
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
