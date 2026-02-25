/**
 * 获取可用的 AI 模型列表
 * 返回后端已配置且有 API Key 的所有模型及其元数据
 *
 * 模型来源策略：
 * - 系统模型：来自环境变量中配置的 API Key（所有用户共享）
 * - 用户模型：来自用户在设置页面自己添加的 API Key（仅该用户可见）
 * - 同名冲突：用户模型 ID 加 "user:" 前缀，名称加 "(我的)" 后缀以区分
 * - Ollama：仅当用户主动配置了 baseUrl 时才显示，不使用环境变量默认值
 */

import { ModelManager, getModelManager } from '~/lib/ai/manager'
import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'
import type { AvailableModelInfo } from '~/types/settings'
import { cache } from '~/lib/cache'
import { CacheKeys, CacheTTL } from '~/lib/cache/keys'

// 判断一个 API Key 是否为真实有效值（排除占位符）
function isValidApiKey (key: string | undefined): string | undefined {
  if (!key) return undefined
  if (/^your[_-]/i.test(key)) return undefined
  if (key === 'xxx' || key === 'sk-xxx') return undefined
  return key
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const runtimeConfig = useRuntimeConfig()

    // ── 检查缓存（1 小时）────────────────────────────────────────────────────
    const cacheKey = CacheKeys.aiModels('all', userId)
    const cachedModels = await cache.get(cacheKey)
    if (cachedModels) {
      return cachedModels
    }

    // 从数据库获取当前用户的 API 配置
    const userConfigs = await UserAPIConfigDAO.getAllEnabledWithKeys(userId)
    const userConfigMap = new Map(userConfigs.map(c => [c.provider, c]))

    // ── 1. 构建系统级配置（仅来自环境变量，不包含 Ollama 默认值）──
    const sysConfig: Record<string, any> = {}

    const sysAnthropicKey = isValidApiKey(runtimeConfig.anthropicApiKey as string)
    if (sysAnthropicKey) sysConfig.anthropicApiKey = sysAnthropicKey

    const sysOpenaiKey = isValidApiKey(runtimeConfig.openaiApiKey as string)
    if (sysOpenaiKey) sysConfig.openaiApiKey = sysOpenaiKey

    const sysGoogleKey = isValidApiKey(runtimeConfig.googleApiKey as string)
    if (sysGoogleKey) sysConfig.googleApiKey = sysGoogleKey

    const sysDeepseekKey = isValidApiKey(runtimeConfig.deepseekApiKey as string)
    if (sysDeepseekKey) sysConfig.deepseekApiKey = sysDeepseekKey

    const sysDashscopeKey = isValidApiKey(runtimeConfig.dashscopeApiKey as string)
    if (sysDashscopeKey) sysConfig.dashscopeApiKey = sysDashscopeKey

    const sysBaiduKey = isValidApiKey(runtimeConfig.baiduApiKey as string)
    if (sysBaiduKey) sysConfig.baiduApiKey = sysBaiduKey

    const sysGlmKey = isValidApiKey(runtimeConfig.glmApiKey as string)
    if (sysGlmKey) sysConfig.glmApiKey = sysGlmKey

    // Ollama：系统级不提供默认模型，只有用户主动配置才显示

    // ── 2. 构建用户级配置（仅来自数据库） ──
    const userConfig: Record<string, any> = {}

    const anthropicUser = userConfigMap.get('anthropic')
    if (anthropicUser?.apiKey) {
      userConfig.anthropicApiKey = anthropicUser.apiKey
      userConfig.anthropicBaseUrl = anthropicUser.baseUrl || undefined
      userConfig.anthropicModels = anthropicUser.models?.length ? anthropicUser.models : undefined
    }

    const openaiUser = userConfigMap.get('openai')
    if (openaiUser?.apiKey) {
      userConfig.openaiApiKey = openaiUser.apiKey
      userConfig.openaiBaseUrl = openaiUser.baseUrl || undefined
      userConfig.openaiModels = openaiUser.models?.length ? openaiUser.models : undefined
    }

    const googleUser = userConfigMap.get('google')
    if (googleUser?.apiKey) {
      userConfig.googleApiKey = googleUser.apiKey
      userConfig.googleModels = googleUser.models?.length ? googleUser.models : undefined
    }

    const deepseekUser = userConfigMap.get('deepseek')
    if (deepseekUser?.apiKey) {
      userConfig.deepseekApiKey = deepseekUser.apiKey
      userConfig.deepseekBaseUrl = deepseekUser.baseUrl || undefined
      userConfig.deepseekModels = deepseekUser.models?.length ? deepseekUser.models : undefined
    }

    const qwenUser = userConfigMap.get('qwen')
    if (qwenUser?.apiKey) {
      userConfig.dashscopeApiKey = qwenUser.apiKey
      userConfig.qwenModels = qwenUser.models?.length ? qwenUser.models : undefined
    }

    const wenxinUser = userConfigMap.get('wenxin')
    if (wenxinUser?.apiKey) {
      userConfig.baiduApiKey = wenxinUser.apiKey
      userConfig.wenxinModels = wenxinUser.models?.length ? wenxinUser.models : undefined
    }

    const glmUser = userConfigMap.get('glm')
    if (glmUser?.apiKey) {
      userConfig.glmApiKey = glmUser.apiKey
      userConfig.glmBaseUrl = glmUser.baseUrl || undefined
      userConfig.glmModels = glmUser.models?.length ? glmUser.models : undefined
    }

    // Ollama：仅用户主动配置了 baseUrl 才显示
    const ollamaUser = userConfigMap.get('ollama')
    if (ollamaUser?.baseUrl) {
      userConfig.ollamaBaseUrl = ollamaUser.baseUrl
      userConfig.ollamaModels = ollamaUser.models?.length ? ollamaUser.models : undefined
    }

    // Custom API
    const customUser = userConfigMap.get('custom')
    if (customUser) {
      userConfig.customApiKey = customUser.apiKey || undefined
      userConfig.customBaseUrl = customUser.baseUrl || undefined
      userConfig.customModels = customUser.models?.length ? customUser.models : []
    }

    // ── 3. 用独立实例分别获取系统模型和用户模型，避免单例污染 ──
    const sysManager = new ModelManager(sysConfig)
    const sysModels: AvailableModelInfo[] = sysManager.getAvailableModelsWithMetadata()
    const sysModelIds = new Set(sysModels.map(m => m.id))

    const userManager = new ModelManager(userConfig)
    const rawUserModels: AvailableModelInfo[] = userManager.getAvailableModelsWithMetadata()

    // ── 4. 合并：用户模型与系统模型同 ID 时加 "user:" 前缀和 "(我的)" 后缀 ──
    const processedUserModels: AvailableModelInfo[] = rawUserModels.map(m => {
      if (sysModelIds.has(m.id)) {
        return { ...m, id: `user:${m.id}`, name: `${m.name} (我的)` }
      }
      return m
    })

    const availableModels: AvailableModelInfo[] = [
      ...sysModels,
      ...processedUserModels
    ]

    // 单例 manager 使用合并配置用于实际调用：系统配置优先，用户独有的 provider 补充进去
    const mergedConfig: Record<string, any> = { ...sysConfig }
    for (const [key, value] of Object.entries(userConfig)) {
      if (mergedConfig[key] === undefined) mergedConfig[key] = value
    }
    getModelManager(mergedConfig)

    if (availableModels.length === 0) {
      console.warn('No AI models configured with available API keys')
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.noAiModelsConfigured')
      }
    }

    const defaultModel = sysManager.getDefaultModelId()

    const response = {
      success: true,
      data: {
        availableModels,
        defaultModel,
        selectedModel: defaultModel
      }
    }

    // ── 写入缓存（1 小时）────────────────────────────────────────────────────
    await cache.set(cacheKey, response, CacheTTL.AI_MODELS)

    return response
  } catch (error) {
    console.error('Error getting available models:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
