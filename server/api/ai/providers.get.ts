/**
 * 获取所有 AI 提供商配置信息
 * GET /api/ai/providers
 */

import { getAllProviders } from '~/lib/ai/providers'

export default defineEventHandler((event) => {
  requireAuth(event)

  const providers = getAllProviders()

  return {
    success: true,
    data: providers
  }
})
