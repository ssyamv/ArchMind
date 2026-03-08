import { UserDAO } from '~/lib/db/dao/user-dao'
import { dbClient } from '~/lib/db/client'
import { requireAuth } from '~/server/utils/auth-helpers'

/**
 * GET /api/v1/users/me/onboarding
 * 获取当前用户的 Onboarding 状态
 *
 * 历史用户（onboarding_state 为空对象，且所有步骤均为 false）：
 * - 查询数据库判断是否有文档/PRD，计算已完成步骤
 * - 同时写入 skipped: true，后续不再展示 WelcomeScreen
 */
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const state = await UserDAO.getOnboardingState(userId)

  // 历史用户判断：所有步骤均为初始值
  const isLegacyUser = !state.skipped && !state.completedAt &&
    !state.hasConfiguredAI && !state.hasUploadedDocument && !state.hasGeneratedPRD

  if (isLegacyUser) {
    const [docs, prds] = await Promise.all([
      dbClient.query('SELECT 1 FROM documents WHERE user_id = $1 LIMIT 1', [userId]),
      dbClient.query('SELECT 1 FROM prd_documents WHERE user_id = $1 LIMIT 1', [userId]),
    ])

    const updated = await UserDAO.updateOnboardingState(userId, {
      skipped: true,
      hasUploadedDocument: docs.rows.length > 0,
      hasGeneratedPRD: prds.rows.length > 0,
    })

    return { success: true, data: updated }
  }

  return { success: true, data: state }
})
