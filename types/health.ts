export interface CheckResult {
  status: 'ok' | 'error'
  latencyMs: number
  error?: string
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  timestamp: string
  checks: {
    database: CheckResult
    pgvector: CheckResult
    storage: CheckResult
  }
  responseTimeMs: number
}
