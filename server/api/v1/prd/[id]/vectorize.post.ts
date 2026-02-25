import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'js-yaml'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { PrdChunkDAO } from '~/lib/db/dao/prd-chunk-dao'
import { VectorDAO } from '~/lib/db/dao/vector-dao'
import { EmbeddingServiceFactory } from '~/lib/rag/embedding-adapter'
import { getModelManager } from '~/lib/ai/manager'
import { TextSplitter } from '~/lib/rag/text-splitter'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'id')
    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false, message: 'PRD ID 不能为空' }
    }

    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, message: 'PRD 不存在' }
    }

    requireResourceOwner(prd, userId)

    // 立即更新状态为 processing，返回响应
    const currentMetadata = prd.metadata || {}
    await PRDDAO.update(prdId, {
      metadata: { ...currentMetadata, ragEnabled: true, ragStatus: 'processing' }
    })

    // 异步执行向量化（不阻塞响应）
    vectorizePrdAsync(prdId, prd.content, currentMetadata).catch((err) => {
      console.error(`[PRD RAG] 向量化失败 ${prdId}:`, err)
    })

    return { success: true, message: '向量化任务已启动，请稍候' }
  } catch (error) {
    console.error('[PRD RAG] vectorize.post error:', error)
    setResponseStatus(event, 500)
    return { success: false, message: error instanceof Error ? error.message : '未知错误' }
  }
})

async function vectorizePrdAsync (prdId: string, content: string, existingMetadata: Record<string, any>) {
  try {
    const runtimeConfig = useRuntimeConfig()
    const glmApiKey = runtimeConfig.glmApiKey as string | undefined
    const openaiApiKey = runtimeConfig.openaiApiKey as string | undefined

    const config = {
      anthropicApiKey: runtimeConfig.anthropicApiKey,
      openaiApiKey: runtimeConfig.openaiApiKey,
      googleApiKey: runtimeConfig.googleApiKey,
      glmApiKey: runtimeConfig.glmApiKey,
      dashscopeApiKey: runtimeConfig.dashscopeApiKey,
      baiduApiKey: runtimeConfig.baiduApiKey,
      deepseekApiKey: runtimeConfig.deepseekApiKey,
      ollamaBaseUrl: runtimeConfig.ollamaBaseUrl
    }

    const modelManager = getModelManager(config)
    const defaultModelId = modelManager.getDefaultModelId()

    const configPath = join(process.cwd(), 'config', 'ai-models.yaml')
    const configContent = readFileSync(configPath, 'utf-8')
    const parsed = YAML.load(configContent) as { ai_models: { models: Record<string, any> } }
    const modelConfig = parsed.ai_models.models[defaultModelId]

    if (!modelConfig) {
      console.warn(`[PRD RAG] 未找到模型 ${defaultModelId} 的配置`)
      await PRDDAO.update(prdId, {
        metadata: { ...existingMetadata, ragEnabled: false, ragStatus: 'failed' }
      })
      return
    }

    const embeddingAdapter = await EmbeddingServiceFactory.createFromModelConfig(
      modelConfig,
      { glmApiKey, openaiApiKey }
    )

    if (!embeddingAdapter) {
      console.warn(`[PRD RAG] 模型 ${defaultModelId} 不支持 Embedding`)
      await PRDDAO.update(prdId, {
        metadata: { ...existingMetadata, ragEnabled: false, ragStatus: 'failed' }
      })
      return
    }

    // 清理旧的向量数据（支持重建索引）
    await PrdChunkDAO.deleteByPrdId(prdId)

    // 分块
    const chunkSize = parseInt(process.env.CHUNK_SIZE || '1000', 10)
    const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '200', 10)
    const splitter = new TextSplitter({ chunkSize, chunkOverlap })
    const chunks = splitter.split(content)

    if (chunks.length === 0) {
      await PRDDAO.update(prdId, {
        metadata: { ...existingMetadata, ragEnabled: false, ragStatus: 'failed', ragError: '内容为空，无法分块' }
      })
      return
    }

    // 存储块
    const createdChunks = await PrdChunkDAO.createMany(
      chunks.map((chunk, index) => ({
        prdId,
        chunkIndex: index,
        content: chunk,
        metadata: { source: 'prd_chunk', length: chunk.length }
      }))
    )

    // 向量化
    const embeddings = await embeddingAdapter.embedMany(chunks)
    const modelInfo = embeddingAdapter.getModelInfo()

    // 存储向量（复用 VectorDAO，chunk_id 指向 prd_chunks.id）
    await VectorDAO.addVectors(
      createdChunks.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: embeddings[index],
        modelName: modelInfo.modelId,
        modelProvider: modelInfo.provider,
        dimensions: modelInfo.dimensions
      }))
    )

    // 更新 PRD 状态为完成
    await PRDDAO.update(prdId, {
      metadata: {
        ...existingMetadata,
        ragEnabled: true,
        ragStatus: 'completed',
        ragChunks: createdChunks.length,
        ragModel: modelInfo.modelId,
        ragUpdatedAt: new Date().toISOString()
      }
    })

    console.log(`[PRD RAG] 向量化完成: ${prdId}, chunks: ${createdChunks.length}`)
  } catch (error) {
    console.error(`[PRD RAG] 向量化失败 ${prdId}:`, error)
    await PRDDAO.update(prdId, {
      metadata: {
        ...existingMetadata,
        ragEnabled: false,
        ragStatus: 'failed',
        ragError: error instanceof Error ? error.message : '未知错误'
      }
    })
  }
}
