/**
 * 头像上传
 * POST /api/user/avatar
 */

import { UserDAO } from '~/lib/db/dao/user-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

// 支持的图片类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface AvatarResponse {
  success: boolean
  avatarUrl?: string
  message?: string
}

export default defineEventHandler(async (event): Promise<AvatarResponse> => {
  try {
    const userId = requireAuth(event)

    // 获取上传的文件
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      return {
        success: false,
        message: '未找到上传文件'
      }
    }

    const file = formData.find(f => f.name === 'avatar')

    if (!file || !file.data) {
      return {
        success: false,
        message: '未找到头像文件'
      }
    }

    // 验证文件类型
    if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        message: '不支持的文件类型，仅支持 JPG、PNG、GIF、WebP'
      }
    }

    // 验证文件大小
    if (file.data.length > MAX_FILE_SIZE) {
      return {
        success: false,
        message: '文件大小不能超过 10MB'
      }
    }

    // 生成对象存储键
    const ext = file.filename?.split('.').pop() || 'png'
    const objectKey = `avatars/${userId}.${ext}`

    // 上传到对象存储
    const storage = getStorageClient()
    await storage.uploadFile(objectKey, file.data, {
      'Content-Type': file.type,
      'Cache-Control': 'public, max-age=31536000' // 缓存 1 年
    })

    // 更新用户头像（数据库存储对象键，而不是 URL）
    await UserDAO.update(userId, { avatarUrl: objectKey })

    // 返回固定代理 URL（带时间戳使浏览器刷新缓存）
    const avatarUrl = `/api/user/avatar/${userId}?v=${Date.now()}`

    return {
      success: true,
      avatarUrl
    }
  } catch (error: any) {
    console.error('上传头像失败:', error)
    return {
      success: false,
      message: '上传头像失败'
    }
  }
})
