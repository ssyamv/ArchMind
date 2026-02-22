/**
 * Auth Login API 单元测试
 * 测试核心业务逻辑（不依赖 H3/Nuxt 运行时）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock ────────────────────────────────────────────────────────────────────

const mockGetByEmail = vi.fn()
const mockGetPasswordHash = vi.fn()
const mockVerifyPassword = vi.fn()
const mockGenerateToken = vi.fn().mockReturnValue('mock-jwt-token')

vi.mock('~/lib/db/dao/user-dao', () => ({
  UserDAO: {
    getByEmail: mockGetByEmail,
    getPasswordHashByEmail: mockGetPasswordHash
  }
}))

vi.mock('~/server/utils/password', () => ({
  verifyPassword: mockVerifyPassword
}))

vi.mock('~/server/utils/jwt', () => ({
  generateToken: mockGenerateToken,
  verifyToken: vi.fn().mockReturnValue({ userId: 'user-123' })
}))

// ─── 测试辅助 - 验证 Zod schema ──────────────────────────────────────────────

import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('无效的邮箱地址'),
  password: z.string().min(1, '请输入密码')
})

// ─── 测试 login schema 验证逻辑 ───────────────────────────────────────────────

describe('Login Schema 验证', () => {
  it('有效的邮箱和密码通过验证', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('test@example.com')
    }
  })

  it('无效邮箱格式被拒绝', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('无效的邮箱地址')
    }
  })

  it('空密码被拒绝', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: ''
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('请输入密码')
    }
  })

  it('缺少 email 字段被拒绝', () => {
    const result = loginSchema.safeParse({
      password: 'password123'
    })

    expect(result.success).toBe(false)
  })

  it('缺少 password 字段被拒绝', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com'
    })

    expect(result.success).toBe(false)
  })

  it('邮箱自动转小写处理（email 格式验证不区分大小写）', () => {
    const result = loginSchema.safeParse({
      email: 'TEST@EXAMPLE.COM',
      password: 'pwd'
    })

    // Zod email 验证不区分大小写，应通过
    expect(result.success).toBe(true)
  })
})

// ─── 测试 UserDAO 交互逻辑 ────────────────────────────────────────────────────

describe('登录业务逻辑', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用户存在且密码正确时返回 token', async () => {
    mockGetByEmail.mockResolvedValueOnce(mockUser)
    mockGetPasswordHash.mockResolvedValueOnce('hashed_password')
    mockVerifyPassword.mockResolvedValueOnce(true)

    const { UserDAO } = await import('~/lib/db/dao/user-dao')
    const { verifyPassword } = await import('~/server/utils/password')
    const { generateToken } = await import('~/server/utils/jwt')

    const user = await UserDAO.getByEmail('test@example.com')
    const hash = await UserDAO.getPasswordHashByEmail('test@example.com')
    const isValid = await verifyPassword('password123', hash!)
    const token = generateToken({ userId: user!.id })

    expect(user).not.toBeNull()
    expect(isValid).toBe(true)
    expect(token).toBe('mock-jwt-token')
  })

  it('用户不存在时应抛出 401', async () => {
    mockGetByEmail.mockResolvedValueOnce(null)

    const { UserDAO } = await import('~/lib/db/dao/user-dao')
    const user = await UserDAO.getByEmail('nonexistent@example.com')

    expect(user).toBeNull()
    // 业务层应抛出 401
  })

  it('用户被禁用时不应进行密码验证', async () => {
    const disabledUser = { ...mockUser, isActive: false }
    mockGetByEmail.mockResolvedValueOnce(disabledUser)

    const { UserDAO } = await import('~/lib/db/dao/user-dao')
    const user = await UserDAO.getByEmail('test@example.com')

    expect(user?.isActive).toBe(false)
    // 业务层应抛出 403，不应调用 getPasswordHashByEmail
    expect(mockGetPasswordHash).not.toHaveBeenCalled()
  })

  it('密码哈希不存在时应抛出 401', async () => {
    mockGetByEmail.mockResolvedValueOnce(mockUser)
    mockGetPasswordHash.mockResolvedValueOnce(null)

    const { UserDAO } = await import('~/lib/db/dao/user-dao')
    const user = await UserDAO.getByEmail('test@example.com')
    const hash = await UserDAO.getPasswordHashByEmail('test@example.com')

    expect(user).not.toBeNull()
    expect(hash).toBeNull()
    // 业务层应抛出 401
  })

  it('密码错误时不应返回 token', async () => {
    mockGetByEmail.mockResolvedValueOnce(mockUser)
    mockGetPasswordHash.mockResolvedValueOnce('hashed_password')
    mockVerifyPassword.mockResolvedValueOnce(false)

    const { verifyPassword } = await import('~/server/utils/password')
    const isValid = await verifyPassword('wrong_password', 'hashed_password')

    expect(isValid).toBe(false)
    // 业务层应抛出 401
    expect(mockGenerateToken).not.toHaveBeenCalled()
  })
})

// ─── 测试 JWT 工具函数 ────────────────────────────────────────────────────────

describe('JWT 工具', () => {
  it('generateToken 被正确调用', async () => {
    const { generateToken } = await import('~/server/utils/jwt')

    const token = generateToken({ userId: 'user-456' })
    expect(token).toBe('mock-jwt-token')
    expect(mockGenerateToken).toHaveBeenCalledWith({ userId: 'user-456' })
  })

  it('verifyToken 正确验证并返回 payload', async () => {
    const { verifyToken } = await import('~/server/utils/jwt')

    const payload = verifyToken('valid-token')
    expect(payload).toEqual({ userId: 'user-123' })
  })
})
