/**
 * 重置密码 API
 * 使用 Token 或验证码重置密码
 */

import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { hashPassword } from '~/server/utils/password'
import { generateToken, setAuthCookie } from '~/server/utils/jwt'

const ResetPasswordSchema = z.object({
  token: z.string().optional(),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少需要 8 个字符'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
})

export default defineEventHandler(async (event) => {
  // 验证输入
  const body = await readBody(event)
  const { token, email, password } = ResetPasswordSchema.parse(body)

  if (!token) {
    throw createError({
      statusCode: 400,
      message: '重置令牌无效'
    })
  }

  // 验证 Token 并获取用户
  const user = await UserDAO.getByResetToken(token)

  if (!user || user.email !== email) {
    throw createError({
      statusCode: 400,
      message: '重置令牌无效或已过期'
    })
  }

  // 哈希新密码
  const passwordHash = await hashPassword(password)

  // 重置密码
  const updatedUser = await UserDAO.resetPassword(token, passwordHash)

  if (!updatedUser) {
    throw createError({
      statusCode: 500,
      message: '重置密码失败，请重试'
    })
  }

  // 生成 JWT Token 并设置 Cookie（自动登录）
  const jwtToken = generateToken({ userId: updatedUser.id })
  setAuthCookie(event, jwtToken)

  return {
    success: true,
    message: '密码重置成功',
    user: updatedUser
  }
})
