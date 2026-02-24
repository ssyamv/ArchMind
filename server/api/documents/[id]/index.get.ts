import { DocumentDAO } from '~/lib/db/dao/document-dao'

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

    const document = await DocumentDAO.findById(id)

    if (!document) {
      setResponseStatus(event, 404)
      return {
        success: false,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      }
    }

    requireResourceOwner(document, userId)

    return {
      success: true,
      data: document
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
