/**
 * GET /api/documents/:id/references
 * 查询文档的引用关系
 *
 * 返回:
 * - 引用此文档的所有 PRD 列表
 * - 每个 PRD 的基本信息和相关度分数
 */

import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentIdRequired')
    })
  }

  try {
    // 验证父资源归属
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }
    requireResourceOwner(document, userId)

    // 查找引用了此文档的所有 PRD
    const references = await PRDDAO.findPRDsByDocumentId(documentId)

    if (references.length === 0) {
      return {
        success: true,
        data: {
          documentId,
          totalReferences: 0,
          prds: []
        }
      }
    }

    // 获取每个 PRD 的详细信息
    const prds = await Promise.all(
      references.map(async (ref) => {
        const prd = await PRDDAO.findById(ref.prdId)
        return {
          id: ref.prdId,
          title: prd?.title || 'Untitled',
          userInput: prd?.userInput || '',
          status: prd?.status || 'draft',
          createdAt: prd?.createdAt,
          updatedAt: prd?.updatedAt,
          relevanceScore: ref.relevanceScore
        }
      })
    )

    // 按相关度排序
    prds.sort((a, b) => {
      if (a.relevanceScore == null) return 1
      if (b.relevanceScore == null) return -1
      return b.relevanceScore - a.relevanceScore
    })

    return {
      success: true,
      data: {
        documentId,
        totalReferences: prds.length,
        prds
      }
    }
  } catch (error) {
    console.error('References query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchDocumentReferencesFailed')
    })
  }
})
