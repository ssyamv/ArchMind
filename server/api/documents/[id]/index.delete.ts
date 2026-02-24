import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentChunkDAO } from '~/lib/db/dao/document-chunk-dao'
import { VectorDAO } from '~/lib/db/dao/vector-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.documentIdRequired')
      }
    }

    // 检查文档是否存在
    const document = await DocumentDAO.findById(id)
    if (!document) {
      setResponseStatus(event, 404)
      return {
        success: false,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      }
    }

    requireResourceOwner(document, userId)

    // 获取所有文档块
    const chunks = await DocumentChunkDAO.findByDocumentId(id)

    // 删除所有向量
    if (chunks.length > 0) {
      const chunkIds = chunks.map(c => c.id)
      await VectorDAO.deleteByChunkIds(chunkIds)

      // 删除所有文档块
      await DocumentChunkDAO.deleteByDocumentId(id)
    }

    // 删除文档
    const deleted = await DocumentDAO.delete(id)

    if (!deleted) {
      setResponseStatus(event, 500)
      return {
        success: false,
        message: t('errors.deleteDocumentFailed')
      }
    }

    return {
      success: true,
      message: t('errors.documentDeletedSuccess')
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
