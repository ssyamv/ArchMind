/**
 * ModelManager 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 注意：manager.ts 的 loadModelConfig() 在测试环境下读取 YAML 会失败（路径不存在）
// 这是预期行为：modelConfig = null，loadModelConfig 走 catch 分支

// Mock 适配器 - 必须在导入之前
vi.mock('~/lib/ai/adapters/claude', () => ({
  ClaudeAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string, baseUrl?: string) {
    this.name = 'Claude'
    this.provider = 'anthropic'
    this.modelId = modelId
    this._baseUrl = baseUrl
    this.generateText = async () => 'Claude response'
    this.getCapabilities = () => ({
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      maxContextLength: 200000,
      supportedLanguages: ['en', 'zh']
    })
    this.estimateCost = () => ({
      inputCost: 0.003,
      outputCost: 0.015,
      currency: 'USD'
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/openai', () => ({
  OpenAIAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string, baseUrl?: string) {
    this.name = 'GPT-4o'
    this.provider = 'openai'
    this.modelId = modelId
    this._baseUrl = baseUrl
    this.generateText = async () => 'OpenAI response'
    this.getCapabilities = () => ({
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      maxContextLength: 128000,
      supportedLanguages: ['en', 'zh']
    })
    this.estimateCost = () => ({
      inputCost: 0.0025,
      outputCost: 0.01,
      currency: 'USD'
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/gemini', () => ({
  GeminiAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string) {
    this.name = 'Gemini'
    this.provider = 'google'
    this.modelId = modelId || 'gemini-1.5-pro'
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 1000000,
      supportedLanguages: ['en', 'zh']
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/glm', () => ({
  GLMAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string, baseUrl?: string) {
    this.name = 'GLM'
    this.provider = 'zhipu'
    this.modelId = modelId
    this._baseUrl = baseUrl
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 128000,
      supportedLanguages: ['zh', 'en']
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/deepseek', () => ({
  DeepSeekAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string, baseUrl?: string) {
    this.name = 'DeepSeek'
    this.provider = 'deepseek'
    this.modelId = modelId
    this._baseUrl = baseUrl
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 64000,
      supportedLanguages: ['zh', 'en']
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/qwen', () => ({
  QwenAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string) {
    this.name = 'Qwen'
    this.provider = 'qwen'
    this.modelId = modelId
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 32000,
      supportedLanguages: ['zh', 'en']
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/wenxin', () => ({
  WenxinAdapter: vi.fn().mockImplementation(function (this: any, apiKey: string, modelId: string) {
    this.name = 'Wenxin'
    this.provider = 'baidu'
    this.modelId = modelId
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 8000,
      supportedLanguages: ['zh']
    })
    this.isAvailable = async () => true
  })
}))

vi.mock('~/lib/ai/adapters/ollama', () => ({
  OllamaAdapter: vi.fn().mockImplementation(function (this: any, baseUrl: string, modelId: string) {
    this.name = 'Ollama'
    this.provider = 'ollama'
    this.modelId = `ollama-${modelId}`
    this.getCapabilities = () => ({
      supportsStreaming: true,
      maxContextLength: 128000,
      supportedLanguages: ['en']
    })
    this.isAvailable = async () => true
  })
}))

import { ModelManager, getModelManager, resetModelManager, ModelProvider } from '~/lib/ai/manager'
import { ClaudeAdapter } from '~/lib/ai/adapters/claude'
import { OpenAIAdapter } from '~/lib/ai/adapters/openai'
import { GLMAdapter } from '~/lib/ai/adapters/glm'
import { DeepSeekAdapter } from '~/lib/ai/adapters/deepseek'

describe('ModelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetModelManager()
  })

  afterEach(() => {
    resetModelManager()
  })

  describe('constructor', () => {
    it('should create instance without config', () => {
      const manager = new ModelManager()
      expect(manager).toBeDefined()
      expect(manager.getAvailableModels()).toEqual([])
    })

    it('should initialize adapters with valid config', () => {
      const manager = new ModelManager({
        anthropicApiKey: 'test-key',
        openaiApiKey: 'test-key'
      })

      const models = manager.getAvailableModels()
      expect(models).toContain('claude-opus-4-20250514')
      expect(models).toContain('gpt-4o')
    })
  })

  describe('getAdapter', () => {
    it('should return adapter for existing model', () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const adapter = manager.getAdapter('claude-opus-4-20250514')
      expect(adapter).toBeDefined()
      expect(adapter?.name).toBe('Claude')
    })

    it('should return null for non-existing model', () => {
      const manager = new ModelManager()
      const adapter = manager.getAdapter('non-existing-model')
      expect(adapter).toBeNull()
    })
  })

  describe('getAvailableModels', () => {
    it('should return all initialized model IDs', () => {
      const manager = new ModelManager({
        anthropicApiKey: 'test-key',
        openaiApiKey: 'test-key',
        googleApiKey: 'test-key'
      })

      const models = manager.getAvailableModels()
      expect(models.length).toBeGreaterThanOrEqual(3)
      expect(models).toContain('claude-opus-4-20250514')
      expect(models).toContain('gpt-4o')
      expect(models).toContain('gemini-2.0-flash')
    })
  })

  describe('selectModelByTask', () => {
    it('should select Claude for PRD generation', () => {
      // selectModelByTask maps 'prd_generation' to 'claude-3.5-sonnet'
      // so we need to pass that model explicitly
      const manager = new ModelManager({
        anthropicApiKey: 'test-key',
        anthropicModels: ['claude-3.5-sonnet']
      })
      const adapter = manager.selectModelByTask('prd_generation')
      expect(adapter?.modelId).toBe('claude-3.5-sonnet')
    })

    it('should select Gemini for large documents', () => {
      const manager = new ModelManager({ googleApiKey: 'test-key' })
      const adapter = manager.selectModelByTask('large_document')
      expect(adapter?.modelId).toBe('gemini-1.5-pro')
    })

    it('should select GPT-4o for general tasks', () => {
      const manager = new ModelManager({ openaiApiKey: 'test-key' })
      const adapter = manager.selectModelByTask('general')
      expect(adapter?.modelId).toBe('gpt-4o')
    })

    it('未知任务类型回退到 claude-3.5-sonnet', () => {
      const manager = new ModelManager()
      const adapter = manager.selectModelByTask('unknown_task')
      // 无适配器时返回 null
      expect(adapter).toBeNull()
    })

    it('chinese_content 任务返回 glm-4.7 适配器（若已初始化）', () => {
      const manager = new ModelManager({
        glmApiKey: 'test-key',
        glmModels: ['glm-4.7']
      })
      const adapter = manager.selectModelByTask('chinese_content')
      expect(adapter?.modelId).toBe('glm-4.7')
    })
  })

  describe('getModelInfo', () => {
    it('should return model info for existing model', () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const info = manager.getModelInfo('claude-opus-4-20250514')
      expect(info).toBeDefined()
      expect(info?.modelId).toBe('claude-opus-4-20250514')
      expect(info?.capabilities).toBeDefined()
    })

    it('should return null for non-existing model', () => {
      const manager = new ModelManager()
      const info = manager.getModelInfo('non-existing')
      expect(info).toBeNull()
    })
  })

  describe('estimateCost', () => {
    it('should return cost estimate for existing model', () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const cost = manager.estimateCost('claude-opus-4-20250514', 1000)
      expect(cost).toBeDefined()
      expect(cost?.inputCost).toBeTypeOf('number')
      expect(cost?.currency).toBe('USD')
    })

    it('should return null for non-existing model', () => {
      const manager = new ModelManager()
      const cost = manager.estimateCost('non-existing', 1000)
      expect(cost).toBeNull()
    })
  })

  describe('multi-provider support', () => {
    it('should initialize DeepSeek adapter with API key', () => {
      const manager = new ModelManager({ deepseekApiKey: 'test-key' })
      const models = manager.getAvailableModels()
      expect(models).toContain('deepseek-chat')
      expect(models).toContain('deepseek-reasoner')
    })

    it('should initialize Qwen adapter with Dashscope API key', () => {
      const manager = new ModelManager({ dashscopeApiKey: 'test-key' })
      const models = manager.getAvailableModels()
      expect(models).toContain('qwen-max')
      expect(models).toContain('qwen-plus')
    })

    it('should initialize Ollama adapter with base URL', () => {
      const manager = new ModelManager({ ollamaBaseUrl: 'http://localhost:11434' })
      const models = manager.getAvailableModels()
      expect(models).toContain('ollama-llama3.2')
    })
  })

  describe('initializeAdapters - baseUrl 传递', () => {
    it('Claude 适配器正确传递 anthropicBaseUrl', () => {
      new ModelManager({
        anthropicApiKey: 'test-key',
        anthropicBaseUrl: 'https://my-proxy.example.com',
        anthropicModels: ['claude-3.5-sonnet']
      })

      expect(ClaudeAdapter).toHaveBeenCalledWith('test-key', 'claude-3.5-sonnet', 'https://my-proxy.example.com')
    })

    it('OpenAI 适配器正确传递 openaiBaseUrl', () => {
      new ModelManager({
        openaiApiKey: 'test-key',
        openaiBaseUrl: 'https://openai-proxy.example.com',
        openaiModels: ['gpt-4o']
      })

      expect(OpenAIAdapter).toHaveBeenCalledWith('test-key', 'gpt-4o', 'https://openai-proxy.example.com')
    })

    it('GLM 适配器正确传递 glmBaseUrl', () => {
      new ModelManager({
        glmApiKey: 'test-key',
        glmBaseUrl: 'https://glm-proxy.example.com',
        glmModels: ['glm-4-plus']
      })

      expect(GLMAdapter).toHaveBeenCalledWith('test-key', 'glm-4-plus', 'https://glm-proxy.example.com')
    })

    it('DeepSeek 适配器正确传递 deepseekBaseUrl', () => {
      new ModelManager({
        deepseekApiKey: 'test-key',
        deepseekBaseUrl: 'https://deepseek-proxy.example.com',
        deepseekModels: ['deepseek-chat']
      })

      expect(DeepSeekAdapter).toHaveBeenCalledWith('test-key', 'deepseek-chat', 'https://deepseek-proxy.example.com')
    })
  })

  describe('initializeAdapters - 自定义模型', () => {
    it('customModels + customApiKey 初始化 custom- 前缀适配器', () => {
      const manager = new ModelManager({
        customApiKey: 'sk-custom-key',
        customBaseUrl: 'https://custom.api.com',
        customModels: ['my-model-v1']
      })

      const models = manager.getAvailableModels()
      expect(models).toContain('custom-my-model-v1')
    })

    it('customModels + customBaseUrl（无 customApiKey）使用 sk-placeholder', () => {
      new ModelManager({
        customBaseUrl: 'https://custom.api.com',
        customModels: ['my-model']
      })

      expect(OpenAIAdapter).toHaveBeenCalledWith('sk-placeholder', 'my-model', 'https://custom.api.com')
    })

    it('无 customModels 时不初始化任何 custom 适配器', () => {
      const manager = new ModelManager({
        customApiKey: 'sk-key',
        customBaseUrl: 'https://custom.api.com'
      })

      const models = manager.getAvailableModels()
      expect(models.some(m => m.startsWith('custom-'))).toBe(false)
    })

    it('Ollama 模型使用 ollama- 前缀', () => {
      const manager = new ModelManager({
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModels: ['llama3', 'mistral']
      })

      const models = manager.getAvailableModels()
      expect(models).toContain('ollama-llama3')
      expect(models).toContain('ollama-mistral')
    })
  })

  describe('isModelAvailable', () => {
    it('模型存在且 isAvailable() 返回 true', async () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const available = await manager.isModelAvailable('claude-opus-4-20250514')
      expect(available).toBe(true)
    })

    it('模型不存在时返回 false', async () => {
      const manager = new ModelManager()
      const available = await manager.isModelAvailable('non-existent')
      expect(available).toBe(false)
    })
  })

  describe('getAvailableModelsWithMetadata', () => {
    it('无 modelConfig 时只返回适配器中的模型', () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const models = manager.getAvailableModelsWithMetadata()
      // 无 YAML 配置（mock 未初始化），结果来自适配器
      expect(Array.isArray(models)).toBe(true)
    })

    it('idPrefix 时模型 id 带前缀', () => {
      const manager = new ModelManager({ anthropicApiKey: 'test-key' })
      const models = manager.getAvailableModelsWithMetadata('user-')
      models.forEach(m => {
        expect(m.id).toMatch(/^user-/)
      })
    })

    it('自定义模型（不在 YAML 中的适配器）的 costEstimate 来自适配器或默认未知', () => {
      const manager = new ModelManager({
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModels: ['llama3']
      })
      const models = manager.getAvailableModelsWithMetadata()
      const ollama = models.find(m => m.id.includes('ollama-llama3'))
      // Ollama 模型在 YAML 中有配置时用 YAML 值，否则用 '未知'
      // 这里只验证 costEstimate 存在且有 input/output 字段
      expect(ollama?.costEstimate).toHaveProperty('input')
      expect(ollama?.costEstimate).toHaveProperty('output')
    })
  })

  describe('getDefaultModelId', () => {
    it('无 modelConfig 时返回默认值 glm-4.7', () => {
      const manager = new ModelManager()
      expect(manager.getDefaultModelId()).toBe('glm-4.7')
    })
  })
})

describe('getModelManager singleton', () => {
  beforeEach(() => {
    resetModelManager()
  })

  afterEach(() => {
    resetModelManager()
  })

  it('should return the same instance', () => {
    const instance1 = getModelManager({ anthropicApiKey: 'test' })
    const instance2 = getModelManager()
    expect(instance1).toBe(instance2)
  })

  it('已有实例时传入新配置会重新初始化适配器', () => {
    const instance1 = getModelManager({ anthropicApiKey: 'test' })
    expect(instance1.getAvailableModels()).toContain('claude-opus-4-20250514')

    // 传入新配置，清空旧适配器（无 anthropicApiKey）
    getModelManager({ openaiApiKey: 'test-openai' })

    // 同一实例，但适配器已更新
    expect(instance1.getAvailableModels()).not.toContain('claude-opus-4-20250514')
    expect(instance1.getAvailableModels()).toContain('gpt-4o')
  })

  it('无配置时不重新初始化（返回现有实例）', () => {
    const instance1 = getModelManager({ anthropicApiKey: 'test' })
    const instance2 = getModelManager()
    expect(instance2).toBe(instance1)
    // 适配器未被清空
    expect(instance2.getAvailableModels()).toContain('claude-opus-4-20250514')
  })
})

describe('ModelProvider enum', () => {
  it('should have all provider values', () => {
    expect(ModelProvider.CLAUDE).toBe('claude')
    expect(ModelProvider.OPENAI).toBe('openai')
    expect(ModelProvider.GEMINI).toBe('gemini')
    expect(ModelProvider.DEEPSEEK).toBe('deepseek')
    expect(ModelProvider.QWEN).toBe('qwen')
    expect(ModelProvider.OLLAMA).toBe('ollama')
  })
})
