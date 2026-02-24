import { DocumentDAO } from '~/lib/db/dao/document-dao'
import type { Document } from '~/types/document'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const body = await readBody(event)

    if (!body.title || !body.filePath || !body.fileType || body.fileSize === undefined) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t(ErrorKeys.MISSING_REQUIRED_FIELDS)
      }
    }

    const validFileTypes = ['pdf', 'docx', 'markdown']
    if (!validFileTypes.includes(body.fileType)) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t(ErrorKeys.INVALID_FILE_TYPE)
      }
    }

    const doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      workspaceId: body.workspaceId,
      title: body.title,
      filePath: body.filePath,
      fileType: body.fileType,
      fileSize: body.fileSize,
      content: body.content || null,
      metadata: body.metadata || {},
      status: 'uploaded'
    }

    const created = await DocumentDAO.create(doc)

    setResponseStatus(event, 201)
    return {
      success: true,
      data: created,
      message: t('errors.documentCreatedSuccess')
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
