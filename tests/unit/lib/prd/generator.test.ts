/**
 * PRD Generator 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPRDPrompt, PRD_SYSTEM_PROMPT } from '~/lib/ai/prompts/prd-system'

// Mock 依赖 - 必须在导入之前
vi.mock('~/lib/ai/manager', () => ({
  ModelManager: vi.fn().mockImplementation(function (this: any) {
    this.getAdapter = () => ({
      name: 'Mock',
      provider: 'test',
      modelId: 'mock-model',
      generateText: async () => 'Generated PRD content',
      generateStream: async function* (): AsyncGenerator<string> {
        yield 'Mock '
        yield 'stream '
        yield 'response'
      },
      getCapabilities: () => ({
        supportsStreaming: true,
        maxContextLength: 8000,
        supportedLanguages: ['en', 'zh']
      }),
      estimateCost: () => ({
        inputCost: 0.01,
        outputCost: 0.02,
        currency: 'USD'
      }),
      isAvailable: async () => true
    })
    this.estimateCost = () => ({
      inputCost: 0.01,
      outputCost: 0.02,
      currency: 'USD'
    })
    this.getAvailableModels = () => ['mock-model']
  })
}))

vi.mock('~/lib/rag/retriever', () => ({
  RAGRetriever: vi.fn().mockImplementation(function (this: any) {
    this.retrieve = async () => [
      { id: 'chunk-1', documentId: 'doc-1', content: 'Test content', similarity: 0.85 }
    ]
    this.summarizeResults = () => 'Summarized context'
  })
}))

vi.mock('~/lib/db/dao/prd-dao', () => ({
  PRDDAO: {
    create: async () => ({
      id: 'prd-test-123',
      title: 'Test PRD',
      content: 'Generated content',
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    addReferences: async () => undefined,
    createWithClient: async () => ({
      id: 'prd-test-123',
      title: 'Test PRD',
      content: 'Generated content',
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    addReferencesWithClient: async () => undefined
  }
}))

vi.mock('~/lib/db/client', () => ({
  dbClient: {
    transaction: async (fn: (client: any) => Promise<any>) => fn({})
  }
}))

vi.mock('~/lib/db/dao/document-dao', () => ({
  DocumentDAO: {
    findById: async () => ({
      id: 'doc-1',
      content: 'Document content for testing'
    })
  }
}))

import { PRDGenerator } from '~/lib/prd/generator'

describe('buildPRDPrompt', () => {
  it('should build prompt with user input only', () => {
    const prompt = buildPRDPrompt('Create a login feature', '')

    expect(prompt).toContain('Create a login feature')
    expect(prompt).toContain(PRD_SYSTEM_PROMPT)
  })

  it('should build prompt with background context', () => {
    const context = 'Previous document about authentication system'
    const prompt = buildPRDPrompt('Create SSO feature', context)

    expect(prompt).toContain('Create SSO feature')
    expect(prompt).toContain(context)
    expect(prompt).toContain('背景信息')
  })

  it('should include few-shot examples when provided', () => {
    const examples = [
      {
        userInput: 'Example input',
        context: 'Example context',
        prdOutput: 'Example PRD output'
      }
    ]

    const prompt = buildPRDPrompt('Test input', '', examples)

    expect(prompt).toContain('参考示例')
    expect(prompt).toContain('Example input')
    expect(prompt).toContain('Example PRD output')
  })

  it('should include thinking process instructions', () => {
    const prompt = buildPRDPrompt('Test', '')

    expect(prompt).toContain('思考过程')
    expect(prompt).toContain('需求解析')
    expect(prompt).toContain('逻辑建模')
  })

  it('should handle empty user input', () => {
    const prompt = buildPRDPrompt('', '')

    expect(prompt).toBeDefined()
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('should handle special characters in input', () => {
    const specialInput = 'Create feature with **markdown** and `code` and {{variables}}'
    const prompt = buildPRDPrompt(specialInput, '')

    expect(prompt).toContain(specialInput)
  })
})

describe('PRD_SYSTEM_PROMPT', () => {
  it('should contain role definition', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('角色定义')
    expect(PRD_SYSTEM_PROMPT).toContain('Alex Chen')
  })

  it('should contain core capabilities', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('核心能力')
    expect(PRD_SYSTEM_PROMPT).toContain('需求深度分析')
    expect(PRD_SYSTEM_PROMPT).toContain('逻辑建模与补全')
  })

  it('should contain PRD output standards', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('PRD 输出标准')
    expect(PRD_SYSTEM_PROMPT).toContain('产品概述')
    expect(PRD_SYSTEM_PROMPT).toContain('核心功能')
    expect(PRD_SYSTEM_PROMPT).toContain('成功指标')
  })

  it('should contain quality standards', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('质量标准')
    expect(PRD_SYSTEM_PROMPT).toContain('完整性')
    expect(PRD_SYSTEM_PROMPT).toContain('可执行性')
  })

  it('should contain constraints', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('约束条件')
    expect(PRD_SYSTEM_PROMPT).toContain('3000-6000 字')
    expect(PRD_SYSTEM_PROMPT).toContain('SMART 原则')
  })
})

// ─── 辅助：访问私有方法 ───────────────────────────────────────────────────────

function callPrivate<T>(instance: any, method: string, ...args: any[]): T {
  return instance[method](...args) as T
}

describe('PRDGenerator', () => {
  let generator: PRDGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    generator = new PRDGenerator()
  })

  describe('constructor', () => {
    it('should create generator without embedding adapter', () => {
      const gen = new PRDGenerator()
      expect(gen).toBeDefined()
    })

    it('should create generator with embedding adapter', () => {
      const mockEmbedding = { embed: vi.fn(), model: 'mock', dimensions: 128 }
      const gen = new PRDGenerator(mockEmbedding as any)
      expect(gen).toBeDefined()
    })
  })

  describe('estimateTokens (private)', () => {
    it('纯英文文本：按4字符/token估算', () => {
      const tokens = callPrivate<number>(generator, 'estimateTokens', 'hello world test')
      expect(tokens).toBe(Math.ceil(16 / 4))
    })

    it('纯中文文本：按2字符/token估算', () => {
      const tokens = callPrivate<number>(generator, 'estimateTokens', '用户登录功能')
      expect(tokens).toBe(Math.ceil(6 / 2))
    })

    it('中英混合文本：分别估算后相加', () => {
      // '用户login功能': 用户(2中文) + login(5英文) + 功能(2中文) = 4中文 + 5英文
      const text = '用户login功能'
      const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length // 4
      const englishChars = text.length - chineseChars // 5
      const expected = Math.ceil(chineseChars / 2 + englishChars / 4)
      const tokens = callPrivate<number>(generator, 'estimateTokens', text)
      expect(tokens).toBe(expected)
    })

    it('空字符串返回0', () => {
      const tokens = callPrivate<number>(generator, 'estimateTokens', '')
      expect(tokens).toBe(0)
    })
  })

  describe('allocateTokenBudget (private) - #52', () => {
    it('无 options 时使用默认 8000 maxTokens，context 预算为 5000', () => {
      const budget = callPrivate<any>(generator, 'allocateTokenBudget', undefined)
      expect(budget.output).toBe(8000)
      expect(budget.systemPrompt).toBe(1500)
      expect(budget.context).toBe(5000) // #52：从 4000 增加至 5000
      expect(budget.examples).toBe(1500) // #52：从 2000 减少至 1500
    })

    it('传入 maxTokens 时 output 使用该值', () => {
      const budget = callPrivate<any>(generator, 'allocateTokenBudget', { maxTokens: 4000 })
      expect(budget.output).toBe(4000)
    })
  })

  describe('compressContext (private) - #52 语义感知上下文压缩', () => {
    it('全量上下文：token 数 <= maxTokens 时直接返回原内容', () => {
      const short = '## 功能需求\n这是一段短上下文'
      const result = callPrivate<string>(generator, 'compressContext', short, 5000)
      expect(result).toBe(short)
    })

    it('超预算压缩：高分段落（含关键词+数据指标）优先保留', () => {
      // 构造超出 token 预算的 Markdown 内容
      // 高分段落：标题含"功能"（+0.3），正文含数字（+0.2），长度适中（+0.1）
      const highScoreSection = '## 核心功能需求\n转化率提升 25%，DAU 增长 30%，关键用户路径优化。用户可以完成注册、登录、修改密码等操作。'
      // 低分段落：标题和正文都无关键词，长度适中
      const lowScoreSection = '## 其他说明\n' + '这是补充说明内容。'.repeat(10)
      // 超大填充，使总体超出 maxTokens
      const padding = '## 无关章节\n' + 'X'.repeat(3000)

      const context = [highScoreSection, lowScoreSection, padding].join('\n\n')
      // maxTokens=100，只能保留少量内容
      const result = callPrivate<string>(generator, 'compressContext', context, 100)

      // 高分段落应当被保留
      expect(result).toContain('核心功能需求')
    })

    it('边界：仅有一段（无 ## 标题）时退化为简单截取', () => {
      const longText = 'A'.repeat(10000) // 纯文本，无标题
      const result = callPrivate<string>(generator, 'compressContext', longText, 50)
      // 退化截取，结果应包含截取标记
      expect(result).toContain('...[内容过长已截取]')
      expect(result.length).toBeLessThan(longText.length)
    })

    it('单段超预算时截取前 maxTokens * 1.5 字符并追加截取标记', () => {
      // 单个超大段落（有标题但内容超大）
      const hugeSection = '## 功能列表\n' + 'B'.repeat(20000)
      const result = callPrivate<string>(generator, 'compressContext', hugeSection, 100)
      expect(result).toContain('...[内容过长已截取]')
    })

    it('选中段落按原文顺序排列', () => {
      // 构造三个段落，第1、3段高分，第2段低分
      const sec1 = '## 用户需求分析\n转化率 80%，DAU 10万，用户故事清晰。'
      const sec2 = '## 概念说明\n这是一段概念性描述，没有特别关键的内容。'
      const sec3 = '## 目标功能定义\n功能覆盖 KPI 目标，指标完备，场景 5 个。'
      const context = [sec1, sec2, sec3].join('\n\n')
      // maxTokens 足够保留两个高分段落
      const result = callPrivate<string>(generator, 'compressContext', context, 200)

      // 如果两个段落都保留，sec1 应在 sec3 前面
      if (result.includes('用户需求分析') && result.includes('目标功能定义')) {
        expect(result.indexOf('用户需求分析')).toBeLessThan(result.indexOf('目标功能定义'))
      }
    })
  })

  describe('generate', () => {
    it('should generate PRD with minimal options', async () => {
      const result = await generator.generate('Create a user login feature')

      expect(result).toHaveProperty('prdId')
      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('model')
      expect(result).toHaveProperty('tokenCount')
      expect(result).toHaveProperty('estimatedCost')
      expect(result).toHaveProperty('generationTime')
      expect(result).toHaveProperty('references')
    })

    it('should use custom temperature and maxTokens', async () => {
      const result = await generator.generate('Test input', {
        temperature: 0.5,
        maxTokens: 4000
      })

      expect(result).toBeDefined()
    })

    it('useRAG=true 时调用 RAG 检索器', async () => {
      const mockEmbedding = { embed: vi.fn().mockResolvedValue([0.1, 0.2]), model: 'mock', dimensions: 2 }
      const genWithRAG = new PRDGenerator(mockEmbedding as any)
      const result = await genWithRAG.generate('Build user system', { useRAG: true, userId: 'user-1' })
      // RAG 检索器被 mock，应正常生成
      expect(result).toHaveProperty('prdId')
      expect(result.references).toContain('doc-1')
    })

    it('useRAG=true 但 ragRetriever=null 时不调用检索', async () => {
      // 无 embeddingAdapter 时 ragRetriever 为 null
      const result = await generator.generate('Build feature', { useRAG: true })
      expect(result).toHaveProperty('prdId')
      expect(result.references).toHaveLength(0)
    })

    it('传入 documentIds 时加载指定文档', async () => {
      const result = await generator.generate('Build feature', {
        documentIds: ['doc-1', 'doc-2']
      })
      expect(result).toHaveProperty('prdId')
      expect(result.references).toEqual(['doc-1', 'doc-2'])
    })

    it('指定 userId 和 workspaceId 时保存到 PRD', async () => {
      const result = await generator.generate('Build feature', {
        userId: 'user-123',
        workspaceId: 'ws-456'
      })
      expect(result).toHaveProperty('prdId', 'prd-test-123')
    })

    it('模型不存在时抛出错误', async () => {
      // 让 getAdapter 对指定模型返回 null
      const { ModelManager } = await import('~/lib/ai/manager')
      vi.mocked(ModelManager).mockImplementationOnce(function (this: any) {
        this.getAdapter = () => null
        this.estimateCost = () => null
        this.getAvailableModels = () => []
      })
      const gen = new PRDGenerator()
      await expect(
        gen.generate('Test', { model: 'non-existent-model' })
      ).rejects.toThrow('Model non-existent-model not available')
    })

    it('tokenCount 和 estimatedCost 正确返回', async () => {
      const result = await generator.generate('Test input')
      expect(result.tokenCount).toBeGreaterThan(0)
      expect(result.estimatedCost).toBe(0.01)
    })
  })

  describe('generateStream', () => {
    it('should yield chunks from stream', async () => {
      const chunks: string[] = []
      const stream = generator.generateStream('Test input')

      for await (const chunk of stream) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('Mock')
    })

    it('useRAG=true 时流式生成也调用 RAG 检索', async () => {
      const mockEmbedding = { embed: vi.fn().mockResolvedValue([0.1, 0.2]), model: 'mock', dimensions: 2 }
      const genWithRAG = new PRDGenerator(mockEmbedding as any)
      const chunks: string[] = []
      for await (const chunk of genWithRAG.generateStream('Build system', { useRAG: true })) {
        chunks.push(chunk)
      }
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('流式生成传入 documentIds 时构建上下文', async () => {
      const chunks: string[] = []
      for await (const chunk of generator.generateStream('Build feature', {
        documentIds: ['doc-1']
      })) {
        chunks.push(chunk)
      }
      expect(chunks.join('')).toContain('Mock')
    })

    it('流式生成模型不存在时抛出错误', async () => {
      const { ModelManager } = await import('~/lib/ai/manager')
      vi.mocked(ModelManager).mockImplementationOnce(function (this: any) {
        this.getAdapter = () => null
        this.estimateCost = () => null
        this.getAvailableModels = () => []
      })
      const gen = new PRDGenerator()
      const stream = gen.generateStream('Test', { model: 'non-existent-model' })
      await expect(stream.next()).rejects.toThrow('Model non-existent-model not available')
    })

    it('PRDDAO.create 失败时抛出错误', async () => {
      // 直接 spy 模块 mock 对象上的方法（现在 generateStream 调用 createWithClient）
      const prdDaoMod = await import('~/lib/db/dao/prd-dao')
      const originalCreate = prdDaoMod.PRDDAO.createWithClient
      prdDaoMod.PRDDAO.createWithClient = vi.fn().mockRejectedValueOnce(new Error('DB error')) as any

      const stream = generator.generateStream('Test input')
      const chunks: string[] = []
      await expect(async () => {
        for await (const chunk of stream) {
          chunks.push(chunk)
        }
      }).rejects.toThrow('DB error')

      prdDaoMod.PRDDAO.createWithClient = originalCreate
    })

    it('PRDDAO.addReferences 失败时不影响流式结果', async () => {
      const prdDaoMod = await import('~/lib/db/dao/prd-dao')
      const originalAddReferences = prdDaoMod.PRDDAO.addReferencesWithClient
      prdDaoMod.PRDDAO.addReferencesWithClient = vi.fn().mockRejectedValueOnce(new Error('Ref error')) as any

      const chunks: string[] = []
      // 有 documentIds 才会调用 addReferencesWithClient
      for await (const chunk of generator.generateStream('Test', { documentIds: ['doc-1'] })) {
        chunks.push(chunk)
      }
      // 流式内容正常输出（addReferencesWithClient 错误被 catch 吞掉）
      expect(chunks.join('')).toContain('Mock')

      prdDaoMod.PRDDAO.addReferencesWithClient = originalAddReferences
    })

    it('自定义 temperature 和 maxTokens', async () => {
      const chunks: string[] = []
      for await (const chunk of generator.generateStream('Test', {
        temperature: 0.3,
        maxTokens: 2000
      })) {
        chunks.push(chunk)
      }
      expect(chunks.length).toBeGreaterThan(0)
    })
  })
})
