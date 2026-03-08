import { runHealthCheck } from '~/lib/health/checker'

export default defineEventHandler(async (event) => {
  try {
    const result = await runHealthCheck()

    if (result.status === 'unhealthy') {
      setResponseStatus(event, 503)
    }

    return {
      // 向后兼容旧字段
      status: result.status === 'healthy' ? 'ok' : 'error',
      message: result.status === 'healthy' ? 'API is running' : 'Service degraded',
      timestamp: result.timestamp,
      // 新增详情字段
      details: result,
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
})
