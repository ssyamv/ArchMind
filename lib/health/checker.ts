import { dbClient } from '~/lib/db/client'
import { getStorageClient } from '~/lib/storage/storage-factory'
import type { CheckResult, HealthCheckResult } from '~/types/health'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ])
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    await dbClient.query('SELECT 1')
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (e) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(e) }
  }
}

async function checkPgVector(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const result = await dbClient.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
    )
    if (!result.rows.length) throw new Error('pgvector extension not installed')
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (e) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(e) }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const storage = getStorageClient()
    if (storage.healthCheck) {
      const ok = await storage.healthCheck()
      if (!ok) throw new Error('Storage health check failed')
    } else {
      // Fallback: check if getProviderName works (client is initialised)
      storage.getProviderName()
    }
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (e) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(e) }
  }
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const globalStart = Date.now()

  const [database, pgvector, storage] = await Promise.all([
    withTimeout(checkDatabase(), 3000),
    withTimeout(checkPgVector(), 3000),
    withTimeout(checkStorage(), 5000),
  ])

  const checks = { database, pgvector, storage }

  const isUnhealthy = database.status === 'error' || pgvector.status === 'error'
  const isDegraded = storage.status === 'error'

  return {
    status: isUnhealthy ? 'unhealthy' : isDegraded ? 'degraded' : 'healthy',
    version: process.env.npm_package_version ?? 'unknown',
    timestamp: new Date().toISOString(),
    checks,
    responseTimeMs: Date.now() - globalStart,
  }
}
