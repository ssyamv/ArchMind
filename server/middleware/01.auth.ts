/**
 * 全局认证中间件
 *
 * 拦截所有 /api/ 请求（白名单路径除外），
 * 从 Cookie 中提取 JWT 并验证，将 userId 注入 event.context。
 */

import { verifyToken } from '~/server/utils/jwt'

// 不需要认证的路径
const PUBLIC_PATH_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/health',
  '/api/v1/share/'
]

function isPublicPath (path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
}

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''
  const path = url.split('?')[0]

  // 只拦截 API v1 路由
  if (!path.startsWith('/api/v1/')) return

  // 白名单路径跳过认证
  if (isPublicPath(path)) return

  // 提取并验证 JWT
  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({
      statusCode: 401,
      message: '未登录，请先登录'
    })
  }

  const payload = verifyToken(token)
  if (!payload) {
    throw createError({
      statusCode: 401,
      message: 'Token 无效或已过期，请重新登录'
    })
  }

  // 注入 userId 到 event.context
  event.context.userId = payload.userId
})
