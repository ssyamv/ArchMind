import { db } from '~/lib/db/client'
import { prdDocuments, prdDocumentReferences } from '~/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
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

    // 验证父资源��属
    const document = await DocumentDAO.findById(id)
    if (!document) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.DOCUMENT_NOT_FOUND) }
    }
    requireResourceOwner(document, userId)

    // 查询引用了该文档的所有 PRD
    const results = await db
      .select({
        id: prdDocuments.id,
        title: prdDocuments.title,
        createdAt: prdDocuments.createdAt,
        updatedAt: prdDocuments.updatedAt,
        relevanceScore: prdDocumentReferences.relevanceScore
      })
      .from(prdDocuments)
      .innerJoin(
        prdDocumentReferences,
        eq(prdDocumentReferences.prdId, prdDocuments.id)
      )
      .where(eq(prdDocumentReferences.documentId, id))
      .orderBy(desc(prdDocuments.createdAt))

    return {
      success: true,
      data: results
    }
  } catch (error) {
    console.error('Failed to get document usage:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
