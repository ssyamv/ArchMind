/**
 * 用户登出接口
 * POST /api/auth/logout
 */

import type { AuthResponse } from '~/types/auth'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  try {
    // 清除 Cookie
    deleteCookie(event, 'auth_token', {
      path: '/'
    })

    return {
      success: true,
      message: '已成功登出'
    }
  } catch (error: any) {
    console.error('登出失败:', error)
    throw createError({
      statusCode: 500,
      message: '登出失败，请稍后重试'
    })
  }
})
