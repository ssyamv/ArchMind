/**
 * #63 批量操作处理器单元测试
 */

import { describe, it, expect } from 'vitest'
import { runBatch } from '~/lib/utils/batch-handler'

describe('runBatch 批量处理器', () => {
  it('所有项成功时 succeeded === total', async () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const result = await runBatch({
      items,
      handler: async () => {},
    })
    expect(result.total).toBe(3)
    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('部分失败时其他项继续执行', async () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const processed: string[] = []

    const result = await runBatch({
      items,
      handler: async ({ id }) => {
        if (id === '2') throw new Error('故意失败')
        processed.push(id)
      },
    })

    expect(result.total).toBe(3)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors[0].id).toBe('2')
    expect(processed).toContain('1')
    expect(processed).toContain('3')
  })

  it('403 错误映射为 FORBIDDEN 错误码', async () => {
    const items = [{ id: '1' }]
    const result = await runBatch({
      items,
      handler: async () => {
        const err = new Error('无权限') as any
        err.statusCode = 403
        throw err
      },
    })
    expect(result.errors[0].code).toBe('FORBIDDEN')
  })

  it('404 错误映射为 NOT_FOUND 错误码', async () => {
    const items = [{ id: '1' }]
    const result = await runBatch({
      items,
      handler: async () => {
        const err = new Error('不存在') as any
        err.statusCode = 404
        throw err
      },
    })
    expect(result.errors[0].code).toBe('NOT_FOUND')
  })

  it('超过 100 条限制时 Schema 校验返回错误', () => {
    const { z } = require('zod')
    const Schema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100, '最多支持 100 条'),
      workspaceId: z.string().uuid(),
    })

    const tooManyIds = Array.from({ length: 101 }, () => crypto.randomUUID())
    const result = Schema.safeParse({
      ids: tooManyIds,
      workspaceId: crypto.randomUUID(),
    })
    expect(result.success).toBe(false)
  })

  it('并发控制：maxConcurrency=2 时同时运行不超过 2 个', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }))

    await runBatch({
      items,
      maxConcurrency: 2,
      handler: async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise(resolve => setTimeout(resolve, 10))
        concurrent--
      },
    })

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })
})
