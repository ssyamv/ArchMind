/**
 * 获取当前登录用户信息
 * GET /api/auth/me
 */

import { UserDAO } from '~/lib/db/dao/user-dao'
import type { AuthResponse } from '~/types/auth'

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  try {
    const userId = requireAuth(event)

    // 获取用户信息
    const user = await UserDAO.getById(userId)
    if (!user) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      return {
        success: false,
        message: '账号已被禁用'
      }
    }

    // 处理头像 URL
    let avatarUrl: string | undefined = user.avatarUrl || undefined

    // 如果头像 URL 是对象键格式（以 avatars/ 开头），使用代理 URL
    if (user.avatarUrl && user.avatarUrl.startsWith('avatars/')) {
      avatarUrl = `/api/user/avatar/${user.id}`
    }
    // 如果是 http(s):// 开头的 URL（旧的公开 URL 格式），直接使用

    // 返回用户信息
    return {
      success: true,
      user: {
        ...user,
        avatarUrl
      }
    }
  } catch (error: any) {
    console.error('获取用户信息失败:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: '获取用户信息失败'
    }
  }
})
