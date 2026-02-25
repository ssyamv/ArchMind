import { PrototypeDAO, PrototypePageDAO } from '~/lib/db/dao/prototype-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')
    const pageId = getRouterParam(event, 'pageId')
    if (!id || !pageId) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.pageIdRequired') }
    }

    // 校验原型归属权
    const prototype = await PrototypeDAO.findById(id)
    if (!prototype) {
      setResponseStatus(event, 404)
      return { success: false, message: t('errors.prototypeNotFound') }
    }
    requireResourceOwner(prototype, userId)

    const body = await readBody(event)
    const page = await PrototypePageDAO.update(pageId, body)

    if (!page) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.PAGE_NOT_FOUND) }
    }

    return { success: true, data: page }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
