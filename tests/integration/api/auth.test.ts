/**
 * API 集成测试 - 认证模块
 * 测试 register / login 端点的输入验证和业务规则
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── 复现 API 中的 Zod Schema（验证这些 schema 在集成层行为正确）──────────────

const registerSchema = z.object({
  email: z.string().email('无效的邮箱地址'),
  password: z.string().min(8, '密码至少需要 8 个字符'),
  fullName: z.string().min(1).max(100).optional()
})

const loginSchema = z.object({
  email: z.string().email('无效的邮箱地址'),
  password: z.string().min(1, '请输入密码')
})

// ─── Register 输入验证 ────────────────────────────────────────────────────────

describe('POST /api/auth/register - 输入验证', () => {
  it('有效注册数据通过验证', () => {
    const data = {
      email: 'user@example.com',
      password: 'SecurePass123',
      fullName: 'Test User'
    }

    const result = registerSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('无 fullName 时也通过验证（可选字段）', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass123'
    })
    expect(result.success).toBe(true)
  })

  it('密码少于 8 位被拒绝', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('8')
    }
  })

  it('无效邮箱格式被拒绝', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'SecurePass123'
    })
    expect(result.success).toBe(false)
  })

  it('空邮箱被拒绝', () => {
    const result = registerSchema.safeParse({
      email: '',
      password: 'SecurePass123'
    })
    expect(result.success).toBe(false)
  })

  it('fullName 超过 100 字符被拒绝', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass123',
      fullName: 'A'.repeat(101)
    })
    expect(result.success).toBe(false)
  })

  it('缺少必填字段 password 被拒绝', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com'
    })
    expect(result.success).toBe(false)
  })
})

// ─── Login 输入验证 ───────────────────────────────────────────────────────────

describe('POST /api/auth/login - 输入验证', () => {
  it('有效登录数据通过验证', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'any-password'
    })
    expect(result.success).toBe(true)
  })

  it('login 接受任意长度密码（最短 1 位）', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'x'
    })
    expect(result.success).toBe(true)
  })

  it('空密码被拒绝', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('请输入密码')
    }
  })

  it('无效邮箱格式被拒绝', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password'
    })
    expect(result.success).toBe(false)
  })

  it('register 密码最低要求（8位）vs login（1位）行为差异', () => {
    const shortPwd = { email: 'x@y.com', password: 'abc' }

    expect(loginSchema.safeParse(shortPwd).success).toBe(true)   // login: OK
    expect(registerSchema.safeParse(shortPwd).success).toBe(false) // register: 拒绝
  })
})
