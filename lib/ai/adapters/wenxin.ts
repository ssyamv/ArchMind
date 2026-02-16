/**
 * 文心一言 (Wenxin) AI 模型适配器
 * 使用百度千帆平台的 API
 */

import type { AIModelAdapter, GenerateOptions, ModelCapabilities, CostEstimate } from '~/lib/ai/types'

interface WenxinConfig {
  apiKey: string
  secretKey?: string
  modelId: string
}

export class WenxinAdapter implements AIModelAdapter {
  name = '文心一言'
  provider = 'wenxin'
  modelId: string
  private apiKey: string
  private secretKey: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor (config: WenxinConfig | string, modelId: string = 'ernie-4.0-8k') {
    if (typeof config === 'string') {
      // 简化构造，假设 API Key 和 Secret Key 用 | 分隔
      const [apiKey, secretKey] = config.split('|')
      this.apiKey = apiKey
      this.secretKey = secretKey || ''
    } else {
      this.apiKey = config.apiKey
      this.secretKey = config.secretKey || ''
      this.modelId = config.modelId
    }
    this.modelId = modelId
  }

  /**
   * 获取百度 Access Token
   */
  private async getAccessToken (): Promise<string> {
    // 如果 token 仍然有效，直接返回
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`,
      { method: 'POST' }
    )

    const data = await response.json()
    if (data.error) {
      throw new Error(`Failed to get access token: ${data.error_description || data.error}`)
    }

    if (!data.access_token) {
      throw new Error('Failed to get access token: No access_token in response')
    }

    this.accessToken = data.access_token
    // Token 有效期 30 天，提前 1 小时刷新
    this.tokenExpiresAt = Date.now() + (data.expires_in - 3600) * 1000

    return data.access_token
  }

  /**
   * 获取模型对应的 API 端点
   */
  private getApiEndpoint (modelId: string): string {
    const endpoints: Record<string, string> = {
      'ernie-4.0-8k': 'completions_pro',
      'ernie-4.0': 'completions_pro',
      'ernie-3.5-8k': 'completions',
      'ernie-3.5': 'completions',
      'ernie-speed-8k': 'ernie_speed',
      'ernie-speed': 'ernie_speed'
    }
    return endpoints[modelId] || 'completions'
  }

  private buildMessages (prompt: string, options?: GenerateOptions): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    if (options?.systemPrompt) {
      messages.push({ role: 'user', content: options.systemPrompt })
      messages.push({ role: 'assistant', content: '好的，我会按照您的要求进行。' })
    }

    if (options?.messages) {
      for (const msg of options.messages) {
        messages.push({ role: msg.role, content: msg.content })
      }
    } else {
      messages.push({ role: 'user', content: prompt })
    }

    return messages
  }

  async generateText (prompt: string, options?: GenerateOptions): Promise<string> {
    const accessToken = await this.getAccessToken()
    const endpoint = this.getApiEndpoint(this.modelId)

    const response = await fetch(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${endpoint}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.buildMessages(prompt, options),
          temperature: options?.temperature,
          top_p: options?.topP,
          max_output_tokens: options?.maxTokens || 2048
        })
      }
    )

    const data = await response.json()
    if (data.error_code) {
      throw new Error(`Wenxin API error: ${data.error_msg || data.error_code}`)
    }

    return data.result
  }

  async *generateStream (prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const accessToken = await this.getAccessToken()
    const endpoint = this.getApiEndpoint(this.modelId)

    const response = await fetch(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${endpoint}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.buildMessages(prompt, options),
          temperature: options?.temperature,
          top_p: options?.topP,
          max_output_tokens: options?.maxTokens || 2048,
          stream: true
        })
      }
    )

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.result) {
              yield data.result
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  getCapabilities (): ModelCapabilities {
    const is4 = this.modelId.includes('4.0') || this.modelId.includes('4-')
    return {
      supportsStreaming: true,
      supportsStructuredOutput: false,
      supportsVision: false,
      maxContextLength: is4 ? 8000 : 8000,
      supportedLanguages: ['zh', 'en']
    }
  }

  estimateCost (tokens: number): CostEstimate {
    // 文心一言定价
    // ERNIE 4.0: ¥30 per 1M tokens (input), ¥60 per 1M tokens (output)
    // ERNIE 3.5: ¥4 per 1M tokens (input), ¥8 per 1M tokens (output)
    const is4 = this.modelId.includes('4.0') || this.modelId.includes('4-')
    const inputPrice = is4 ? 30 : 4
    const outputPrice = is4 ? 60 : 8

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
      const accessToken = await this.getAccessToken()
      return !!accessToken
    } catch (error) {
      console.error('Wenxin availability check failed:', error)
      return false
    }
  }
}
