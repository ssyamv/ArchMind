import { PRDDAO } from '~/lib/db/dao/prd-dao'

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

    const prd = await PRDDAO.findById(id)

    if (!prd) {
      setResponseStatus(event, 404)
      return {
        success: false,
        message: t(ErrorKeys.PRD_NOT_FOUND)
      }
    }

    requireResourceOwner(prd, userId)

    // 获取引用的文档
    const references = await PRDDAO.getReferences(id)

    return {
      success: true,
      data: {
        ...prd,
        references
      }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
