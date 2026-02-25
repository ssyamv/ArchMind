import { dbClient } from '../client'

export interface VectorMapping {
  id: string;
  chunkId: string;
  similarity: number;
}

export interface EmbeddingModel {
  name: string
  provider: string
  dimensions: number
  description?: string
  enabled?: boolean
}

/**
 * pgvector 索引最大支持 2000 维 (vector 类型)
 * 超过 2000 维时使用 halfvec 类型 (半精度浮点, 支持约 4000 维)
 */
const VECTOR_INDEX_MAX_DIM = 2000

function vecType(dimensions: number): string {
  return dimensions > VECTOR_INDEX_MAX_DIM ? 'halfvec' : 'vector'
}

export class VectorDAO {
  /**
   * 获取系统配置的 Embedding 模型列表
   */
  static async getEmbeddingModels(): Promise<EmbeddingModel[]> {
    const sql = `
      SELECT value->'models' as models
      FROM system_config
      WHERE key = 'embedding_models'
    `
    const result = await dbClient.query(sql)

    if (result.rows.length === 0) {
      // 返回默认配置
      return [
        {
          name: 'text-embedding-3-small',
          provider: 'openai',
          dimensions: 1536,
          enabled: true
        },
        {
          name: 'embedding-3',
          provider: 'zhipu',
          dimensions: 2048,
          enabled: true
        }
      ]
    }

    return result.rows[0].models as EmbeddingModel[]
  }

  /**
   * 获取默认 Embedding 模型
   */
  static async getDefaultModel(): Promise<EmbeddingModel> {
    const sql = `
      SELECT
        value->>'default' as default_model_name,
        value->'models' as models
      FROM system_config
      WHERE key = 'embedding_models'
    `
    const result = await dbClient.query(sql)

    if (result.rows.length === 0) {
      // 返回默认配置
      return {
        name: 'embedding-3',
        provider: 'zhipu',
        dimensions: 2048,
        enabled: true
      }
    }

    const defaultModelName = result.rows[0].default_model_name
    const models = result.rows[0].models as EmbeddingModel[]
    const defaultModel = models.find(m => m.name === defaultModelName)

    if (!defaultModel) {
      throw new Error(`Default model '${defaultModelName}' not found in configuration`)
    }

    return defaultModel
  }

  /**
   * 添加向量到文档块(支持多模型)
   */
  static async addVector(
    chunkId: string,
    embedding: number[],
    modelName: string,
    modelProvider: string,
    dimensions: number
  ): Promise<string> {
    const vtype = vecType(dimensions)
    const sql = `
      INSERT INTO document_embeddings
        (chunk_id, model_name, model_provider, model_dimensions, embedding)
      VALUES ($1, $2, $3, $4, $5::${vtype})
      ON CONFLICT (chunk_id, model_name)
      DO UPDATE SET
        embedding = EXCLUDED.embedding,
        model_dimensions = EXCLUDED.model_dimensions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `

    const result = await dbClient.query<{ id: string }>(sql, [
      chunkId,
      modelName,
      modelProvider,
      dimensions,
      JSON.stringify(embedding)
    ])

    return result.rows[0].id
  }

