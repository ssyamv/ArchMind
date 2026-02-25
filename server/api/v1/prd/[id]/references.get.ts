/**
 * GET /api/prd/:id/references
 * 查询 PRD 引用的所有文档
 *
 * 返回:
 * - PRD 引用的所有文档列表
 * - 每个文档的基本信息和相关度分数
 */

import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const prdId = getRouterParam(event, 'id')

  if (!prdId) {
    throw createError({
      statusCode: 400,
      message: t('errors.prdIdRequired')
    })
  }

  try {
    // 验证 PRD 存在
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.PRD_NOT_FOUND)
      })
    }

    // 获取 PRD 的引用文档
    const references = await PRDDAO.getReferences(prdId)

    if (references.length === 0) {
      return {
        success: true,
        data: {
          prdId,
          prdTitle: prd.title,
          totalReferences: 0,
          documents: []
        }
      }
    }

    // 获取每个文档的详细信息
    const documents = await Promise.all(
      references.map(async (ref) => {
        const doc = await DocumentDAO.findById(ref.documentId)
        return {
          id: ref.documentId,
          title: doc?.title || 'Untitled',
          fileType: doc?.fileType,
          fileSize: doc?.fileSize,
          createdAt: doc?.createdAt,
          updatedAt: doc?.updatedAt,
          relevanceScore: ref.relevanceScore
        }
      })
    )

    // 按相关度排序
    documents.sort((a, b) => {
      if (a.relevanceScore == null) return 1
      if (b.relevanceScore == null) return -1
      return b.relevanceScore - a.relevanceScore
    })

    return {
      success: true,
      data: {
        prdId,
        prdTitle: prd.title,
        totalReferences: documents.length,
        documents
      }
    }
  } catch (error) {
    console.error('PRD references query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchPrdReferencesFailed')
    })
  }
})
