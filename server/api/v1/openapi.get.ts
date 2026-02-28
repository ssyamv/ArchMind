/**
 * GET /api/v1/openapi
 * 返回完整的 OpenAPI 3.0.3 规范文档（JSON 格式）
 * 供 Scalar UI 和外部工具使用
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler((event) => {
  // 允许跨域访问（便于 Swagger Editor 等外部工具直接读取）
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300' // 缓存 5 分钟
  })

  const specPath = join(process.cwd(), 'docs', 'api', 'openapi.json')

  if (!existsSync(specPath)) {
    throw createError({
      statusCode: 404,
      message: 'OpenAPI 文档未生成，请运行 pnpm docs:api'
    })
  }

  const spec = JSON.parse(readFileSync(specPath, 'utf-8'))

  // 动态注入当前服务器地址
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${protocol}://${host}`

  // 将本地开发服务器地址更新为当前实际地址
  if (spec.servers && spec.servers.length > 0) {
    spec.servers[0] = { url: baseUrl, description: '当前服务器' }
  }

  return spec
})
