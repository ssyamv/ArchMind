import { runHealthCheck } from '~/lib/health/checker'

export default defineEventHandler(async (event) => {
  const result = await runHealthCheck()
  if (result.status === 'unhealthy') {
    setResponseStatus(event, 503)
  }
  return result
})
