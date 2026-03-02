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

    requireResourceOwner(prd, userId)

    const body = await readBody<{ tag?: string; description?: string; content?: string }>(event)

    const snapshotContent = body.content || prd.content

    if (!snapshotContent) {
      setResponseStatus(event, 400)
      return { success: false, message: '当前 PRD 尚无内容，无法保存快照' }
    }

    const snapshot = await PRDSnapshotDAO.create({
      prdId: id,
      createdBy: userId,
      snapshotType: 'manual',
      content: snapshotContent,
      tag: body.tag || undefined,
      description: body.description || undefined
    })

    return {
      success: true,
      data: snapshot
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
