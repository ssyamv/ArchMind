/**
 * 用户登录接口
 * POST /api/auth/login
 */

import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { verifyPassword } from '~/server/utils/password'
import { generateToken } from '~/server/utils/jwt'
import type { LoginRequest, AuthResponse } from '~/types/auth'

// 请求体验证 schema
const loginSchema = z.object({
  email: z.string().email('无效的邮箱地址'),
  password: z.string().min(1, '请输入密码')
})

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  try {
    // 解析并验证请求体
    const body = await readBody<LoginRequest>(event)
    const validatedData = loginSchema.parse(body)

    // 检查用户是否存在
    const user = await UserDAO.getByEmail(validatedData.email)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '邮箱或密码错误'
      })
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      throw createError({
        statusCode: 403,
        message: '账号已被禁用，请联系管理员'
      })
    }

    // 获取密码哈希并验证
    const passwordHash = await UserDAO.getPasswordHashByEmail(validatedData.email)
    if (!passwordHash) {
      throw createError({
        statusCode: 401,
        message: '邮箱或密码错误'
      })
    }

    const isPasswordValid = await verifyPassword(validatedData.password, passwordHash)
    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        message: '邮箱或密码错误'
      })
    }

    // 生成 JWT Token
    const token = generateToken({ userId: user.id })

    // 设置 HTTP-Only Cookie
    setCookie(event, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/'
    })

    return {
      success: true,
      user
    }
  } catch (error: any) {
    // Zod 验证错误
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: error.errors[0]?.message || '输入数据无效'
      })
    }

    // 已经是 HTTP 错误，直接抛出
    if (error.statusCode) {
      throw error
    }

    // 其他错误
    console.error('登录失败:', error)
    throw createError({
      statusCode: 500,
      message: '登录失败，请稍后重试'
    })
  }
})
