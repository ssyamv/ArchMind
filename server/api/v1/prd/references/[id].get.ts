import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.prdIdRequired')
      }
    }

    // 校验 PRD 归属权
    const prd = await PRDDAO.findById(id)
    if (!prd) {
      setResponseStatus(event, 404)
      return {
        success: false,
        message: t(ErrorKeys.PRD_NOT_FOUND)
      }
    }
    requireResourceOwner(prd, userId)

    // 获取引用关系
    const references = await PRDDAO.getReferences(id)

    if (references.length === 0) {
      return {
        success: true,
        data: {
          prdId: id,
          documents: [],
          count: 0
        }
      }
    }

    // 获取文档详情
    const documents = await Promise.all(
      references.map(async (ref) => {
        const doc = await DocumentDAO.findById(ref.documentId)
        return {
          id: ref.documentId,
          title: doc?.title || 'Unknown',
          relevanceScore: ref.relevanceScore || 0
        }
      })
    )

    return {
      success: true,
      data: {
        prdId: id,
        documents,
        count: documents.length
      }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
