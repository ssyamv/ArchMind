import { PrototypeDAO, PrototypePageDAO } from '~/lib/db/dao/prototype-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')
    if (!id) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.idRequired') }
    }

    // 校验原型归属权
    const prototype = await PrototypeDAO.findById(id)
    if (!prototype) {
      setResponseStatus(event, 404)
      return { success: false, message: t('errors.prototypeNotFound') }
    }
    requireResourceOwner(prototype, userId)

    const pages = await PrototypePageDAO.findByPrototypeId(id)
    return { success: true, data: pages }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
