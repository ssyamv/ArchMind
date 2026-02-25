/**
 * 头像代理端点 - 提供固定 URL 以支持浏览器缓存
 * GET /api/user/avatar/:userId
 *
 * 通过服务端从对象存储获取头像并返回，URL 固定不变，
 * 配合 Cache-Control 头让浏览器能正常缓存头像图片。
 */

import { UserDAO } from '~/lib/db/dao/user-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  try {
    const userId = getRouterParam(event, 'userId')

    if (!userId) {
      throw createError({ statusCode: 400, statusMessage: '缺少用户 ID' })
    }

    // 获取用户信息
    const user = await UserDAO.getById(userId)
    if (!user || !user.avatarUrl) {
      throw createError({ statusCode: 404, statusMessage: '头像不存在' })
    }

    // 只处理对象键格式（以 avatars/ 开头）
    if (!user.avatarUrl.startsWith('avatars/')) {
      // 旧的 http(s) URL 格式，重定向过去
      return sendRedirect(event, user.avatarUrl, 302)
    }

    // 计算 ETag（基于用户更新时间）
    const etag = `"${new Date(user.updatedAt).getTime()}"`

    // 支持条件请求：如果浏览器缓存未失效，直接返回 304
    const ifNoneMatch = getRequestHeader(event, 'if-none-match')
    if (ifNoneMatch === etag) {
      setResponseStatus(event, 304)
      return ''
    }

    // 从对象存储获取文件
    const storage = getStorageClient()
    const { buffer, contentType } = await storage.getFile(user.avatarUrl)

    // 设置响应头，启用浏览器缓存
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', // 缓存 1 天，7 天内可使用旧缓存
      'ETag': etag
    })

    return buffer
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error('[Avatar Proxy] 获取头像失败:', error)
    throw createError({ statusCode: 500, statusMessage: '获取头像失败' })
  }
})
