import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { PrdChunkDAO } from '~/lib/db/dao/prd-chunk-dao'

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

    // 删除所有向量数据
    await PrdChunkDAO.deleteByPrdId(prdId)

    // 更新 PRD 元数据，关闭 RAG
    const currentMetadata = prd.metadata || {}
    const { ragStatus: _ragStatus, ragChunks: _ragChunks, ragModel: _ragModel, ragUpdatedAt: _ragUpdatedAt, ragError: _ragError, ...restMetadata } = currentMetadata
    await PRDDAO.update(prdId, {
      metadata: { ...restMetadata, ragEnabled: false }
    })

    return { success: true, message: '已关闭 RAG 索引并清除向量数据' }
  } catch (error) {
    console.error('[PRD RAG] vectorize.delete error:', error)
    setResponseStatus(event, 500)
    return { success: false, message: error instanceof Error ? error.message : '未知错误' }
  }
})
