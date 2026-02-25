/**
 * 获取用户所有 API 配置
 * GET /api/ai/configs
 */

import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const configs = await UserAPIConfigDAO.getAll(userId)

    return {
      success: true,
      data: configs
    }
  } catch (error: any) {
    console.error('Failed to fetch API configs:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: error.message || 'Failed to fetch API configurations'
    }
  }
})
