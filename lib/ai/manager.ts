/**
 * AI 模型管理器
 * 管理多个 AI 模型适配器，提供模型选择、路由和缓存
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'js-yaml'
import { ClaudeAdapter } from './adapters/claude'

// 内嵌默认配置，当 yaml 文件在 Vercel 等环境中不可访问时作为降级
const DEFAULT_MODEL_CONFIG: AIModelsConfig = {
  default: 'glm-4.7',
  fallback: ['glm-4.5-air', 'gpt-4o', 'claude-3.5-sonnet'],
  preferences: {
    prd_generation: ['claude-3.5-sonnet', 'gpt-4o', 'glm-4.7'],
    chinese_content: ['glm-4.7', 'glm-4.5-air', 'qwen-max', 'ernie-4.0-8k'],
    large_document: ['gemini-1.5-pro', 'claude-3.5-sonnet'],
    cost_sensitive: ['glm-4.5-air', 'deepseek-chat', 'qwen-turbo'],
    privacy_mode: ['ollama-llama3', 'ollama-qwen']
  },
  models: {
    'glm-4.7': { enabled: true, name: 'GLM 4.7', provider: 'Zhipu AI', description: '最新推理模型，支持思考模式，适合复杂逻辑分析和 PRD 生成', api_key_env: 'GLM_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.0001/token', output: '¥0.0001/token' } },
    'glm-4.5-air': { enabled: true, name: 'GLM 4.5 Air', provider: 'Zhipu AI', description: '经济版模型，最低成本，适合快速原型和成本敏感场景', api_key_env: 'GLM_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.00002/token', output: '¥0.00006/token' } },
    'claude-3.5-sonnet': { enabled: false, name: 'Claude 3.5 Sonnet', provider: 'Anthropic', description: '企业级推理能力，支持 200K 上下文', api_key_env: 'ANTHROPIC_API_KEY', capabilities: { maxContextLength: 200000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.003/1K tokens', output: '¥0.015/1K tokens' } },
    'gpt-4o': { enabled: false, name: 'GPT-4o', provider: 'OpenAI', description: '多模态 AI，图片理解能力强', api_key_env: 'OPENAI_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.005/1K tokens', output: '¥0.015/1K tokens' } },
    'gemini-1.5-pro': { enabled: false, name: 'Gemini 1.5 Pro', provider: 'Google', description: '超大上下文窗口 (100K+)', api_key_env: 'GOOGLE_API_KEY', capabilities: { maxContextLength: 1000000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.0013/1K tokens', output: '¥0.0053/1K tokens' } },
    'qwen-max': { enabled: false, name: '通义千问 Qwen Max', provider: 'Alibaba', description: '旗舰模型，中文理解能力最强', api_key_env: 'DASHSCOPE_API_KEY', capabilities: { maxContextLength: 32000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.02/1K tokens', output: '¥0.06/1K tokens' } },
    'deepseek-chat': { enabled: false, name: 'DeepSeek Chat', provider: 'DeepSeek', description: '高性价比通用对话模型', api_key_env: 'DEEPSEEK_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.001/1K tokens', output: '¥0.002/1K tokens' } },
    'ernie-4.0-8k': { enabled: false, name: '文心一言 ERNIE 4.0', provider: 'Baidu', description: '百度旗舰大模型', api_key_env: 'BAIDU_API_KEY', capabilities: { maxContextLength: 8192, supportsStreaming: true, supportsStructuredOutput: false, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.03/1K tokens', output: '¥0.09/1K tokens' } }
  }
}
import { OpenAIAdapter } from './adapters/openai'
import { GeminiAdapter } from './adapters/gemini'
import { GLMAdapter } from './adapters/glm'
import { DeepSeekAdapter } from './adapters/deepseek'
import { QwenAdapter } from './adapters/qwen'
import { WenxinAdapter } from './adapters/wenxin'
import { OllamaAdapter } from './adapters/ollama'
import type { AIModelAdapter } from '~/lib/ai/types'
import type { AvailableModelInfo } from '~/types/settings'
import { aiLogger } from '~/lib/logger'

export enum ModelProvider {
  CLAUDE = 'claude',
  OPENAI = 'openai',
  GEMINI = 'gemini',
  GLM = 'glm',
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
  WENXIN = 'wenxin',
  OLLAMA = 'ollama'
}

interface ModelConfig {
  enabled: boolean
  name: string
  provider: string
  description: string
  api_key_env: string
  capabilities: {
    maxContextLength: number
    supportsStreaming: boolean
    supportsStructuredOutput: boolean
    supportsVision: boolean
    supportedLanguages: string[]
  }
  costEstimate: {
    input: string
    output: string
  }
}

interface AIModelsConfig {
  default: string
  fallback: string[]
  preferences: Record<string, string[]>
  models: Record<string, ModelConfig>
}

export class ModelManager {
  private adapters: Map<string, AIModelAdapter> = new Map()
  private cache: Map<string, AIModelAdapter> = new Map()
  private modelConfig: AIModelsConfig | null = null

  constructor (config?: Record<string, any>) {
    this.loadModelConfig()
    this.initializeAdapters(config)
  }

  /**
   * 从 YAML 配置文件加载模型配置
   */
  private loadModelConfig () {
    try {
      // 在 Nuxt 中运行时，应该是在项目根目录中查找
      const configPath = join(process.cwd(), 'config', 'ai-models.yaml')
      const content = readFileSync(configPath, 'utf-8')
      const parsed = YAML.load(content) as { ai_models: AIModelsConfig }
      this.modelConfig = parsed.ai_models
    } catch (error) {
      aiLogger.warn({ err: error }, 'Failed to load ai-models.yaml config, using built-in defaults')
      this.modelConfig = DEFAULT_MODEL_CONFIG
    }
  }

  /**
   * 初始化所有适配器
   * config 中的 xxxModels 字段为用户自定义的模型 ID 列表（来自数据库）
   * 如果为空，则使用各提供商的默认模型列表
   */
  initializeAdapters (config?: Record<string, any>) {
    // 如果没有提供配置，则跳过初始化
    if (!config) {
      return
    }

    // 清空现有适配器，确保每次重新初始化时只包含当前配置中有 API Key 的模型
    this.adapters.clear()

    // Claude 适配器
    if (config.anthropicApiKey) {
      const baseUrl = config.anthropicBaseUrl as string | undefined
      const userModels: string[] = config.anthropicModels?.length
        ? config.anthropicModels
        : ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
      for (const modelId of userModels) {
        const claude = new ClaudeAdapter(config.anthropicApiKey as string, modelId, baseUrl)
        this.adapters.set(modelId, claude)
      }
    }

    // OpenAI 适配器
    if (config.openaiApiKey) {
      const baseUrl = config.openaiBaseUrl as string | undefined
      const userModels: string[] = config.openaiModels?.length
        ? config.openaiModels
        : ['gpt-4o', 'gpt-4o-mini', 'o3-mini']
      for (const modelId of userModels) {
        const openai = new OpenAIAdapter(config.openaiApiKey as string, modelId, baseUrl)
        this.adapters.set(modelId, openai)
      }
    }

    // Gemini 适配器
    if (config.googleApiKey) {
      const userModels: string[] = config.googleModels?.length
        ? config.googleModels
        : ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
      for (const modelId of userModels) {
        const gemini = new GeminiAdapter(config.googleApiKey as string, modelId)
        this.adapters.set(modelId, gemini)
      }
    }

    // GLM 适配器
    if (config.glmApiKey) {
      const baseUrl = config.glmBaseUrl as string | undefined
      const userModels: string[] = config.glmModels?.length
        ? config.glmModels
        : ['glm-4-plus', 'glm-4-air', 'glm-4-flash']
      for (const modelId of userModels) {
        const glm = new GLMAdapter(config.glmApiKey as string, modelId, baseUrl)
        this.adapters.set(modelId, glm)
      }
    }

    // DeepSeek 适配器
    if (config.deepseekApiKey) {
      const baseUrl = config.deepseekBaseUrl as string | undefined
      const userModels: string[] = config.deepseekModels?.length
        ? config.deepseekModels
        : ['deepseek-chat', 'deepseek-reasoner']
      for (const modelId of userModels) {
        const deepseek = new DeepSeekAdapter(config.deepseekApiKey as string, modelId, baseUrl)
        this.adapters.set(modelId, deepseek)
      }
    }

    // 通义千问 (Qwen) 适配器
    if (config.dashscopeApiKey) {
      const userModels: string[] = config.qwenModels?.length
        ? config.qwenModels
        : ['qwen-max', 'qwen-plus', 'qwen-turbo']
      for (const modelId of userModels) {
        const qwen = new QwenAdapter(config.dashscopeApiKey as string, modelId)
        this.adapters.set(modelId, qwen)
      }
    }

    // 文心一言 (Wenxin) 适配器
    if (config.baiduApiKey) {
      const userModels: string[] = config.wenxinModels?.length
        ? config.wenxinModels
        : ['ernie-4.0-8k', 'ernie-3.5-8k']
      for (const modelId of userModels) {
        const wenxin = new WenxinAdapter(config.baiduApiKey as string, modelId)
        this.adapters.set(modelId, wenxin)
      }
    }

    // Ollama 本地模型适配器
    if (config.ollamaBaseUrl) {
      const userModels: string[] = config.ollamaModels?.length
        ? config.ollamaModels
        : ['llama3.2', 'qwen2.5', 'deepseek-r1']
      for (const modelId of userModels) {
        const ollama = new OllamaAdapter(config.ollamaBaseUrl as string, modelId)
        this.adapters.set(`ollama-${modelId}`, ollama)
      }
    }

    // Custom API 适配器（OpenAI 兼容接口）
    if (config.customModels?.length && (config.customApiKey || config.customBaseUrl)) {
      for (const modelId of config.customModels as string[]) {
        const custom = new OpenAIAdapter(
          config.customApiKey as string || 'sk-placeholder',
          modelId,
          config.customBaseUrl as string
        )
        this.adapters.set(`custom-${modelId}`, custom)
      }
    }
  }

  /**
   * 获取指定的模型适配器
   */
  getAdapter (modelId: string): AIModelAdapter | null {
    return this.adapters.get(modelId) || null
  }

  /**
   * 获取所有可用的模型
   */
  getAvailableModels (): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * 根据任务类型选择最合适的模型
   */
  selectModelByTask (taskType: string): AIModelAdapter | null {
    // 根据配置或策略选择模型
    const modelMap: Record<string, string> = {
      prd_generation: 'claude-3.5-sonnet', // PRD 生成优先使用 Claude
      chinese_content: 'glm-4.7', // 中文内容优先使用 GLM（成本低廉）
      large_document: 'gemini-1.5-pro', // 大文件优先使用 Gemini
      general: 'gpt-4o' // 通用使用 GPT-4o
    }

    const modelId = modelMap[taskType] || 'claude-3.5-sonnet'
    return this.getAdapter(modelId)
  }

  /**
   * 获取模型的详细信息
   */
  getModelInfo (modelId: string) {
    const adapter = this.getAdapter(modelId)
    if (!adapter) {
      return null
    }

    return {
      modelId: adapter.modelId,
      name: adapter.name,
      provider: adapter.provider,
      capabilities: adapter.getCapabilities()
    }
  }

  /**
   * 获取所有模型的信息
   */
  getAllModelsInfo () {
    return Array.from(this.adapters.values()).map(adapter => ({
      modelId: adapter.modelId,
      name: adapter.name,
      provider: adapter.provider,
      capabilities: adapter.getCapabilities()
    }))
  }

  /**
   * 获取所有可用模型及其元数据（用于前端展示）
   * 优先从 YAML 配置获取模型信息，对于用户自定义的模型则从适配器读取基本信息
   * @param idPrefix 可选前缀，用于区分系统模型和用户模型（如 "user-"）
   */
  getAvailableModelsWithMetadata (idPrefix?: string): AvailableModelInfo[] {
    const result: AvailableModelInfo[] = []
    const coveredIds = new Set<string>()

    // 优先返回 YAML 中已知的模型
    if (this.modelConfig) {
      for (const [modelId, config] of Object.entries(this.modelConfig.models)) {
        if (this.adapters.has(modelId)) {
          result.push({
            id: idPrefix ? `${idPrefix}${modelId}` : modelId,
            name: config.name,
            provider: config.provider,
            description: config.description,
            capabilities: config.capabilities,
            costEstimate: config.costEstimate
          })
          coveredIds.add(modelId)
        }
      }
    }

    // 对于 YAML 中没有的用户自定义模型（如 Ollama、custom 等），从适配器直接生成信息
    for (const [adapterId, adapter] of this.adapters.entries()) {
      if (!coveredIds.has(adapterId)) {
        result.push({
          id: idPrefix ? `${idPrefix}${adapterId}` : adapterId,
          name: adapter.modelId,
          provider: adapter.provider,
          description: `${adapter.provider} 自定义模型`,
          capabilities: adapter.getCapabilities(),
          costEstimate: { input: '未知', output: '未知' }
        })
      }
    }

    return result
  }

  /**
   * 获取默认模型 ID
   */
  getDefaultModelId (): string {
    return this.modelConfig?.default || 'glm-4.7'
  }

  /**
   * 检查模型是否可用
   */
  async isModelAvailable (modelId: string): Promise<boolean> {
    const adapter = this.getAdapter(modelId)
    if (!adapter) {
      return false
    }

    return await adapter.isAvailable()
  }

  /**
   * 估算成本
   */
  estimateCost (modelId: string, tokens: number) {
    const adapter = this.getAdapter(modelId)
    if (!adapter) {
      return null
    }

    return adapter.estimateCost(tokens)
  }
}

// 创建单例
let managerInstance: ModelManager | null = null

export function getModelManager (config?: Record<string, any>): ModelManager {
  if (!managerInstance) {
    managerInstance = new ModelManager(config)
  } else if (config && Object.keys(config).length > 0) {
    // 如果已经有实例但收到新的有效配置，重新初始化适配器
    // 这确保了在运行时配置更新时，模型管理器能正确地重新初始化
    managerInstance.initializeAdapters(config)
  }
  return managerInstance
}

/**
 * 重置模型管理器（主要用于测试或强制重新加载配置）
 */
export function resetModelManager (): void {
  managerInstance = null
}