  /**
   * 批量添加向量(支持多模型)
   */
  static async addVectors(
    chunks: Array<{
      chunkId: string
      embedding: number[]
      modelName: string
      modelProvider: string
      dimensions: number
    }>
  ): Promise<string[]> {
    if (chunks.length === 0) return []

    const vtype = vecType(chunks[0].dimensions)

    const values = chunks.map((_, i) => {
      const base = i * 5
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::${vtype})`
    }).join(', ')

    const params = chunks.flatMap(chunk => [
      chunk.chunkId,
      chunk.modelName,
      chunk.modelProvider,
      chunk.dimensions,
      JSON.stringify(chunk.embedding)
    ])

    const sql = `
      INSERT INTO document_embeddings
        (chunk_id, model_name, model_provider, model_dimensions, embedding)
      VALUES ${values}
      ON CONFLICT (chunk_id, model_name)
      DO UPDATE SET
        embedding = EXCLUDED.embedding,
        model_dimensions = EXCLUDED.model_dimensions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `

    const result = await dbClient.query<{ id: string }>(sql, params)
    return result.rows.map(row => row.id)
  }

  /**
   * 向量相似度搜索(支持指定模型、文档范围和 PRD 范围过滤)
   */
  static async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
    modelName?: string,
    documentIds?: string[],
    prdIds?: string[]
  ): Promise<Array<{ chunkId: string; score: number; content: string; documentId: string }>> {
    // 如果没有指定模型,使用默认模型
    const model = modelName ? await this.getModelByName(modelName) : await this.getDefaultModel()
    const vtype = vecType(model.dimensions)

    const hasPrdIds = prdIds && prdIds.length > 0
    const hasDocumentIds = documentIds && documentIds.length > 0

    // 仅查询 PRD chunks：使用 prd_chunks 表
    if (hasPrdIds && !hasDocumentIds) {
      const params: (string | number)[] = [
        JSON.stringify(queryEmbedding),
        model.name,
        threshold,
        limit
      ]
      const prdPlaceholders = prdIds.map((_, i) => `$${i + 5}`).join(', ')
      params.push(...prdIds)

      const sql = `
        SELECT
          e.chunk_id,
          1 - ((e.embedding::${vtype}(${model.dimensions})) <=> $1::${vtype}(${model.dimensions})) as similarity,
          c.content,
          c.prd_id as document_id
        FROM document_embeddings e
        JOIN prd_chunks c ON e.chunk_id = c.id
        WHERE e.model_name = $2
          AND (1 - ((e.embedding::${vtype}(${model.dimensions})) <=> $1::${vtype}(${model.dimensions}))) >= $3
          AND c.prd_id IN (${prdPlaceholders})
        ORDER BY similarity DESC
        LIMIT $4
      `

      const result = await dbClient.query<{
        chunk_id: string
        similarity: number
        content: string
        document_id: string
      }>(sql, params)

      return result.rows.map(row => ({
        chunkId: row.chunk_id,
        score: row.similarity,
        content: row.content,
        documentId: row.document_id
      }))
    }

    // 构建 documentIds 过滤子句（document_chunks 表）
    const params: (string | number)[] = [
      JSON.stringify(queryEmbedding),
      model.name,
      threshold,
      limit
    ]

    let documentFilter = ''
    if (hasDocumentIds) {
      const placeholders = documentIds.map((_, i) => `$${i + 5}`).join(', ')
      documentFilter = `AND c.document_id IN (${placeholders})`
      params.push(...documentIds)
    }

    // 使用类型转换和部分索引
    const sql = `
      SELECT
        e.chunk_id,
        1 - ((e.embedding::${vtype}(${model.dimensions})) <=> $1::${vtype}(${model.dimensions})) as similarity,
        c.content,
        c.document_id
      FROM document_embeddings e
      JOIN document_chunks c ON e.chunk_id = c.id
      WHERE e.model_name = $2
        AND (1 - ((e.embedding::${vtype}(${model.dimensions})) <=> $1::${vtype}(${model.dimensions}))) >= $3
        ${documentFilter}
      ORDER BY similarity DESC
      LIMIT $4
    `

    const result = await dbClient.query<{
      chunk_id: string
      similarity: number
      content: string
      document_id: string
    }>(sql, params)

    return result.rows.map(row => ({
      chunkId: row.chunk_id,
      score: row.similarity,
      content: row.content,
      documentId: row.document_id
    }))
  }

  /**
   * 根据模型名称获取模型信息
   */
  static async getModelByName(modelName: string): Promise<EmbeddingModel> {
    const models = await this.getEmbeddingModels()
    const model = models.find(m => m.name === modelName)

    if (!model) {
      throw new Error(`Model '${modelName}' not found in configuration`)
    }

    return model
  }

  /**
   * 删除指定文档的所有向量（通过 chunk_id JOIN document_chunks）
   */
  static async deleteByDocumentId(documentId: string): Promise<number> {
    const sql = `
      DELETE FROM document_embeddings
      WHERE chunk_id IN (
        SELECT id FROM document_chunks WHERE document_id = $1
      )
    `
    const result = await dbClient.query(sql, [documentId])
    return result.rowCount || 0
  }

  /**
   * 删除文档的所有向量(所有模型)
   */
  static async deleteByChunkIds(chunkIds: string[]): Promise<number> {
    if (chunkIds.length === 0) return 0

    const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `
      DELETE FROM document_embeddings
      WHERE chunk_id IN (${placeholders})
    `

    const result = await dbClient.query(sql, chunkIds)
    return result.rowCount || 0
  }

  /**
   * 删除特定模型的向量
   */
  static async deleteByModel(modelName: string): Promise<number> {
    const sql = `
      DELETE FROM document_embeddings
      WHERE model_name = $1
    `
    const result = await dbClient.query(sql, [modelName])
    return result.rowCount || 0
  }

  /**
   * 统计已向量化的块数量
   */
  static async count(modelName?: string): Promise<number> {
    let sql: string
    let params: any[] = []

    if (modelName) {
      sql = `
        SELECT COUNT(DISTINCT chunk_id) as count
        FROM document_embeddings
        WHERE model_name = $1
      `
      params = [modelName]
    } else {
      sql = `
        SELECT COUNT(DISTINCT chunk_id) as count
        FROM document_embeddings
      `
    }

    try {
      const result = await dbClient.query<{ count: string }>(sql, params)
      return parseInt(result.rows[0].count, 10)
    } catch (err: any) {
      // 表不存在时（如数据库迁移未执行）优雅降级返回 0
      if (err.code === '42P01') return 0
      throw err
    }
  }

  /**
   * 统计各模型的向量数量
   */
  static async countByModel(): Promise<Record<string, number>> {
    const sql = `
      SELECT
        model_name,
        COUNT(*) as count
      FROM document_embeddings
      GROUP BY model_name
    `
    const result = await dbClient.query<{ model_name: string; count: string }>(sql)

    return result.rows.reduce((acc, row) => {
      acc[row.model_name] = parseInt(row.count, 10)
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * 检查文档块是否已向量化(指定模型)
   */
  static async isVectorized(chunkId: string, modelName?: string): Promise<boolean> {
    let sql: string
    let params: any[]

    if (modelName) {
      sql = `
        SELECT EXISTS(
          SELECT 1
          FROM document_embeddings
          WHERE chunk_id = $1 AND model_name = $2
        ) as exists
      `
      params = [chunkId, modelName]
    } else {
      sql = `
        SELECT EXISTS(
          SELECT 1
          FROM document_embeddings
          WHERE chunk_id = $1
        ) as exists
      `
      params = [chunkId]
    }

    const result = await dbClient.query<{ exists: boolean }>(sql, params)
    return result.rows[0].exists
  }
}
