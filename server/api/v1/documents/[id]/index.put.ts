import { DocumentDAO } from '~/lib/db/dao/document-dao'
import type { Document } from '~/types/document'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)

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

    // 构建更新对象
    const updates: Partial<Document> = {}
    if (body.title !== undefined) { updates.title = body.title }
    if (body.content !== undefined) { updates.content = body.content }
    if (body.metadata !== undefined) { updates.metadata = body.metadata }

    // 更新文档
    const updated = await DocumentDAO.update(id, updates)

    if (!updated) {
      setResponseStatus(event, 500)
      return {
        success: false,
        message: t('errors.updateDocumentFailed')
      }
    }

    return {
      success: true,
      data: updated,
      message: t('errors.documentUpdatedSuccess')
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
