/**
 * 用户 API 配置 DAO
 * 管理用户配置的第三方模型 API Key（加密存储）
 */

import { dbClient } from '../client'
import crypto from 'crypto'

// 加密算法配置
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
// Note: AUTH_TAG_LENGTH is defined by the cipher (16 bytes for AES-GCM)
const SALT_LENGTH = 32

// 从环境变量获取加密密钥，如果没有则生成一个（仅用于开发环境）
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret) {
    // 开发环境下使用默认密钥（生产环境必须设置环境变量）
    console.warn('WARNING: API_KEY_ENCRYPTION_SECRET not set, using default key. This is not secure for production!')
    return crypto.scryptSync('archmind-default-secret', 'salt', KEY_LENGTH)
  }
  return crypto.scryptSync(secret, 'archmind-salt', KEY_LENGTH)
}

export interface UserAPIConfigRecord {
  id: string
  provider: string
  apiKeyEncrypted: string | null
  baseUrl: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface UserAPIConfigData {
  provider: string
  apiKey?: string
  baseUrl?: string
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
   * 获取指定提供商的配置
   */
  static async get(provider: string): Promise<UserAPIConfigRecord | null> {
    const sql = 'SELECT * FROM user_api_configs WHERE provider = $1'
    const result = await dbClient.query<any>(sql, [provider])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToRecord(result.rows[0])
  }

  /**
   * 获取所有配置
   */
  static async getAll(): Promise<UserAPIConfigRecord[]> {
    const sql = 'SELECT * FROM user_api_configs ORDER BY provider'
    const result = await dbClient.query<any>(sql)

    return result.rows.map(row => this.mapRowToRecord(row))
  }

  /**
   * 获取所有已启用的配置（包含解密后的 API Key）
   * 仅在服务端使用！
   */
  static async getAllEnabledWithKeys(): Promise<Array<{ provider: string; apiKey: string | null; baseUrl: string | null }>> {
    const sql = 'SELECT * FROM user_api_configs WHERE enabled = true'
    const result = await dbClient.query<any>(sql)

    return result.rows.map(row => ({
      provider: row.provider,
      apiKey: row.api_key_encrypted ? this.decrypt(row.api_key_encrypted) : null,
      baseUrl: row.base_url
    }))
  }

  /**
   * 保存或更新配置
   */
  static async upsert(data: UserAPIConfigData): Promise<UserAPIConfigRecord> {
    const now = new Date().toISOString()
    const encryptedKey = data.apiKey ? this.encrypt(data.apiKey) : null

    const sql = `
      INSERT INTO user_api_configs (provider, api_key_encrypted, base_url, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT (provider) DO UPDATE SET
        api_key_encrypted = COALESCE($2, user_api_configs.api_key_encrypted),
        base_url = COALESCE($3, user_api_configs.base_url),
        enabled = COALESCE($4, user_api_configs.enabled),
        updated_at = $5
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      data.provider,
      encryptedKey,
      data.baseUrl || null,
      data.enabled ?? true,
      now
    ])

    return this.mapRowToRecord(result.rows[0])
  }

  /**
   * 删除配置
   */
  static async delete(provider: string): Promise<boolean> {
    const sql = 'DELETE FROM user_api_configs WHERE provider = $1'
    const result = await dbClient.query(sql, [provider])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * 启用/禁用配置
   */
  static async setEnabled(provider: string, enabled: boolean): Promise<boolean> {
    const sql = 'UPDATE user_api_configs SET enabled = $1, updated_at = NOW() WHERE provider = $2'
    const result = await dbClient.query(sql, [enabled, provider])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * 检查配置是否存在且已启用
   */
  static async isEnabled(provider: string): Promise<boolean> {
    const sql = 'SELECT enabled FROM user_api_configs WHERE provider = $1'
    const result = await dbClient.query<any>(sql, [provider])

    if (result.rows.length === 0) {
      return false
    }

    return result.rows[0].enabled
  }

  /**
   * 获取解密后的 API Key（仅在服务端使用！）
   */
  static async getDecryptedKey(provider: string): Promise<string | null> {
    const sql = 'SELECT api_key_encrypted FROM user_api_configs WHERE provider = $1 AND enabled = true'
    const result = await dbClient.query<any>(sql, [provider])

    if (result.rows.length === 0 || !result.rows[0].api_key_encrypted) {
      return null
    }

    return this.decrypt(result.rows[0].api_key_encrypted)
  }

  /**
   * 获取完整配置（包含解密后的 API Key）
   * 仅在服务端使用！
   */
  static async getFullConfig(provider: string): Promise<{ provider: string; apiKey: string | null; baseUrl: string | null; enabled: boolean } | null> {
    const sql = 'SELECT * FROM user_api_configs WHERE provider = $1'
    const result = await dbClient.query<any>(sql, [provider])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      provider: row.provider,
      apiKey: row.api_key_encrypted ? this.decrypt(row.api_key_encrypted) : null,
      baseUrl: row.base_url,
      enabled: row.enabled
    }
  }

  private static mapRowToRecord(row: any): UserAPIConfigRecord {
    return {
      id: row.id,
      provider: row.provider,
      apiKeyEncrypted: row.api_key_encrypted ? '********' : null, // 不暴露加密数据
      baseUrl: row.base_url,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
