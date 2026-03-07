/**
 * 批量操作通用处理器
 *
 * 设计原则：
 * - 部分失败不终止整批：每一项独立处理，失败的记录到 errors 中
 * - 并发控制：避免同时发起过多数据库请求
 * - 统一响应格式：{ total, succeeded, failed, errors }
 */

export interface BatchItem {
  id: string
}

export interface BatchError {
  id: string
  code: string
  message: string
}

export interface BatchResult {
  total: number
  succeeded: number
  failed: number
  errors: BatchError[]
}

export interface BatchHandlerOptions<T extends BatchItem> {
  items: T[]
  /** 并发数，默认 5 */
  maxConcurrency?: number
  handler: (item: T) => Promise<void>
  /** 单条失败时的自定义错误码（默认 'INTERNAL_ERROR'） */
  defaultErrorCode?: string
}

/**
 * 运行批量操作，部分失败不影响其他项继续执行
 */
export async function runBatch<T extends BatchItem> (
  options: BatchHandlerOptions<T>
): Promise<BatchResult> {
  const { items, maxConcurrency = 5, handler, defaultErrorCode = 'INTERNAL_ERROR' } = options

  const errors: BatchError[] = []
  let succeeded = 0

  // 使用简单的队列控制并发
  const semaphore = {
    current: 0,
    max: maxConcurrency,
    queue: [] as Array<() => void>,

    acquire (): Promise<void> {
      if (this.current < this.max) {
        this.current++
        return Promise.resolve()
      }
      return new Promise(resolve => {
        this.queue.push(() => {
          this.current++
          resolve()
        })
      })
    },

    release () {
      this.current--
      const next = this.queue.shift()
      if (next) next()
    },
  }

  await Promise.all(
    items.map(async (item) => {
      await semaphore.acquire()
      try {
        await handler(item)
        succeeded++
      } catch (err: any) {
        const code = err?.statusCode === 403 ? 'FORBIDDEN'
          : err?.statusCode === 404 ? 'NOT_FOUND'
            : defaultErrorCode
        errors.push({
          id: item.id,
          code,
          message: err?.data?.message || err?.message || '操作失败',
        })
      } finally {
        semaphore.release()
      }
    })
  )

  return {
    total: items.length,
    succeeded,
    failed: errors.length,
    errors,
  }
}
