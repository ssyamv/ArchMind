import { PRDDAO } from '~/lib/db/dao/prd-dao'

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

    requireResourceOwner(prd, userId)

    const versions = await PRDDAO.findVersions(id)

    return {
      success: true,
      data: versions.map((v, index) => ({
        id: v.id,
        title: v.title,
        parentId: v.parentId,
        modelUsed: v.modelUsed,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        versionLabel: `第 ${versions.length - index} 版`
      }))
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
