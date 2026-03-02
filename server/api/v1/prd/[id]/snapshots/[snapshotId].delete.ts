/**
 * DELETE /api/v1/prd/:id/snapshots/:snapshotId
 * 删除指定快照
 */

import { z } from 'zod'
import { PRDSnapshotDAO } from '~/lib/db/dao/prd-snapshot-dao'
import { ErrorKeys } from '~/server/utils/errors'

const ParamsSchema = z.object({
  id: z.string().uuid(),
  snapshotId: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const params = await getValidatedRouterParams(event, ParamsSchema.parse)

    // 获取快照并校验所有权
    const snapshot = await PRDSnapshotDAO.findByIdWithOwner(params.snapshotId)
    if (!snapshot) {
      setResponseStatus(event, 404)
      return { success: false, message: '快照不存在' }
    }

    // 校验快照属于指定 PRD
    if (snapshot.prdId !== params.id) {
      setResponseStatus(event, 400)
      return { success: false, message: '快照不属于该 PRD' }
    }

    // 校验用户是 PRD 所有者
    if (snapshot.prdUserId !== userId) {
      setResponseStatus(event, 403)
      return { success: false, message: '无权删除此快照' }
    }

    // 删除快照
    await PRDSnapshotDAO.delete(params.snapshotId)

    return { success: true }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
