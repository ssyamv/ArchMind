import { DocumentChunkDAO } from '~/lib/db/dao/document-chunk-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.documentIdRequired') }
    }

    // 验证父资源归属
    const document = await DocumentDAO.findById(id)
    if (!document) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.DOCUMENT_NOT_FOUND) }
    }
    requireResourceOwner(document, userId)

    const chunks = await DocumentChunkDAO.findByDocumentId(id)

    return {
      success: true,
      data: chunks
    }
  } catch (error) {
    console.error('Failed to get document chunks:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
