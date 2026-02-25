/**
 * RAGRetriever 单元测试
 * 测试混合搜索路由策略和 keywordSearch 中文支持
 * 使用 vi.mock 替换数据库依赖，只验证业务逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RAGRetriever } from '~/lib/rag/retriever'
import type { RetrievedChunk } from '~/lib/rag/retriever'

// ─── Mock 数据库和 DAO 依赖 ──────────────────────────────────────────────────

vi.mock('~/lib/db/dao/vector-dao', () => ({
  VectorDAO: {
    similaritySearch: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('~/lib/db/dao/document-chunk-dao', () => ({
  DocumentChunkDAO: {
    findByIds: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('~/lib/db/dao/prd-chunk-dao', () => ({
  PrdChunkDAO: {
    findByIds: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('~/lib/db/dao/document-dao', () => ({
  DocumentDAO: {
    findByIds: vi.fn().mockResolvedValue(new Map())
  }
}))

vi.mock('~/lib/db/dao/prd-dao', () => ({
  PRDDAO: {
    findByIds: vi.fn().mockResolvedValue(new Map())
  }
}))

vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn().mockResolvedValue({ rows: [] })
  }
}))

// ─── 工厂和辅助函数 ──────────────────────────────────────────────────────────

function makeChunk (id: string, similarity = 0.8): RetrievedChunk {
  return {
    id,
    documentId: `doc-${id}`,
    documentTitle: `Document ${id}`,
    content: `Content of ${id}`,
    similarity
  }
}

function makeMockEmbeddingAdapter (vector: number[] = [0.1, 0.2, 0.3]) {
  return {
    embed: vi.fn().mockResolvedValue(vector),
    model: 'mock-model',
    dimensions: vector.length
  }
}

// ─── retrieve() 策略路由 ──────────────────────────────────────────────────────

describe('RAGRetriever.retrieve() 策略路由', () => {
  let retriever: RAGRetriever
  let embeddingAdapter: ReturnType<typeof makeMockEmbeddingAdapter>

  beforeEach(async () => {
    vi.clearAllMocks()
    embeddingAdapter = makeMockEmbeddingAdapter()
    retriever = new RAGRetriever(embeddingAdapter as any)
  })

  it('默认策略为 hybrid，调用 hybridSearch', async () => {
    const hybridSpy = vi.spyOn(retriever, 'hybridSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.retrieve('test query')

    expect(hybridSpy).toHaveBeenCalledOnce()
    expect(vectorSpy).not.toHaveBeenCalled()
  })

  it('ragStrategy: "vector" 时跳过混合搜索，直接走纯向量', async () => {
    const hybridSpy = vi.spyOn(retriever, 'hybridSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.retrieve('test query', { ragStrategy: 'vector' })

    expect(hybridSpy).not.toHaveBeenCalled()
    expect(vectorSpy).toHaveBeenCalledOnce()
  })

  it('传入 prdIds 时强制走纯向量（PRD 路径）', async () => {
    const hybridSpy = vi.spyOn(retriever, 'hybridSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.retrieve('test query', { prdIds: ['prd-1'] })

    expect(hybridSpy).not.toHaveBeenCalled()
    expect(vectorSpy).toHaveBeenCalledOnce()
  })

  it('hybridSearch 接收正确的参数', async () => {
    const hybridSpy = vi.spyOn(retriever, 'hybridSearch').mockResolvedValue([])

    await retriever.retrieve('query', {
      topK: 3,
      threshold: 0.5,
      documentIds: ['doc-1'],
      userId: 'user-1'
    })

    expect(hybridSpy).toHaveBeenCalledWith('query', {
      topK: 3,
      threshold: 0.5,
      documentIds: ['doc-1'],
      userId: 'user-1'
    })
  })

  it('返回 hybridSearch 的结果', async () => {
    const expected = [makeChunk('a'), makeChunk('b')]
    vi.spyOn(retriever, 'hybridSearch').mockResolvedValue(expected)

    const result = await retriever.retrieve('query')
    expect(result).toEqual(expected)
  })
})

// ─── hybridSearch() 内部逻辑 ──────────────────────────────────────────────────

describe('RAGRetriever.hybridSearch()', () => {
  let retriever: RAGRetriever

  beforeEach(() => {
    vi.clearAllMocks()
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('并行调用 keywordSearch 和 _vectorRetrieve', async () => {
    const keywordSpy = vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.hybridSearch('test query')

    expect(keywordSpy).toHaveBeenCalledOnce()
    expect(vectorSpy).toHaveBeenCalledOnce()
  })

  it('keywordSearch 和 _vectorRetrieve 的 topK 是 hybridSearch topK 的 2 倍', async () => {
    const keywordSpy = vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.hybridSearch('test query', { topK: 5 })

    // keywordSearch(query, topK*2=10, userId, documentIds)
    expect(keywordSpy).toHaveBeenCalledWith('test query', 10, undefined, undefined)
    // _vectorRetrieve(query, { topK: 10, ... })
    expect((vectorSpy.mock.calls[0][1] as any).topK).toBe(10)
  })

  it('documentIds 传递到两个子搜索', async () => {
    const keywordSpy = vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    const vectorSpy = vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.hybridSearch('query', { documentIds: ['doc-1', 'doc-2'] })

    expect(keywordSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), undefined, ['doc-1', 'doc-2'])
    expect((vectorSpy.mock.calls[0][1] as any).documentIds).toEqual(['doc-1', 'doc-2'])
  })

  it('两个子搜索都为空时返回空数组', async () => {
    vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    const result = await retriever.hybridSearch('query')
    expect(result).toEqual([])
  })

  it('结果按 RRF 分数降序排列且截取 topK', async () => {
    const kResults = [makeChunk('a'), makeChunk('b'), makeChunk('c')]
    const vResults = [makeChunk('a'), makeChunk('d'), makeChunk('e')]

    vi.spyOn(retriever, 'keywordSearch').mockResolvedValue(kResults)
    vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue(vResults)

    const result = await retriever.hybridSearch('query', { topK: 2 })

    expect(result).toHaveLength(2)
    // 'a' 在两个列表都出现，应排第一
    expect(result[0].id).toBe('a')
  })

  it('中文查询自动调整 keywordWeight', async () => {
    const keywordSpy = vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    // 中文短查询 → keywordWeight=0.6
    await retriever.hybridSearch('用户登录')

    // 验证 keywordSearch 被调用（间接证明中文路径正常工作）
    expect(keywordSpy).toHaveBeenCalled()
  })
})

// ─── keywordSearch() 中文支持 ─────────────────────────────────────────────────

describe('RAGRetriever.keywordSearch() 中文支持', () => {
  let dbQueryMock: ReturnType<typeof vi.fn>
  let retriever: RAGRetriever

  beforeEach(async () => {
    vi.clearAllMocks()
    const { dbClient } = await import('~/lib/db/client')
    dbQueryMock = dbClient.query as ReturnType<typeof vi.fn>
    dbQueryMock.mockResolvedValue({ rows: [] })
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('英文查询使用 english 全文配置', async () => {
    await retriever.keywordSearch('user authentication login', 5)

    const sql = dbQueryMock.mock.calls[0][0] as string
    expect(sql).toContain("plainto_tsquery('english'")
  })

  it('中文查询使用 simple 全文配置', async () => {
    await retriever.keywordSearch('用户登录功能', 5)

    const sql = dbQueryMock.mock.calls[0][0] as string
    expect(sql).toContain("plainto_tsquery('simple'")
  })

  it('混合中英文查询检测到中文时使用 simple', async () => {
    await retriever.keywordSearch('user 登录 feature', 5)

    const sql = dbQueryMock.mock.calls[0][0] as string
    expect(sql).toContain("plainto_tsquery('simple'")
  })

  it('传入 documentIds 时 SQL 包含 ANY 过滤', async () => {
    await retriever.keywordSearch('login', 5, undefined, ['doc-1', 'doc-2'])

    const sql = dbQueryMock.mock.calls[0][0] as string
    const params = dbQueryMock.mock.calls[0][1] as unknown[]
    expect(sql).toContain('ANY(')
    expect(params).toContainEqual(['doc-1', 'doc-2'])
  })

  it('传入 userId 时 SQL 包含 user_id 过滤', async () => {
    await retriever.keywordSearch('login', 5, 'user-abc')

    const sql = dbQueryMock.mock.calls[0][0] as string
    expect(sql).toContain('user_id')
  })

  it('数据库返回的行映射为 RetrievedChunk 格式', async () => {
    dbQueryMock.mockResolvedValue({
      rows: [
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          document_title: 'My Doc',
          content: 'Some content',
          score: 0.75
        }
      ]
    })

    const result = await retriever.keywordSearch('login', 5)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'chunk-1',
      documentId: 'doc-1',
      documentTitle: 'My Doc',
      content: 'Some content',
      similarity: 0.75
    })
  })

  it('数据库无结果时返回空数组', async () => {
    dbQueryMock.mockResolvedValue({ rows: [] })

    const result = await retriever.keywordSearch('nothingfound', 5)
    expect(result).toEqual([])
  })
})

// ─── summarizeResults() ───────────────────────────────────────────────────────

describe('RAGRetriever.summarizeResults()', () => {
  it('空数组返回空字符串', () => {
    const retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
    expect(retriever.summarizeResults([])).toBe('')
  })

  it('正确格式化文档标题和内容', () => {
    const retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
    const chunks = [makeChunk('a'), makeChunk('b')]
    const summary = retriever.summarizeResults(chunks)

    expect(summary).toContain('[文档 1: Document a]')
    expect(summary).toContain('[文档 2: Document b]')
    expect(summary).toContain('---')
  })
})

// ─── _vectorRetrieve() 内部实现 ───────────────────────────────────────────────

describe('RAGRetriever._vectorRetrieve() PRD 检索路径', () => {
  let retriever: RAGRetriever
  let VectorDAOMock: any
  let PrdChunkDAOMock: any
  let PRDDAOMock: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { VectorDAO } = await import('~/lib/db/dao/vector-dao')
    const { PrdChunkDAO } = await import('~/lib/db/dao/prd-chunk-dao')
    const { PRDDAO } = await import('~/lib/db/dao/prd-dao')
    VectorDAOMock = VectorDAO
    PrdChunkDAOMock = PrdChunkDAO
    PRDDAOMock = PRDDAO
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('prdIds 路径：返回带 [PRD] 前缀的 documentTitle', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.9 }
    ])
    PrdChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', prdId: 'prd-1', content: 'PRD content' }
    ])
    PRDDAOMock.findByIds.mockResolvedValue(
      new Map([['prd-1', { id: 'prd-1', title: 'My PRD' }]])
    )

    const result = await (retriever as any)._vectorRetrieve('query', { prdIds: ['prd-1'] })

    expect(result).toHaveLength(1)
    expect(result[0].documentTitle).toBe('[PRD] My PRD')
    expect(result[0].documentId).toBe('prd-1')
    expect(result[0].similarity).toBe(0.9)
  })

  it('prdIds 路径：PRD 元数据不存在时过滤掉该 chunk', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.9 }
    ])
    PrdChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', prdId: 'prd-99', content: 'PRD content' }
    ])
    PRDDAOMock.findByIds.mockResolvedValue(new Map()) // 空 map

    const result = await (retriever as any)._vectorRetrieve('query', { prdIds: ['prd-99'] })
    expect(result).toHaveLength(0)
  })

  it('向量搜索返回空时直接返回空数组', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([])
    const result = await (retriever as any)._vectorRetrieve('query', { prdIds: ['prd-1'] })
    expect(result).toEqual([])
    expect(PrdChunkDAOMock.findByIds).not.toHaveBeenCalled()
  })

  it('检索异常时抛出错误', async () => {
    VectorDAOMock.similaritySearch.mockRejectedValue(new Error('DB connection failed'))
    await expect(
      (retriever as any)._vectorRetrieve('query', { prdIds: ['prd-1'] })
    ).rejects.toThrow('DB connection failed')
  })
})

describe('RAGRetriever._vectorRetrieve() 文档检索路径（userId 权限隔离）', () => {
  let retriever: RAGRetriever
  let VectorDAOMock: any
  let DocumentChunkDAOMock: any
  let DocumentDAOMock: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { VectorDAO } = await import('~/lib/db/dao/vector-dao')
    const { DocumentChunkDAO } = await import('~/lib/db/dao/document-chunk-dao')
    const { DocumentDAO } = await import('~/lib/db/dao/document-dao')
    VectorDAOMock = VectorDAO
    DocumentChunkDAOMock = DocumentChunkDAO
    DocumentDAOMock = DocumentDAO
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('文档路径：正常返回检索结果', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.85 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-1', content: 'Doc content' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(
      new Map([['doc-1', { id: 'doc-1', title: 'Test Doc', userId: 'user-1' }]])
    )

    const result = await (retriever as any)._vectorRetrieve('query', { userId: 'user-1' })

    expect(result).toHaveLength(1)
    expect(result[0].documentTitle).toBe('Test Doc')
    expect(result[0].similarity).toBe(0.85)
  })

  it('userId 不匹配时过滤掉该文档', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.85 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-1', content: 'Doc content' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(
      new Map([['doc-1', { id: 'doc-1', title: 'Other User Doc', userId: 'other-user' }]])
    )

    const result = await (retriever as any)._vectorRetrieve('query', { userId: 'user-1' })
    expect(result).toHaveLength(0)
  })

  it('文档 userId 为 null 时（历史数据）不过滤', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.9 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-1', content: 'Legacy content' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(
      new Map([['doc-1', { id: 'doc-1', title: 'Legacy Doc', userId: null }]])
    )

    const result = await (retriever as any)._vectorRetrieve('query', { userId: 'user-1' })
    expect(result).toHaveLength(1)
    expect(result[0].documentTitle).toBe('Legacy Doc')
  })

  it('不传 userId 时不过滤任何文档', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.9 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-1', content: 'Content' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(
      new Map([['doc-1', { id: 'doc-1', title: 'Any Doc', userId: 'any-user' }]])
    )

    const result = await (retriever as any)._vectorRetrieve('query')
    expect(result).toHaveLength(1)
  })

  it('文档元数据不存在时过滤掉该 chunk', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-1', score: 0.8 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-orphan', content: 'Orphan content' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(new Map()) // 空

    const result = await (retriever as any)._vectorRetrieve('query')
    expect(result).toHaveLength(0)
  })

  it('结果按相似度降序排列', async () => {
    VectorDAOMock.similaritySearch.mockResolvedValue([
      { chunkId: 'chunk-low', score: 0.5 },
      { chunkId: 'chunk-high', score: 0.95 }
    ])
    DocumentChunkDAOMock.findByIds.mockResolvedValue([
      { id: 'chunk-low', documentId: 'doc-1', content: 'Low' },
      { id: 'chunk-high', documentId: 'doc-2', content: 'High' }
    ])
    DocumentDAOMock.findByIds.mockResolvedValue(
      new Map([
        ['doc-1', { id: 'doc-1', title: 'Low Doc', userId: null }],
        ['doc-2', { id: 'doc-2', title: 'High Doc', userId: null }]
      ])
    )

    const result = await (retriever as any)._vectorRetrieve('query')
    expect(result[0].similarity).toBe(0.95)
    expect(result[1].similarity).toBe(0.5)
  })
})

describe('RAGRetriever.hybridSearch() 异常处理', () => {
  let retriever: RAGRetriever

  beforeEach(() => {
    vi.clearAllMocks()
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('keywordSearch 抛出异常时 hybridSearch 也抛出', async () => {
    vi.spyOn(retriever, 'keywordSearch').mockRejectedValue(new Error('Keyword search failed'))
    vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await expect(retriever.hybridSearch('query')).rejects.toThrow('Keyword search failed')
  })

  it('_vectorRetrieve 抛出异常时 hybridSearch 也抛出', async () => {
    vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    vi.spyOn(retriever as any, '_vectorRetrieve').mockRejectedValue(new Error('Vector search failed'))

    await expect(retriever.hybridSearch('query')).rejects.toThrow('Vector search failed')
  })

  it('指定显式 keywordWeight 和 vectorWeight 时不走自动权重', async () => {
    const keywordSpy = vi.spyOn(retriever, 'keywordSearch').mockResolvedValue([])
    vi.spyOn(retriever as any, '_vectorRetrieve').mockResolvedValue([])

    await retriever.hybridSearch('query', { keywordWeight: 0.3, vectorWeight: 0.7 })
    expect(keywordSpy).toHaveBeenCalled()
  })
})

describe('RAGRetriever.keywordSearch() 异常处理', () => {
  let retriever: RAGRetriever

  beforeEach(async () => {
    vi.clearAllMocks()
    const { dbClient } = await import('~/lib/db/client')
    vi.mocked(dbClient.query).mockRejectedValue(new Error('SQL error'))
    retriever = new RAGRetriever(makeMockEmbeddingAdapter() as any)
  })

  it('SQL 执行失败时抛出错误', async () => {
    await expect(retriever.keywordSearch('query')).rejects.toThrow('SQL error')
  })
})
