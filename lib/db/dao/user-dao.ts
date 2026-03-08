/**
 * 用户 DAO
 * 用户数据的增删改查操作
 */

import { dbClient } from '../client'
import type { User } from '~/types/auth'
import type { OnboardingState } from '~/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '~/types/onboarding'

export interface CreateUserInput {
  username: string
  email: string
  passwordHash: string
  fullName?: string
  avatarUrl?: string
}

export interface UpdateUserInput {
  username?: string
  email?: string
  fullName?: string
  avatarUrl?: string
  isActive?: boolean
}

export interface ResetTokenData {
  resetToken: string
  resetTokenExpires: Date
}

export class UserDAO {
  /**
   * 根据 ID 获取用户
   */
  static async getById(id: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 根据邮箱获取用户
   */
  static async getByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = $1'
    const result = await dbClient.query<any>(sql, [email])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 根据用户名获取用户
   */
  static async getByUsername(username: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE username = $1'
    const result = await dbClient.query<any>(sql, [username])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 获取用户的密码哈希（用于验证）
   */
  static async getPasswordHashByEmail(email: string): Promise<string | null> {
    const sql = 'SELECT password_hash FROM users WHERE email = $1'
    const result = await dbClient.query<any>(sql, [email])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].password_hash
  }

  /**
   * 获取用户的密码哈希（通过 ID）
   */
  static async getPasswordHashById(id: string): Promise<string | null> {
    const sql = 'SELECT password_hash FROM users WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].password_hash
  }

  /**
   * 创建用户
   */
  static async create(input: CreateUserInput): Promise<User> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const sql = `
      INSERT INTO users (
        id, username, email, password_hash, full_name, avatar_url, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      input.username,
      input.email,
      input.passwordHash,
      input.fullName || null,
      input.avatarUrl || null,
      true,
      now,
      now
    ])

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 更新用户
   */
  static async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const now = new Date().toISOString()
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (input.username !== undefined) {
      updateFields.push(`username = $${paramIndex++}`)
      values.push(input.username)
    }

    if (input.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`)
      values.push(input.email)
    }

    if (input.fullName !== undefined) {
      updateFields.push(`full_name = $${paramIndex++}`)
      values.push(input.fullName)
    }

    if (input.avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`)
      values.push(input.avatarUrl)
    }

    if (input.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`)
      values.push(input.isActive)
    }

    updateFields.push(`updated_at = $${paramIndex++}`)
    values.push(now)

    values.push(id)

    const sql = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, values)

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 删除用户
   */
  static async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  /**
   * 检查邮箱是否已存在
   */
  static async emailExists(email: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM users WHERE email = $1'
    const result = await dbClient.query(sql, [email])
    return result.rows.length > 0
  }

  /**
   * 检查用户名是否已存在
   */
  static async usernameExists(username: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM users WHERE username = $1'
    const result = await dbClient.query(sql, [username])
    return result.rows.length > 0
  }

  /**
   * 设置密码重置 Token
   */
  static async setResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const sql = `
      UPDATE users
      SET reset_token = $1, reset_token_expires = $2, updated_at = $3
      WHERE email = $4
    `
    const result = await dbClient.query(sql, [token, expiresAt.toISOString(), new Date().toISOString(), email])
    return result.rowCount! > 0
  }

  /**
   * 根据重置 Token 获取用户
   */
  static async getByResetToken(token: string): Promise<User | null> {
    const sql = `
      SELECT * FROM users
      WHERE reset_token = $1 AND reset_token_expires > $2
    `
    const result = await dbClient.query<any>(sql, [token, new Date().toISOString()])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 重置密码
   */
  static async resetPassword(token: string, newPasswordHash: string): Promise<User | null> {
    const now = new Date().toISOString()

    const sql = `
      UPDATE users
      SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = $2
      WHERE reset_token = $3 AND reset_token_expires > $4
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [newPasswordHash, now, token, now])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToUser(result.rows[0])
  }

  /**
   * 清除重置 Token
   */
  static async clearResetToken(email: string): Promise<boolean> {
    const sql = `
      UPDATE users
      SET reset_token = NULL, reset_token_expires = NULL, updated_at = $1
      WHERE email = $2
    `
    const result = await dbClient.query(sql, [new Date().toISOString(), email])
    return result.rowCount! > 0
  }

  /**
   * 获取用户的 Onboarding 状态
   */
  static async getOnboardingState(userId: string): Promise<OnboardingState> {
    const sql = 'SELECT onboarding_state FROM users WHERE id = $1'
    const result = await dbClient.query<{ onboarding_state: any }>(sql, [userId])
    if (result.rows.length === 0) return { ...DEFAULT_ONBOARDING_STATE }
    const raw = result.rows[0].onboarding_state ?? {}
    return { ...DEFAULT_ONBOARDING_STATE, ...raw }
  }

  /**
   * 更新用户的 Onboarding 状态（合并更新，非全量替换）
   */
  static async updateOnboardingState(userId: string, patch: Partial<OnboardingState>): Promise<OnboardingState> {
    const current = await this.getOnboardingState(userId)
    const updated = { ...current, ...patch }
    const sql = `
      UPDATE users
      SET onboarding_state = $1, updated_at = $2
      WHERE id = $3
    `
    await dbClient.query(sql, [JSON.stringify(updated), new Date().toISOString(), userId])
    return updated
  }

  /**
   * 将数据库行映射为 User 对象
   */
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
