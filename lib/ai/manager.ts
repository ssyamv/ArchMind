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
  fallback: ['glm-4.5-air', 'qwen3-max', 'claude-sonnet-4-6'],
  preferences: {
    prd_generation: ['claude-sonnet-4-6', 'gpt-4.1', 'glm-4.7'],
    chinese_content: ['glm-4.7', 'qwen3-max', 'qwen3.5-plus', 'ernie-4.0-8k'],
    large_document: ['gemini-2.5-pro', 'gemini-2.0-flash', 'claude-sonnet-4-6'],
    cost_sensitive: ['glm-4.5-air', 'deepseek-chat', 'qwen3-max'],
    privacy_mode: ['ollama-llama3', 'ollama-qwen']
  },
  models: {
    'glm-4.7': { enabled: true, name: 'GLM-4.7', provider: 'Zhipu AI', description: '旗舰推理模型，355B MoE，200K 上下文，编码能力对标 Claude Sonnet 4.5，支持思考模式', api_key_env: 'GLM_API_KEY', capabilities: { maxContextLength: 200000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.1 / 1M tokens', output: '¥0.1 / 1M tokens' } },
    'glm-4.5-air': { enabled: true, name: 'GLM-4.5 Air', provider: 'Zhipu AI', description: '高性价比轻量模型，适合高并发低成本场景', api_key_env: 'GLM_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.05 / 1M tokens', output: '¥0.05 / 1M tokens' } },
    'claude-sonnet-4-6': { enabled: false, name: 'Claude Sonnet 4.6', provider: 'Anthropic', description: '最新平衡版，接近 Opus 4.6 的编码能力，1/5 的价格', api_key_env: 'ANTHROPIC_API_KEY', capabilities: { maxContextLength: 200000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '$3 / 1M tokens', output: '$15 / 1M tokens' } },
    'gpt-4.1': { enabled: false, name: 'GPT-4.1', provider: 'OpenAI', description: '编码专项优化，100 万 tokens 上下文', api_key_env: 'OPENAI_API_KEY', capabilities: { maxContextLength: 1000000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '$2 / 1M tokens', output: '$8 / 1M tokens' } },
    'gemini-2.5-pro': { enabled: false, name: 'Gemini 2.5 Pro', provider: 'Google', description: '最新思维旗舰，100 万 tokens 上下文，Deep Think 增强推理', api_key_env: 'GOOGLE_API_KEY', capabilities: { maxContextLength: 1000000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: true, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '$1.25 / 1M tokens', output: '$10 / 1M tokens' } },
    'qwen3-max': { enabled: false, name: 'Qwen3-Max', provider: 'Alibaba', description: '千问3系旗舰，原生 search/code agent，思考与非思考模式', api_key_env: 'DASHSCOPE_API_KEY', capabilities: { maxContextLength: 131072, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥24 / 1M tokens', output: '¥72 / 1M tokens' } },
    'deepseek-chat': { enabled: false, name: 'DeepSeek V3.2', provider: 'DeepSeek', description: '最新通用模型，工具调用集成思考，高性价比', api_key_env: 'DEEPSEEK_API_KEY', capabilities: { maxContextLength: 128000, supportsStreaming: true, supportsStructuredOutput: true, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥0.5 / 1M tokens', output: '¥2 / 1M tokens' } },
    'ernie-4.0-8k': { enabled: false, name: '文心 ERNIE 4.0', provider: 'Baidu', description: '百度旗舰大模型，中文理解深度强', api_key_env: 'BAIDU_API_KEY', capabilities: { maxContextLength: 8192, supportsStreaming: true, supportsStructuredOutput: false, supportsVision: false, supportedLanguages: ['zh', 'en'] }, costEstimate: { input: '¥30 / 1M tokens', output: '¥60 / 1M tokens' } }
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

    // 先构建新的 Map，完成后原子替换 this.adapters
    // 避免 clear() 后填充期间存在"空适配器"的中间状态
    const newAdapters = new Map<string, AIModelAdapter>()

    // Claude 适配器
    if (config.anthropicApiKey) {
      const baseUrl = config.anthropicBaseUrl as string | undefined
      const userModels: string[] = config.anthropicModels?.length
        ? config.anthropicModels
        : ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5']
      for (const modelId of userModels) {
        const claude = new ClaudeAdapter(config.anthropicApiKey as string, modelId, baseUrl)
        newAdapters.set(modelId, claude)
      }
    }

    // OpenAI 适配器
    if (config.openaiApiKey) {
      const baseUrl = config.openaiBaseUrl as string | undefined
      const userModels: string[] = config.openaiModels?.length
        ? config.openaiModels
        : ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'o3', 'o4-mini', 'o3-mini']
      for (const modelId of userModels) {
        const openai = new OpenAIAdapter(config.openaiApiKey as string, modelId, baseUrl)
        newAdapters.set(modelId, openai)
      }
    }

    // Gemini 适配器
    if (config.googleApiKey) {
      const userModels: string[] = config.googleModels?.length
        ? config.googleModels
        : ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
      for (const modelId of userModels) {
        const gemini = new GeminiAdapter(config.googleApiKey as string, modelId)
        newAdapters.set(modelId, gemini)
      }
    }

    // GLM 适配器
    if (config.glmApiKey) {
      const baseUrl = config.glmBaseUrl as string | undefined
      const userModels: string[] = config.glmModels?.length
        ? config.glmModels
        : ['glm-4.7', 'glm-4.6v', 'glm-4.5-air']
      for (const modelId of userModels) {
        const glm = new GLMAdapter(config.glmApiKey as string, modelId, baseUrl)
        newAdapters.set(modelId, glm)
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
        newAdapters.set(modelId, deepseek)
      }
    }

    // 通义千问 (Qwen) 适配器
    if (config.dashscopeApiKey) {
      const userModels: string[] = config.qwenModels?.length
        ? config.qwenModels
        : ['qwen3.5-plus', 'qwen3-max']
      for (const modelId of userModels) {
        const qwen = new QwenAdapter(config.dashscopeApiKey as string, modelId)
        newAdapters.set(modelId, qwen)
      }
    }

    // 文心一言 (Wenxin) 适配器
    if (config.baiduApiKey) {
      const userModels: string[] = config.wenxinModels?.length
        ? config.wenxinModels
        : ['ernie-4.0-8k', 'ernie-3.5-8k']
      for (const modelId of userModels) {
        const wenxin = new WenxinAdapter(config.baiduApiKey as string, modelId)
        newAdapters.set(modelId, wenxin)
      }
    }

    // Ollama 本地模型适配器
    if (config.ollamaBaseUrl) {
      const userModels: string[] = config.ollamaModels?.length
        ? config.ollamaModels
        : ['llama3.3', 'qwen3', 'qwen2.5', 'glm4', 'deepseek-r1']
      for (const modelId of userModels) {
        const ollama = new OllamaAdapter(config.ollamaBaseUrl as string, modelId)
        newAdapters.set(`ollama-${modelId}`, ollama)
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
        newAdapters.set(`custom-${modelId}`, custom)
      }
    }

    // 原子替换，避免 clear+fill 之间的中间状态
    this.adapters = newAdapters
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
      prd_generation: 'claude-sonnet-4-6', // PRD 生成优先使用 Claude
      chinese_content: 'glm-4.7', // 中文内容优先使用 GLM（成本低廉）
      large_document: 'gemini-2.5-pro', // 大文件优先使用 Gemini
      general: 'gpt-4.1' // 通用使用 GPT-4.1
    }

    const modelId = modelMap[taskType] || 'claude-sonnet-4-6'
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
    // 有新配置时，在同一实例上原子替换适配器（initializeAdapters 内部用新 Map 替换）
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
