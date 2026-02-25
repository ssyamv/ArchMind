import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { VectorDAO } from '~/lib/db/dao/vector-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)

    const [docCount, prdCount, vectorCount] = await Promise.all([
      DocumentDAO.count({ userId }),
      PRDDAO.count({ userId }),
      VectorDAO.count()
    ])

    return {
      success: true,
      data: {
        documents: docCount,
        prds: prdCount,
        vectors: vectorCount
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
