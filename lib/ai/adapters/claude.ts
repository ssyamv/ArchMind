/**
 * Claude AI 模型适配器
 * 使用 Anthropic SDK 调用 Claude 模型
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class ClaudeAdapter implements AIModelAdapter {
  name = 'Claude'
  provider = 'anthropic'
  modelId: string
  private client: Anthropic

  constructor (apiKey: string, modelId: string = 'claude-3-5-sonnet-20241022', baseUrl?: string) {
    this.modelId = modelId
    const options: any = { apiKey }
    if (baseUrl) options.baseURL = baseUrl
    this.client = new Anthropic(options)
  }

  private buildClaudeParams (prompt: string, options?: GenerateOptions) {
    let systemPrompt = options?.systemPrompt
    let messages: Array<{ role: 'user' | 'assistant'; content: string }>

    if (options?.messages) {
      const systemMsg = options.messages.find(m => m.role === 'system')
      if (systemMsg) systemPrompt = systemMsg.content
      messages = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    } else {
      messages = [{ role: 'user', content: prompt }]
    }

    return { systemPrompt, messages }
  }

  async generateText (prompt: string, options?: GenerateOptions): Promise<string> {
    const { systemPrompt, messages } = this.buildClaudeParams(prompt, options)
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: options?.maxTokens || 8192,
      system: systemPrompt,
      messages,
      temperature: options?.temperature,
      top_p: options?.topP
    })

    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    return textContent.text
  }

  async *generateStream (prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const { systemPrompt, messages } = this.buildClaudeParams(prompt, options)
    const stream = await this.client.messages.stream({
      model: this.modelId,
      max_tokens: options?.maxTokens || 8192,
      system: systemPrompt,
      messages,
      temperature: options?.temperature,
      top_p: options?.topP
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text
      }
    }
  }

  getCapabilities (): ModelCapabilities {
    return {
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      maxContextLength: 200000,
      supportedLanguages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // Claude 3.5 Sonnet 成本
    // Input: $3 per 1M tokens
    // Output: $15 per 1M tokens
    // 假设输入输出比例为 1:1
    const inputTokens = tokens / 2
    const outputTokens = tokens / 2

    const inputCost = (inputTokens / 1_000_000) * 3
    const outputCost = (outputTokens / 1_000_000) * 15

    return {
      inputCost,
      outputCost,
      currency: 'USD'
    }
  }

  async isAvailable (): Promise<boolean> {
    try {
      const message = await this.client.messages.create({
        model: this.modelId,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi'
          }
        ]
      })

      return message.id !== undefined
    } catch (error) {
      console.error('Claude availability check failed:', error)
      return false
    }
  }
}
