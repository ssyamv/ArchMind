/**
 * 获取用户所有 API 配置
 * GET /api/ai/configs
 */

import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'

export default defineEventHandler(async () => {
  try {
    const configs = await UserAPIConfigDAO.getAll()

    return {
      success: true,
      data: configs
    }
  } catch (error: any) {
    console.error('Failed to fetch API configs:', error)
    return {
      success: false,
      message: error.message || 'Failed to fetch API configurations'
    }
  }
})
