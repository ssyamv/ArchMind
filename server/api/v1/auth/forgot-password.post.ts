/**
 * 忘记密码 API
 * 发送重置密码验证码到邮箱
 */

import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { generateVerificationCode, sendPasswordResetEmail } from '~/server/utils/email'

const ForgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址')
})

export default defineEventHandler(async (event) => {
  // 验证输入
  const body = await readBody(event)
  const { email } = ForgotPasswordSchema.parse(body)

  // 检查用户是否存在
  const userExists = await UserDAO.emailExists(email)

  // 即使用户不存在也返回成功（安全考虑，不泄露用户信息）
  if (!userExists) {
    return {
      success: true,
      message: '如果该邮箱已注册，您将收到重置密码的邮件'
    }
  }

  // 生成验证码
  const code = generateVerificationCode()

  // 生成重置 Token（用于 URL 验证）
  const resetToken = crypto.randomUUID()

  // 设置过期时间（15 分钟）
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  // 保存重置 Token 到数据库
  await UserDAO.setResetToken(email, resetToken, expiresAt)

  // 构建重置链接
  const config = useRuntimeConfig()
  const baseUrl = config.public.baseUrl || process.env.BASE_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

  // 发送邮件
  const emailSent = await sendPasswordResetEmail({
    email,
    code,
    resetUrl
  })

  if (!emailSent) {
    // 开发环境返回验证码方便测试
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      console.log(`[DEV] Password reset code for ${email}: ${code}`)
      console.log(`[DEV] Reset URL: ${resetUrl}`)
    }

    return {
      success: true,
      message: '如果该邮箱已注册，您将收到重置密码的邮件',
      // 仅开发环境返回
      ...(isDev && { devCode: code, devResetUrl: resetUrl })
    }
  }

  return {
    success: true,
    message: '如果该邮箱已注册，您将收到重置密码的邮件'
  }
})
