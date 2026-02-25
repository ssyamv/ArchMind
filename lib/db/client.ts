/**
 * PostgreSQL 数据库客户端
 * 使用 pg 连接池管理数据库连接
 */

import { Pool } from 'pg'
import type { PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { dbLogger } from '~/lib/logger'

export class DatabaseClient {
  private pool: Pool
  private static instance: DatabaseClient | undefined

  private constructor () {
    const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME
    const poolConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      // Serverless 环境使用更小的连接池，避免超出连接数限制
      min: isServerless ? 0 : (Number(process.env.DATABASE_POOL_MIN) || 2),
      max: isServerless ? 3 : (Number(process.env.DATABASE_POOL_MAX) || 10),
      idleTimeoutMillis: isServerless ? 5000 : 30000,
      connectionTimeoutMillis: 5000,
      // SSL 配置：Neon/生产环境强制启用，等同于 sslmode=verify-full
      // 注意：pg v9 之后 sslmode=require/prefer/verify-ca 语义会改变，显式配置对象以消除警告
      ssl: (process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production')
        ? { rejectUnauthorized: true }
        : undefined
    }

    this.pool = new Pool(poolConfig)

    // 连接池错误处理（Serverless 环境不 exit）
    this.pool.on('error', (err) => {
      dbLogger.error({ err }, 'Unexpected error on idle client')
      if (!process.env.VERCEL) {
        process.exit(-1)
      }
    })
  }

  public static getInstance (): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient()
    }
    return DatabaseClient.instance
  }

  public getPool (): Pool {
    return this.pool
  }

  // 执行查询
  public query<T extends QueryResultRow = any> (text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params)
  }

  // 获取单个客户端连接（用于事务）
  public getClient (): Promise<PoolClient> {
    return this.pool.connect()
  }

  // 事务支持
  public async transaction<T> (fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // 健康检查
  public async healthCheck (): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW()')
      dbLogger.info({ connectedAt: result.rows[0].now }, 'Database connected')
      return true
    } catch (error) {
      dbLogger.error({ err: error }, 'Database connection failed')
      return false
    }
  }

  // 关闭连接池
  public async close (): Promise<void> {
    await this.pool.end()
    dbLogger.info('Database pool closed')
  }
}

// 导出单例实例
export const dbClient = DatabaseClient.getInstance()
export const pool = dbClient.getPool()

// 导出 Drizzle ORM 实例
export const db = drizzle(pool, { schema })

export default dbClient
