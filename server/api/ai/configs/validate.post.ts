/**
 * 验证 API 配置是否有效
 * POST /api/ai/configs/validate
 */

import type { ValidateAPIRequest } from '~/types/settings'
import type { AIProviderType } from '~/types/settings'
import { AI_PROVIDERS } from '~/lib/ai/providers'
import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

function isValidProvider(provider: string): provider is AIProviderType {
  return provider in AI_PROVIDERS
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ValidateAPIRequest>(event)

    if (!body.provider) {
      throw createError({
        statusCode: 400,
        message: 'Provider is required'
      })
    }

    if (!isValidProvider(body.provider)) {
      throw createError({
        statusCode: 400,
        message: `Invalid provider: ${body.provider}`
      })
    }

    const providerConfig = AI_PROVIDERS[body.provider]

    // 获取 API Key（优先使用请求中的，否则从数据库获取）
    let apiKey = body.apiKey
    let baseUrl = body.baseUrl

    // 从数据库获取已保存的配置
    const savedConfig = await UserAPIConfigDAO.getFullConfig(body.provider)

    if (!apiKey && savedConfig?.apiKey) {
      apiKey = savedConfig.apiKey
    }

    if (!baseUrl) {
      baseUrl = savedConfig?.baseUrl || providerConfig.defaultBaseUrl
    }

    // 根据提供商类型验证连接
    let availableModels: string[] = []

    switch (body.provider) {
      case 'anthropic':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          // 支持自定义 Base URL（中转站）
          const clientOptions: any = { apiKey }
          if (baseUrl && baseUrl !== providerConfig.defaultBaseUrl) {
            clientOptions.baseURL = baseUrl
          }
          const client = new Anthropic(clientOptions)
          // 发送一个最小请求来验证
          await client.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `Anthropic API 验证失败: ${e.message}` })
        }
        break

      case 'openai':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          // 支持自定义 Base URL（中转站）
          const client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://api.openai.com/v1'
          })
          const models = await client.models.list()
          availableModels = models.data
            .map(m => m.id)
            .slice(0, 20)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `OpenAI API 验证失败: ${e.message}` })
        }
        break

      case 'google':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          // Google 暂不支持自定义 Base URL
          const genAI = new GoogleGenerativeAI(apiKey)
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
          await model.generateContent('Hi')
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `Google API 验证失败: ${e.message}` })
        }
        break

      case 'deepseek':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          const client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://api.deepseek.com'
          })
          await client.chat.completions.create({
            model: 'deepseek-chat',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `DeepSeek API 验证失败: ${e.message}` })
        }
        break

      case 'qwen':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          const client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          })
          await client.chat.completions.create({
            model: 'qwen-plus',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `通义千问 API 验证失败: ${e.message}` })
        }
        break

      case 'wenxin':
        // 文心一言需要 API Key 和 Secret Key
        // 暂时简化处理
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        availableModels = providerConfig.models.map(m => m.id)
        break

      case 'glm':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          const client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://open.bigmodel.cn/api/paas/v4'
          })
          await client.chat.completions.create({
            model: 'glm-4-flash',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `ChatGLM API 验证失败: ${e.message}` })
        }
        break

      case 'ollama':
        try {
          const ollamaUrl = baseUrl || 'http://localhost:11434'
          const response = await fetch(`${ollamaUrl}/api/tags`)
          if (!response.ok) {
            throw new Error('Failed to connect to Ollama')
          }
          const data = await response.json()
          availableModels = data.models?.map((m: any) => m.name) || []
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `Ollama 连接失败: ${e.message}` })
        }
        break

      default:
        throw createError({ statusCode: 400, message: 'Unsupported provider' })
    }

    return {
      success: true,
      message: `${providerConfig.name} 连接成功`,
      availableModels
    }
  } catch (error: any) {
    console.error('API validation failed:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: error.message || 'Validation failed'
    }
  }
})
