/**
 * JWT 工具函数
 * 用于生成和验证 JSON Web Token
 */

import jwt from 'jsonwebtoken'
import type { JwtPayload } from '~/types/auth'

const { sign, verify } = jwt

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production')
}
const JWT_SECRET = process.env.JWT_SECRET || 'archmind-dev-secret-do-not-use-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * 生成 JWT Token
 * @param payload Token 载荷
 * @returns 签名后的 Token
 */
export function generateToken(payload: { userId: string }): string {
  // jwt sign accepts expiresIn as string (e.g., '7d') or number (seconds)
  // @ts-expect-error - jsonwebtoken types are too strict, expiresIn accepts string
  return sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * 验证 JWT Token
 * @param token 待验证的 Token
 * @returns 解码后的载荷，验证失败返回 null
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as JwtPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * 从 Token 中提取用户 ID
 * @param token JWT Token
 * @returns 用户 ID，无效则返回 null
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = verifyToken(token)
  return payload?.userId ?? null
}

/**
 * 设置认证 Cookie
 * @param event H3 事件对象
 * @param token JWT Token
 */
export function setAuthCookie(event: any, token: string): void {
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: '/'
  })
}
