import { PRDSnapshotDAO } from '~/lib/db/dao/prd-snapshot-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const snapshotId = getRouterParam(event, 'snapshotId')

    if (!snapshotId) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.invalidRequest') }
    }

    // 联查快照 + PRD 所有权
    const snapshotWithOwner = await PRDSnapshotDAO.findByIdWithOwner(snapshotId)
    if (!snapshotWithOwner) {
      setResponseStatus(event, 404)
      return { success: false, message: '快照不存在' }
    }

    requireResourceOwner({ userId: snapshotWithOwner.prdUserId }, userId)

    // 读取完整内容（ComparePanel 用）
    const snapshot = await PRDSnapshotDAO.findById(snapshotId)
    if (!snapshot) {
      setResponseStatus(event, 404)
      return { success: false, message: '快照不存在' }
    }

    // 返回与 /api/v1/prd/:id 相同格式，以便 ComparePanel 复用
    return {
      success: true,
      data: {
        id: snapshot.id,
        title: snapshot.tag || `快照 ${new Date(snapshot.createdAt).toLocaleDateString('zh-CN')}`,
        content: snapshot.content,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.createdAt
      }
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: t(ErrorKeys.UNKNOWN_ERROR) }
  }
})
