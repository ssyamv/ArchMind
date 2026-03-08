import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { requireAuth } from '~/server/utils/auth-helpers'

const Body = z.object({
  hasConfiguredAI: z.boolean().optional(),
  hasUploadedDocument: z.boolean().optional(),
  hasGeneratedPRD: z.boolean().optional(),
  skipped: z.boolean().optional(),
  completedAt: z.string().optional(),
})

/**
 * PATCH /api/v1/users/me/onboarding
 * 更新当前用户的 Onboarding 步骤状态（合并更新）
 */
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readValidatedBody(event, Body.parse)
  const updated = await UserDAO.updateOnboardingState(userId, body)
  return { success: true, data: updated }
})
