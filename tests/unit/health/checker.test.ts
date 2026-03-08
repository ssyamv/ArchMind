import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runHealthCheck } from '~/lib/health/checker'

// Mock DB client
vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn(),
  },
}))

// Mock storage factory
vi.mock('~/lib/storage/storage-factory', () => ({
  getStorageClient: vi.fn(),
}))

import { dbClient } from '~/lib/db/client'
import { getStorageClient } from '~/lib/storage/storage-factory'

const mockDbQuery = vi.mocked(dbClient.query)
const mockGetStorage = vi.mocked(getStorageClient)

describe('runHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns healthy when all checks pass', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
    mockDbQuery.mockResolvedValueOnce({ rows: [{ extname: 'vector' }] } as any)
    mockGetStorage.mockReturnValue({
      getProviderName: () => 'huawei-obs',
    } as any)

    const result = await runHealthCheck()

    expect(result.status).toBe('healthy')
    expect(result.checks.database.status).toBe('ok')
    expect(result.checks.pgvector.status).toBe('ok')
    expect(result.checks.storage.status).toBe('ok')
    expect(result.version).toBeDefined()
    expect(result.timestamp).toBeDefined()
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('returns unhealthy when database is down', async () => {
    mockDbQuery
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    mockGetStorage.mockReturnValue({ getProviderName: () => 'huawei-obs' } as any)

    const result = await runHealthCheck()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.database.status).toBe('error')
    expect(result.checks.database.error).toContain('ECONNREFUSED')
  })

  it('returns degraded when storage is unavailable', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ extname: 'vector' }] } as any)
    mockGetStorage.mockReturnValue({
      getProviderName: () => { throw new Error('OBS connection error') },
    } as any)

    const result = await runHealthCheck()

    expect(result.status).toBe('degraded')
    expect(result.checks.storage.status).toBe('error')
    expect(result.checks.database.status).toBe('ok')
    expect(result.checks.pgvector.status).toBe('ok')
  })

  it('returns unhealthy when pgvector extension is missing', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
    mockGetStorage.mockReturnValue({ getProviderName: () => 'huawei-obs' } as any)

    const result = await runHealthCheck()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.pgvector.status).toBe('error')
    expect(result.checks.pgvector.error).toContain('pgvector extension not installed')
  })

  it('uses storage.healthCheck() when available', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ extname: 'vector' }] } as any)
    const mockHealthCheck = vi.fn().mockResolvedValue(true)
    mockGetStorage.mockReturnValue({
      healthCheck: mockHealthCheck,
      getProviderName: () => 'huawei-obs',
    } as any)

    const result = await runHealthCheck()

    expect(mockHealthCheck).toHaveBeenCalled()
    expect(result.checks.storage.status).toBe('ok')
  })

  it('reports error when storage.healthCheck() returns false', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ extname: 'vector' }] } as any)
    mockGetStorage.mockReturnValue({
      healthCheck: vi.fn().mockResolvedValue(false),
      getProviderName: () => 'huawei-obs',
    } as any)

    const result = await runHealthCheck()

    expect(result.checks.storage.status).toBe('error')
    expect(result.status).toBe('degraded')
  })
})
