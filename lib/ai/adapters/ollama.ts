/**
 * Ollama 本地模型适配器
 * 使用 OpenAI SDK 调用 Ollama 本地模型（OpenAI 兼容 API）
 */

import OpenAI from 'openai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class OllamaAdapter implements AIModelAdapter {
  name = 'Ollama'
  provider = 'ollama'
  modelId: string
  private client: OpenAI
  private baseUrl: string

  constructor (baseUrl: string = 'http://localhost:11434', modelId: string = 'llama3.2') {
    this.modelId = modelId
    this.baseUrl = baseUrl
    this.client = new OpenAI({
      apiKey: 'ollama', // Ollama 不需要 API Key，但 SDK 需要一个值
      baseURL: `${baseUrl}/v1`
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
      max_tokens: options?.maxTokens || 4096,
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
      max_tokens: options?.maxTokens || 4096,
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
    // 根据模型名称估算能力
    const isLargeModel = this.modelId.includes('70b') || this.modelId.includes('405b')
    return {
      supportsStreaming: true,
      supportsStructuredOutput: false,
      supportsVision: this.modelId.includes('vision') || this.modelId.includes('llava'),
      maxContextLength: isLargeModel ? 128000 : 8192,
      supportedLanguages: this.modelId.includes('qwen') || this.modelId.includes('chinese') ? ['zh', 'en'] : ['en']
    }
  }

  estimateCost (_tokens: number): CostEstimate {
    // Ollama 是本地运行的，完全免费
    return {
      inputCost: 0,
      outputCost: 0,
      currency: 'USD'
    }
  }

  async isAvailable (): Promise<boolean> {
    try {
      // 首先检查 Ollama 服务是否运行
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        return false
      }

      // 检查模型是否可用
      const data = await response.json()
      const models = data.models || []
      return models.some((m: any) => m.name.includes(this.modelId) || this.modelId.includes(m.name.split(':')[0]))
    } catch (error) {
      console.error('Ollama availability check failed:', error)
      return false
    }
  }

  /**
   * 获取 Ollama 上可用的所有模型
   */
  async getAvailableModels (): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.models || []).map((m: any) => m.name)
    } catch (error) {
      console.error('Failed to get Ollama models:', error)
      return []
    }
  }
}
