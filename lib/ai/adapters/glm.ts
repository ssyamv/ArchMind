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

  private buildMessages (prompt: string, options?: GenerateOptions): OpenAI.ChatCompletionMessageParam[] {
    if (options?.messages) {
      // 过滤掉空 content 的 system message（GLM API 不接受空 system content）
      return options.messages
        .filter((m) => {
          // 如果是 system 消息且 content 为空字符串，则过滤掉
          if (m.role === 'system' && typeof m.content === 'string' && m.content.trim() === '') {
            return false
          }
          return true
        })
        .map((m): OpenAI.ChatCompletionMessageParam => {
          // 处理多模态内容（GLM-4.6V 支持）
          if (Array.isArray(m.content)) {
            const content: OpenAI.ChatCompletionContentPart[] = m.content.map((block) => {
              if (block.type === 'image') {
                // GLM 使用 OpenAI 兼容格式
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
    // 如果没有 messages，且 systemPrompt 为空，则不添加 system message
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (options?.systemPrompt && options.systemPrompt.trim() !== '') {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })
    return messages
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
    // thinking 参数：默认关闭，需用户主动开启
    // 文档：https://docs.bigmodel.cn/cn/guide/capabilities/thinking-mode
    const thinkingParam = options?.enableThinking !== undefined
      ? { type: options.enableThinking ? 'enabled' : 'disabled' } as const
      : { type: 'disabled' } as const

    const stream = await (this.client.chat.completions.create as (params: unknown) => Promise<AsyncIterable<unknown>>)({
      model: this.modelId,
      max_tokens: options?.maxTokens || 8192,
      messages: this.buildMessages(prompt, options),
      temperature: options?.temperature,
      top_p: options?.topP,
      stream: true,
      thinking: thinkingParam
    })

    for await (const chunk of stream as AsyncIterable<any>) {
      if (!chunk.choices || chunk.choices.length === 0) continue
      const delta = chunk.choices[0].delta

      // GLM-4.7 等推理模型返回 reasoning_content（思考过程）和 content（最终答案）
      // 用特殊前缀 \x00THINK\x00 标记思考内容，让上层可区分处理
      if (delta.reasoning_content) {
        yield `\x00THINK\x00${delta.reasoning_content}`
      } else if (delta.content) {
        yield delta.content
      }
    }
  }

  getCapabilities (): ModelCapabilities {
    // 只有 glm-4.6v 系列支持视觉输入
    const supportsVision = this.modelId.includes('4.6v') || this.modelId.includes('4v')
    return {
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision,
      supportsThinking: true,
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
