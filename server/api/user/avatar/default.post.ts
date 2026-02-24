/**
 * 应用默认头像
 * POST /api/user/avatar/default
 *
 * 为用户生成一个基于首字母的彩色 SVG 头像并保存。
 * 同时在新用户注册时可以调用此接口。
 */

import { UserDAO } from '~/lib/db/dao/user-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

// 预设的头像背景色（Material Design 调色板）
const AVATAR_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FF9800', '#FF5722', '#795548', '#607D8B'
]

/**
 * 根据字符串选择一个稳定的颜色
 */
function pickColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

/**
 * 生成 SVG 头像 Buffer
 */
function generateSvgAvatar(letter: string, color: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="128" fill="${color}"/>
  <text
    x="128"
    y="128"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="120"
    font-weight="600"
    fill="rgba(255,255,255,0.95)"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-2"
  >${letter.toUpperCase()}</text>
</svg>`
  return Buffer.from(svg, 'utf-8')
}

interface DefaultAvatarResponse {
  success: boolean
  avatarUrl?: string
  message?: string
}

export default defineEventHandler(async (event): Promise<DefaultAvatarResponse> => {
  try {
    const userId = requireAuth(event)

    // 获取用户信息
    const user = await UserDAO.getById(userId)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }

    // 取首字母（优先 fullName，其次 username，最后 email）
    const seed = user.fullName || user.username || user.email
    const letter = seed.trim().charAt(0) || 'U'
    const color = pickColor(user.email || user.id)

    // 生成 SVG
    const svgBuffer = generateSvgAvatar(letter, color)

    // 上传到对象存储
    const objectKey = `avatars/${userId}.svg`
    const storage = getStorageClient()
    await storage.uploadFile(objectKey, svgBuffer, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000'
    })

    // 更新数据库
    await UserDAO.update(userId, { avatarUrl: objectKey })

    // 返回代理 URL
    const avatarUrl = `/api/user/avatar/${userId}?v=${Date.now()}`

    return { success: true, avatarUrl }
  } catch (error: any) {
    console.error('[Avatar Default] Error:', error)
    return { success: false, message: '设置默认头像失败' }
  }
})
