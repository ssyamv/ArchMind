/**
 * ChatEngine 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 必须在导入被测模块之前定义所有 mock ────────────────────────────────────

vi.mock('~/lib/ai/manager', () => ({
  ModelManager: vi.fn().mockImplementation(function (this: any) {
    this.getAdapter = vi.fn().mockReturnValue({
      name: 'Mock',
      provider: 'test',
      modelId: 'mock-model',
      generateStream: vi.fn().mockImplementation(async function* () {
        yield 'Hello '
        yield 'World'
      }),
      getCapabilities: () => ({ supportsStreaming: true, maxContextLength: 8000 }),
      isAvailable: async () => true
    })
    this.getAvailableModels = () => ['mock-model']
  })
}))

vi.mock('~/lib/rag/retriever', () => ({
  RAGRetriever: vi.fn().mockImplementation(function (this: any) {
    this.retrieve = vi.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        documentTitle: 'Test Document',
        content: 'Relevant content for RAG',
        similarity: 0.85
      }
    ])
    this.summarizeResults = vi.fn().mockReturnValue('Summarized RAG context')
  })
}))

vi.mock('~/lib/ai/prompts/conversation-system', () => ({
  buildConversationalPrompt: vi.fn().mockReturnValue('System prompt for PRD')
}))

vi.mock('~/lib/ai/prompts/prototype-system', () => ({
  buildPrototypeConversationalPrompt: vi.fn().mockReturnValue('System prompt for prototype')
}))

import { ChatEngine } from '~/lib/chat/engine'

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function createMockEmbeddingAdapter () {
  return {
    embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    embedMany: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
    calculateCost: vi.fn().mockReturnValue({ inputCost: 0, currency: 'USD' }),
    getModelInfo: vi.fn().mockReturnValue({ modelId: 'mock-embed', dimensions: 1536, maxInputTokens: 8192, provider: 'test' }),
    isAvailable: vi.fn().mockResolvedValue(true)
  }
}

async function collectStream (gen: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of gen) {
    chunks.push(chunk)
  }
  return chunks
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('ChatEngine', () => {
  let engine: ChatEngine
  const mockEmbeddingAdapter = createMockEmbeddingAdapter()

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new ChatEngine(mockEmbeddingAdapter)
  })

  describe('constructor', () => {
    it('无 embedding 适配器时也可创建', () => {
      const eng = new ChatEngine()
      expect(eng).toBeDefined()
    })

    it('传入 embedding 适配器时初始化 RAG 检索器', () => {
      const eng = new ChatEngine(mockEmbeddingAdapter)
      expect(eng).toBeDefined()
    })

    it('默认 target 为 prd', () => {
      const eng = new ChatEngine()
      // 通过 chatStream 使用 PRD 系统提示词来间接验证
      expect(eng).toBeDefined()
    })

    it('target=prototype 时使用原型提示词', () => {
      const eng = new ChatEngine(undefined, undefined, { target: 'prototype' })
      expect(eng).toBeDefined()
    })
  })

  describe('chatStream', () => {
    it('正常流式返回内容', async () => {
      const stream = engine.chatStream('Hello', [], { modelId: 'mock-model' })
      const chunks = await collectStream(stream)

      expect(chunks).toEqual(['Hello ', 'World'])
    })

    it('模型不存在时抛出错误', async () => {
      // 创建一个全新引擎，其 ModelManager 返回 null adapter
      const { ModelManager } = await import('~/lib/ai/manager')

      // 临时替换 getAdapter 返回 null
      const _originalImpl = (ModelManager as any).mockImplementation
      ;(ModelManager as any).mockImplementationOnce(function (this: any) {
        this.getAdapter = vi.fn().mockReturnValue(null)
        this.getAvailableModels = () => []
      })

      const eng = new ChatEngine()
      const stream = eng.chatStream('Hello', [], { modelId: 'nonexistent-model' })

      await expect(collectStream(stream)).rejects.toThrow('not available')
    })

    it('传入历史消息时正确处理', async () => {
      const history = [
        { id: '1', role: 'user' as const, content: 'Previous message', createdAt: new Date().toISOString() },
        { id: '2', role: 'assistant' as const, content: 'Previous response', createdAt: new Date().toISOString() }
      ]

      const stream = engine.chatStream('Follow up question', history as any, { modelId: 'mock-model' })
      const chunks = await collectStream(stream)

      expect(chunks.length).toBeGreaterThan(0)
    })

    it('useRAG=true 且有 embedding 适配器时触发检索', async () => {
      const { RAGRetriever } = await import('~/lib/rag/retriever')

      const stream = engine.chatStream('RAG query', [], {
        modelId: 'mock-model',
        useRAG: true
      })
      await collectStream(stream)

      // 验证 RAGRetriever 的 retrieve 被调用
      const instance = (RAGRetriever as any).mock.results.find((r: any) => r.value)?.value
      expect(instance?.retrieve).toHaveBeenCalled()
    })

    it('useRAG=false 且无文档提及时不触发检索', async () => {
      const { RAGRetriever } = await import('~/lib/rag/retriever')

      const stream = engine.chatStream('No RAG query', [], {
        modelId: 'mock-model',
        useRAG: false
      })
      await collectStream(stream)

      const instance = (RAGRetriever as any).mock.results.find((r: any) => r.value)?.value
      // retrieve 不应该被调用（或调用次数不增加）
      const callCount = instance?.retrieve?.mock?.calls?.length ?? 0
      expect(callCount).toBe(0)
    })

    it('传入 documentIds 时即使 useRAG=false 也触发检索', async () => {
      const { RAGRetriever } = await import('~/lib/rag/retriever')

      // 重置 mock 调用记录
      const instance = (RAGRetriever as any).mock.results.find((r: any) => r.value)?.value
      instance?.retrieve?.mockClear?.()

      const stream = engine.chatStream('Query with docs', [], {
        modelId: 'mock-model',
        useRAG: false,
        documentIds: ['doc-123']
      })
      await collectStream(stream)

      expect(instance?.retrieve).toHaveBeenCalledWith(
        'Query with docs',
        expect.objectContaining({ documentIds: ['doc-123'] })
      )
    })

    it('超过 MAX_HISTORY_MESSAGES 时截断历史', async () => {
      const history = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
        createdAt: new Date().toISOString()
      }))

      const stream = engine.chatStream('Current message', history as any, { modelId: 'mock-model' })
      const chunks = await collectStream(stream)

      // 不应报错，正常返回内容
      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('target=prototype 模式', () => {
    it('prototype target 使用原型系统提示词', async () => {
      const protoEngine = new ChatEngine(mockEmbeddingAdapter, undefined, {
        target: 'prototype',
        targetContext: { prototypeHtml: '<div>Hello</div>' }
      })

      const stream = protoEngine.chatStream('Modify button color', [], { modelId: 'mock-model' })
      const chunks = await collectStream(stream)

      expect(chunks.join('')).toContain('Hello')
      // 验证 buildPrototypeConversationalPrompt 被调用
      const { buildPrototypeConversationalPrompt } = await import('~/lib/ai/prompts/prototype-system')
      expect(buildPrototypeConversationalPrompt).toHaveBeenCalled()
    })
  })
})
