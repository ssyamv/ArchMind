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

    const [prototype, pages] = await Promise.all([
      PrototypeDAO.findById(id),
      PrototypePageDAO.findByPrototypeId(id)
    ])

    if (!prototype) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.PROTOTYPE_NOT_FOUND) }
    }

    requireResourceOwner(prototype, userId)

    return {
      success: true,
      data: { prototype, pages }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
