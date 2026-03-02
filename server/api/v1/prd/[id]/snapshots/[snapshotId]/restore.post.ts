import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { PRDSnapshotDAO } from '~/lib/db/dao/prd-snapshot-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')
    const snapshotId = getRouterParam(event, 'snapshotId')

    if (!id || !snapshotId) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.invalidRequest') }
    }

    // 联查快照 + PRD 所有权
    const snapshotWithOwner = await PRDSnapshotDAO.findByIdWithOwner(snapshotId)
    if (!snapshotWithOwner) {
      setResponseStatus(event, 404)
      return { success: false, message: '快照不存在' }
    }

    // 校验快照属于该 PRD
    if (snapshotWithOwner.prdId !== id) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.invalidRequest') }
    }

    // 校验所有权
    requireResourceOwner({ userId: snapshotWithOwner.prdUserId }, userId)

    // 读取完整快照内容
    const snapshot = await PRDSnapshotDAO.findById(snapshotId)
    if (!snapshot) {
      setResponseStatus(event, 404)
      return { success: false, message: '快照不存在' }
    }

    // 在恢复之前，先保存当前 PRD 状态为 auto 快照（防止意外覆盖）
    const currentPrd = await PRDDAO.findById(id)
    if (currentPrd?.content) {
      setImmediate(async () => {
        try {
          await PRDSnapshotDAO.create({
            prdId: id,
            createdBy: userId,
            snapshotType: 'auto',
            content: currentPrd.content!
          })
        } catch (e) {
          console.warn('[PRDSnapshot] pre-restore auto snapshot failed:', e)
        }
      })
    }

    // 恢复：将快照内容写入 prd_documents
    await PRDDAO.update(id, { content: snapshot.content })

    return {
      success: true,
      data: { content: snapshot.content }
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
