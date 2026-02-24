import { PrototypeDAO } from '~/lib/db/dao/prototype-dao'

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

    // 先查询资源并校验归属权
    const existing = await PrototypeDAO.findById(id)
    if (!existing) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.PROTOTYPE_NOT_FOUND) }
    }
    requireResourceOwner(existing, userId)

    const body = await readBody(event)
    const prototype = await PrototypeDAO.update(id, body)

    return { success: true, data: prototype }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
