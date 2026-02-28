/**
 * 用户注册接口
 * POST /api/auth/register
 */

import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { hashPassword } from '~/server/utils/password'
import { generateToken } from '~/server/utils/jwt'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { dbClient } from '~/lib/db/client'
import type { RegisterRequest, AuthResponse } from '~/types/auth'

// 预设头像背景色
const AVATAR_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FF9800', '#FF5722', '#795548', '#607D8B'
]

function pickColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function generateSvgAvatar(letter: string, color: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="128" fill="${color}"/>
  <text x="128" y="128" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="120" font-weight="600" fill="rgba(255,255,255,0.95)" text-anchor="middle" dominant-baseline="central">${letter.toUpperCase()}</text>
</svg>`
  return Buffer.from(svg, 'utf-8')
}

// 请求体验证 schema
const registerSchema = z.object({
  email: z.string().email('无效的邮箱地址'),
  password: z.string().min(8, '密码至少需要 8 个字符'),
  fullName: z.string().min(1).max(100).optional()
})

// 生成随机用户名
function generateUsername(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'user_'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const t = useServerT(event)
  try {
    // 解析并验证请求体
    const body = await readBody<RegisterRequest>(event)
    const validatedData = registerSchema.parse(body)

    // 检查邮箱是否已存在
    const emailExists = await UserDAO.emailExists(validatedData.email)
    if (emailExists) {
      throw createError({
        statusCode: 400,
        message: '该邮箱已被注册'
      })
    }

    // 生成唯一的用户名
    let username = generateUsername()
    let attempts = 0
    while (await UserDAO.usernameExists(username)) {
      username = generateUsername()
      attempts++
      if (attempts > 10) {
        throw createError({
          statusCode: 500,
          message: '无法生成唯一用户名，请稍后重试'
        })
      }
    }

    // 哈希密码
    const passwordHash = await hashPassword(validatedData.password)

    // 在事务中原子性地创建用户、默认工作区和成员关系
    const user = await dbClient.transaction(async (client) => {
      const now = new Date().toISOString()
      const userId = crypto.randomUUID()
      const workspaceId = crypto.randomUUID()
      const memberId = crypto.randomUUID()
      const displayName = validatedData.fullName || username

      // 1. 创建用户
      const userResult = await client.query<any>(
        `INSERT INTO users (id, email, username, password_hash, full_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, validatedData.email, username, passwordHash, validatedData.fullName || null, now, now]
      )
      const newUser = {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        email: userResult.rows[0].email,
        fullName: userResult.rows[0].full_name,
        avatarUrl: userResult.rows[0].avatar_url,
        isActive: userResult.rows[0].is_active,
        createdAt: userResult.rows[0].created_at,
        updatedAt: userResult.rows[0].updated_at
      }

      // 2. 创建个人默认工作区（名称根据用户语言动态生成）
      const workspaceName = t('workspace.defaultWorkspaceName').replace('{name}', displayName)
      await client.query(
        `INSERT INTO workspaces (id, name, description, icon, color, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [workspaceId, workspaceName, '个人默认工作区', '🏠', '#3B82F6', false, now, now]
      )

      // 3. 将用户加入工作区（owner 角色）
      await client.query(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role)
         VALUES ($1, $2, $3, $4)`,
        [memberId, workspaceId, userId, 'owner']
      )

      return newUser
    })

    // 生成默认头像（SVG 彩色字母头像）
    try {
      const seed = validatedData.fullName || username || validatedData.email
      const letter = seed.trim().charAt(0) || 'U'
      const color = pickColor(validatedData.email)
      const svgBuffer = generateSvgAvatar(letter, color)
      const objectKey = `avatars/${user.id}.svg`
      const storage = getStorageClient()
      await storage.uploadFile(objectKey, svgBuffer, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000'
      })
      await UserDAO.update(user.id, { avatarUrl: objectKey })
      user.avatarUrl = `/api/user/avatar/${user.id}`
    } catch (avatarError) {
      // 头像生成失败不影响注册流程
      console.warn('[Register] Failed to generate default avatar:', avatarError)
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
    console.error('注册失败:', error)
    throw createError({
      statusCode: 500,
      message: '注册失败，请稍后重试'
    })
  }
})
