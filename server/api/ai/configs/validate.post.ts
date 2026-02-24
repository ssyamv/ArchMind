/**
 * 验证 API 配置是否有效
 * POST /api/ai/configs/validate
 *
 * 对于支持动态获取模型列表的提供商（OpenAI、Anthropic、Gemini、DeepSeek、Ollama），
 * 在验证连接的同时获取可用模型列表返回给前端。
 * 其他提供商（Qwen、GLM、Wenxin）返回预置的推荐模型列表。
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
    const userId = requireAuth(event)
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
    const savedConfig = await UserAPIConfigDAO.getFullConfig(userId, body.provider)

    if (!apiKey && savedConfig?.apiKey) {
      apiKey = savedConfig.apiKey
    }

    if (!baseUrl) {
      baseUrl = savedConfig?.baseUrl || providerConfig.defaultBaseUrl
    }

    // 根据提供商类型验证连接
    // availableModels: 动态获取的真实模型列表（用于让用户选择）
    // suggestedModels: 预置推荐模型列表（当无法动态获取时使用）
    let availableModels: string[] = []
    let modelsFetched = false // 是否成功动态获取了模型列表

    switch (body.provider) {
      case 'anthropic':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          const clientOptions: any = { apiKey }
          if (baseUrl && baseUrl !== providerConfig.defaultBaseUrl) {
            clientOptions.baseURL = baseUrl
          }
          const client = new Anthropic(clientOptions)
          // 尝试通过 REST 获取模型列表（需要 API Key）
          try {
            const listUrl = (clientOptions.baseURL || 'https://api.anthropic.com') + '/v1/models'
            const listResponse = await fetch(listUrl, {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              }
            })
            if (listResponse.ok) {
              const listData = await listResponse.json()
              availableModels = (listData.data || []).map((m: any) => m.id as string)
              modelsFetched = true
            }
          } catch {
            // 忽略，降级到验证连接
          }

          if (!modelsFetched) {
            // 发送最小请求验证连接
            await client.messages.create({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
            availableModels = providerConfig.models.map(m => m.id)
          }
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `Anthropic API 验证失败: ${e.message}` })
        }
        break

      case 'openai':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          const client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://api.openai.com/v1'
          })
          const models = await client.models.list()
          // 过滤出 GPT 系列和推理模型，排除 embedding、tts 等非聊天模型
          const chatModels = models.data
            .filter(m => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('o4'))
            .map(m => m.id)
            .sort()
          availableModels = chatModels.length > 0 ? chatModels : models.data.map(m => m.id).slice(0, 30)
          modelsFetched = true
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `OpenAI API 验证失败: ${e.message}` })
        }
        break

      case 'google':
        if (!apiKey) {
          throw createError({ statusCode: 400, message: 'API Key is required' })
        }
        try {
          // 尝试通过 REST API 获取模型列表
          try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            const listResponse = await fetch(listUrl)
            if (listResponse.ok) {
              const listData = await listResponse.json()
              availableModels = (listData.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''))
              modelsFetched = true
            }
          } catch {
            // 忽略，降级到验证连接
          }

          if (!modelsFetched) {
            // 降级：发送最小请求验证连接
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            await model.generateContent('Hi')
            availableModels = providerConfig.models.map(m => m.id)
          }
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
          try {
            const models = await client.models.list()
            availableModels = models.data.map(m => m.id)
            modelsFetched = true
          } catch {
            // 降级验证
            await client.chat.completions.create({
              model: 'deepseek-chat',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
            availableModels = providerConfig.models.map(m => m.id)
          }
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
          // 通义千问暂无官方模型列表接口，返回预置推荐列表
          availableModels = providerConfig.models.map(m => m.id)
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `通义千问 API 验证失败: ${e.message}` })
        }
        break

      case 'wenxin':
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
          throw createError({ statusCode: 400, message: `GLM API 验证失败: ${e.message}` })
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
          modelsFetched = true
        } catch (e: any) {
          throw createError({ statusCode: 400, message: `Ollama 连接失败: ${e.message}` })
        }
        break

      case 'custom':
        if (apiKey || baseUrl) {
          try {
            const client = new OpenAI({
              apiKey: apiKey || 'sk-placeholder',
              baseURL: baseUrl || 'https://api.openai.com/v1'
            })
            try {
              const models = await client.models.list()
              availableModels = models.data.map(m => m.id).slice(0, 50)
              modelsFetched = true
            } catch {
              availableModels = []
            }
          } catch {
            availableModels = []
          }
        }
        break

      default:
        throw createError({ statusCode: 400, message: 'Unsupported provider' })
    }

    return {
      success: true,
      message: `${providerConfig.name} 连接成功`,
      availableModels,
      modelsFetched // 告知前端是否为动态获取的真实列表
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
