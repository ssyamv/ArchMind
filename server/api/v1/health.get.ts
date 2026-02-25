import { dbClient } from '~/lib/db/client'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const isHealthy = await dbClient.healthCheck()

    if (isHealthy) {
      return {
        status: 'ok',
        message: t('errors.apiRunning'),
        timestamp: new Date().toISOString()
      }
    } else {
      setResponseStatus(event, 503)
      return {
        status: 'error',
        message: t('errors.databaseConnectionFailed'),
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      status: 'error',
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
      timestamp: new Date().toISOString()
    }
  }
})
