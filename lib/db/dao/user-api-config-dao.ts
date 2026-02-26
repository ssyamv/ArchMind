/**
 * 用户 API 配置 DAO
 * 管理用户配置的第三方模型 API Key（加密存储）
 * 所有操作按 userId 隔离
 */

import { dbClient } from '../client'
import crypto from 'crypto'

// 加密算法配置
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
// Note: AUTH_TAG_LENGTH is defined by the cipher (16 bytes for AES-GCM)
const SALT_LENGTH = 32

// 从环境变量获取加密密钥，开发环境使用安全默认值，生产环境强制要求配置
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: API_KEY_ENCRYPTION_SECRET must be set in production')
    }
    // 开发/测试环境：使用固定默认密钥（注意：与旧版 'archmind-default-secret' 不同，本地重置即可）
    console.warn('WARNING: API_KEY_ENCRYPTION_SECRET not set, using dev default. Do NOT use in production!')
    return crypto.scryptSync('archmind-dev-only-secret', 'archmind-dev-salt', KEY_LENGTH)
  }
  return crypto.scryptSync(secret, 'archmind-salt', KEY_LENGTH)
}

export interface UserAPIConfigRecord {
  id: string
  userId: string
  provider: string
  apiKeyEncrypted: string | null
  baseUrl: string | null
  models: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface UserAPIConfigData {
  provider: string
  apiKey?: string
  baseUrl?: string
  models?: string[]
  enabled?: boolean
}

export class UserAPIConfigDAO {
  private static encryptionKey: Buffer = getEncryptionKey()

  /**
   * 加密 API Key
   */
  private static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)

    // 使用 salt 派生密钥
    const key = crypto.pbkdf2Sync(
      this.encryptionKey.toString('hex'),
      salt,
      100000,
      KEY_LENGTH,
      'sha256'
    )

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // 格式: salt:iv:authTag:encrypted
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  /**
   * 解密 API Key
   */
  private static decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':')
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format')
    }

    const [saltHex, ivHex, authTagHex, encrypted] = parts
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    // 使用 salt 派生密钥
    const key = crypto.pbkdf2Sync(
      this.encryptionKey.toString('hex'),
      salt,
      100000,
      KEY_LENGTH,
      'sha256'
    )

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 获取指定用户指定提供商的配置
   */
  static async get(userId: string, provider: string): Promise<UserAPIConfigRecord | null> {
    const sql = 'SELECT * FROM user_api_configs WHERE user_id = $1 AND provider = $2'
    const result = await dbClient.query<any>(sql, [userId, provider])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToRecord(result.rows[0])
  }

  /**
   * 获取指定用户的所有配置
   */
  static async getAll(userId: string): Promise<UserAPIConfigRecord[]> {
    const sql = 'SELECT * FROM user_api_configs WHERE user_id = $1 ORDER BY provider'
    const result = await dbClient.query<any>(sql, [userId])

    return result.rows.map(row => this.mapRowToRecord(row))
  }

  /**
   * 获取指定用户所有已启用的配置（包含解密后的 API Key）
   * 仅在服务端使用！
   */
  static async getAllEnabledWithKeys(userId: string): Promise<Array<{ provider: string; apiKey: string | null; baseUrl: string | null; models: string[] }>> {
    const sql = 'SELECT * FROM user_api_configs WHERE user_id = $1 AND enabled = true'
    const result = await dbClient.query<any>(sql, [userId])

    return result.rows.map(row => ({
      provider: row.provider,
      apiKey: row.api_key_encrypted ? this.decrypt(row.api_key_encrypted) : null,
      baseUrl: row.base_url,
      models: Array.isArray(row.models) ? row.models : []
    }))
  }

  /**
   * 保存或更新指定用户的配置
   */
  static async upsert(userId: string, data: UserAPIConfigData): Promise<UserAPIConfigRecord> {
    const now = new Date().toISOString()
    const encryptedKey = data.apiKey ? this.encrypt(data.apiKey) : null
    const modelsJson = data.models ? JSON.stringify(data.models) : null

    const sql = `
      INSERT INTO user_api_configs (user_id, provider, api_key_encrypted, base_url, models, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        api_key_encrypted = COALESCE($3, user_api_configs.api_key_encrypted),
        base_url = COALESCE($4, user_api_configs.base_url),
        models = COALESCE($5::jsonb, user_api_configs.models),
        enabled = COALESCE($6, user_api_configs.enabled),
        updated_at = $7
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      userId,
      data.provider,
      encryptedKey,
      data.baseUrl || null,
      modelsJson,
      data.enabled ?? true,
      now
    ])

    return this.mapRowToRecord(result.rows[0])
  }

  /**
   * 删除指定用户的配置
   */
  static async delete(userId: string, provider: string): Promise<boolean> {
    const sql = 'DELETE FROM user_api_configs WHERE user_id = $1 AND provider = $2'
    const result = await dbClient.query(sql, [userId, provider])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * 启用/禁用指定用户的配置
   */
  static async setEnabled(userId: string, provider: string, enabled: boolean): Promise<boolean> {
    const sql = 'UPDATE user_api_configs SET enabled = $1, updated_at = NOW() WHERE user_id = $2 AND provider = $3'
    const result = await dbClient.query(sql, [enabled, userId, provider])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * 检查指定用户的配置是否存在且已启用
   */
  static async isEnabled(userId: string, provider: string): Promise<boolean> {
    const sql = 'SELECT enabled FROM user_api_configs WHERE user_id = $1 AND provider = $2'
    const result = await dbClient.query<any>(sql, [userId, provider])

    if (result.rows.length === 0) {
      return false
    }

    return result.rows[0].enabled
  }

  /**
   * 获取解密后的 API Key（仅在服务端使用！）
   */
  static async getDecryptedKey(userId: string, provider: string): Promise<string | null> {
    const sql = 'SELECT api_key_encrypted FROM user_api_configs WHERE user_id = $1 AND provider = $2 AND enabled = true'
    const result = await dbClient.query<any>(sql, [userId, provider])

    if (result.rows.length === 0 || !result.rows[0].api_key_encrypted) {
      return null
    }

    return this.decrypt(result.rows[0].api_key_encrypted)
  }

  /**
   * 获取完整配置（包含解密后的 API Key）
   * 仅在服务端使用！
   */
  static async getFullConfig(userId: string, provider: string): Promise<{ provider: string; apiKey: string | null; baseUrl: string | null; models: string[]; enabled: boolean } | null> {
    const sql = 'SELECT * FROM user_api_configs WHERE user_id = $1 AND provider = $2'
    const result = await dbClient.query<any>(sql, [userId, provider])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      provider: row.provider,
      apiKey: row.api_key_encrypted ? this.decrypt(row.api_key_encrypted) : null,
      baseUrl: row.base_url,
      models: Array.isArray(row.models) ? row.models : [],
      enabled: row.enabled
    }
  }

  private static mapRowToRecord(row: any): UserAPIConfigRecord {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      apiKeyEncrypted: row.api_key_encrypted ? '********' : null, // 不暴露加密数据
      baseUrl: row.base_url,
      models: Array.isArray(row.models) ? row.models : [],
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
