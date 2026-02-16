/**
 * Google Gemini AI 模型适配器
 * 使用 Google Generative AI SDK 调用 Gemini 1.5 Pro 模型
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

export class GeminiAdapter implements AIModelAdapter {
  name = 'Gemini'
  provider = 'google'
  modelId: string
  private client: GoogleGenerativeAI

  constructor (apiKey: string, modelId: string = 'gemini-1.5-pro') {
    this.modelId = modelId
    this.client = new GoogleGenerativeAI(apiKey)
  }

  private buildGeminiParams (prompt: string, options?: GenerateOptions) {
    let systemInstruction: string | undefined
    let contents: Array<{ role: string; parts: Array<{ text: string }> }>

    if (options?.messages) {
      const systemMsg = options.messages.find(m => m.role === 'system')
      if (systemMsg) systemInstruction = systemMsg.content
      contents = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
    } else {
      systemInstruction = options?.systemPrompt
      contents = [{ role: 'user', parts: [{ text: prompt }] }]
    }

    return { systemInstruction, contents }
  }

  async generateText (prompt: string, options?: GenerateOptions): Promise<string> {
    const { systemInstruction, contents } = this.buildGeminiParams(prompt, options)
    const model = this.client.getGenerativeModel({
      model: this.modelId,
      ...(systemInstruction && { systemInstruction })
    })

    const response = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 8192,
        temperature: options?.temperature,
        topP: options?.topP
      }
    })

    const result = response.response.text()
    if (!result) {
      throw new Error('No text content in response')
    }

    return result
  }

  async *generateStream (prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const { systemInstruction, contents } = this.buildGeminiParams(prompt, options)
    const model = this.client.getGenerativeModel({
      model: this.modelId,
      ...(systemInstruction && { systemInstruction })
    })

    const response = await model.generateContentStream({
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 8192,
        temperature: options?.temperature,
        topP: options?.topP
      }
    })

    for await (const chunk of response.stream) {
      const text = chunk.text()
      if (text) {
        yield text
      }
    }
  }

  getCapabilities (): ModelCapabilities {
    return {
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      maxContextLength: 1_000_000, // Gemini 1.5 Pro 支持 1M tokens
      supportedLanguages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // Gemini 1.5 Pro 成本
    // Input: $1.25 per 1M tokens (first 128k), $2.5 per 1M tokens (rest)
    // Output: $5 per 1M tokens (first 128k), $10 per 1M tokens (rest)
    // 简化计算，假设都在前 128k 范围内
    const inputTokens = tokens / 2
    const outputTokens = tokens / 2

    const inputCost = (inputTokens / 1_000_000) * 1.25
    const outputCost = (outputTokens / 1_000_000) * 5

    return {
      inputCost,
      outputCost,
      currency: 'USD'
    }
  }

  async isAvailable (): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelId })
      const response = await model.generateContent('Hi')

      return response.response.text() !== ''
    } catch (error) {
      console.error('Gemini availability check failed:', error)
      return false
    }
  }
}
