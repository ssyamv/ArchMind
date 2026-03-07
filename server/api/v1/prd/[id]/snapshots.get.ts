import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { PRDSnapshotDAO } from '~/lib/db/dao/prd-snapshot-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.invalidRequest') }
    }

    const prd = await PRDDAO.findById(id)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.PRD_NOT_FOUND) }
    }

    await requirePrdAccess(prd, userId)

    const query = getQuery(event)
    const type = query.type as string | undefined
    const limit = Number(query.limit) || 100
    const offset = Number(query.offset) || 0

    const snapshots = await PRDSnapshotDAO.list(id, { type, limit, offset })

    return {
      success: true,
      data: snapshots
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
