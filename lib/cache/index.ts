/**
 * 统一缓存模块
 *
 * 支持两种后端：
 * 1. Redis（生产推荐）：配置 REDIS_URL 环境变量启用
 * 2. 内存缓存（开发友好）：未配置 REDIS_URL 时自动降级，支持 TTL
 *
 * 用法：
 * ```typescript
 * import { cache } from '~/lib/cache'
 *
 * // 读取
 * const value = await cache.get<MyType>('my-key')
 *
 * // 写入（TTL 单位：秒）
 * await cache.set('my-key', data, 600)
 *
 * // 删除
 * await cache.del('my-key')
 *
 * // 带自动填充
 * const result = await cache.getOrSet('my-key', () => expensiveFn(), 600)
 * ```
 */

import Redis from 'ioredis'

// ─── 接口定义 ──────────────────────────────────────────────────────────────────

export interface CacheDriver {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  delPattern(pattern: string): Promise<void>
  flush(): Promise<void>
  isConnected(): boolean
}

// ─── 内存缓存（开发环境降级方案） ───────────────────────────────────────────────

interface MemoryCacheEntry<T> {
  value: T
  expiresAt: number | null  // null = 永不过期
}

class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, MemoryCacheEntry<unknown>>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as MemoryCacheEntry<T> | undefined
    if (!entry) return null

    // 惰性过期
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    // 将 glob 模式转换为正则（仅支持 * 通配符）
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }

  async flush(): Promise<void> {
    this.store.clear()
  }

  isConnected(): boolean {
    return true
  }
}

// ─── Redis 缓存 ───────────────────────────────────────────────────────────────

class RedisCacheDriver implements CacheDriver {
  private client: Redis
  private _connected = false

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true
    })

    this.client.on('ready', () => {
      this._connected = true
      console.log('[Cache] Redis connected')
    })

    this.client.on('error', (err) => {
      this._connected = false
      console.error('[Cache] Redis error:', err.message)
    })

    this.client.on('close', () => {
      this._connected = false
    })

    // 异步连接，不阻塞启动
    this.client.connect().catch((err) => {
      console.error('[Cache] Redis connect failed:', err.message)
    })
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch (err) {
      console.error('[Cache] Redis get error:', err)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized)
      } else {
        await this.client.set(key, serialized)
      }
    } catch (err) {
      console.error('[Cache] Redis set error:', err)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (err) {
      console.error('[Cache] Redis del error:', err)
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      // 使用 SCAN 避免 KEYS 在大数据集下阻塞
      let cursor = '0'
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await this.client.del(...keys)
        }
      } while (cursor !== '0')
    } catch (err) {
      console.error('[Cache] Redis delPattern error:', err)
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushdb()
    } catch (err) {
      console.error('[Cache] Redis flush error:', err)
    }
  }

  isConnected(): boolean {
    return this._connected
  }
}

// ─── 统一缓存门面 ──────────────────────────────────────────────────────────────

class Cache implements CacheDriver {
  private driver: CacheDriver

  constructor() {
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      this.driver = new RedisCacheDriver(redisUrl)
      console.log('[Cache] Using Redis backend:', redisUrl.replace(/:\/\/.*@/, '://***@'))
    } else {
      this.driver = new MemoryCacheDriver()
      console.log('[Cache] REDIS_URL not set, using in-memory cache (development mode)')
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return this.driver.get<T>(key)
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.driver.set(key, value, ttlSeconds)
  }

  async del(key: string): Promise<void> {
    return this.driver.del(key)
  }

  async delPattern(pattern: string): Promise<void> {
    return this.driver.delPattern(pattern)
  }

  async flush(): Promise<void> {
    return this.driver.flush()
  }

  isConnected(): boolean {
    return this.driver.isConnected()
  }

  /**
   * 读取缓存，若未命中则执行 fetcher 并将结果写入缓存
   *
   * @param key - 缓存键
   * @param fetcher - 缓存未命中时执行的函数
   * @param ttlSeconds - 缓存有效期（秒），默认 300s
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const fresh = await fetcher()
    await this.set(key, fresh, ttlSeconds)
    return fresh
  }
}

// ─── 单例导出 ──────────────────────────────────────────────────────────────────

// 服务端单例，避免多次实例化（Nitro 热重载时保留连接）
let _cache: Cache | null = null

export function getCache(): Cache {
  if (!_cache) {
    _cache = new Cache()
  }
  return _cache
}

export const cache = getCache()
