/**
 * AI 生成头像 API
 * POST /api/user/avatar/generate
 *
 * 使用通义万象或 OpenAI DALL-E 生成卡通风格头像，
 * 生成后直接保存到对象存储作为用户头像。
 */

import { z } from 'zod'
import { UserDAO } from '~/lib/db/dao/user-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { getImageManager, resetImageManager } from '~/lib/ai/image-manager'

const RequestSchema = z.object({
  prompt: z.string().min(1).max(500).optional().default(''),
  style: z.enum(['cartoon', 'pixel', 'watercolor', 'sketch', 'anime']).optional().default('cartoon')
})

// 各风格的提示词模板
const STYLE_PROMPTS: Record<string, string> = {
  cartoon: 'A cute cartoon avatar portrait, single character, round face, colorful, flat design, minimalist, simple background, circle crop, high quality illustration',
  pixel: 'A pixel art avatar, 16-bit style, game character portrait, vibrant colors, pixelated, simple background, square format',
  watercolor: 'A beautiful watercolor painting avatar portrait, soft colors, artistic brushstrokes, gentle wash effect, white background, square format',
  sketch: 'A hand-drawn sketch avatar portrait, pencil drawing style, black and white with subtle shading, clean lines, white background, square format',
  anime: 'An anime style avatar portrait, Japanese animation style, big expressive eyes, colorful hair, clean outlines, pastel colors, square format'
}

interface AvatarGenerateResponse {
  success: boolean
  avatarUrl?: string
  message?: string
}

export default defineEventHandler(async (event): Promise<AvatarGenerateResponse> => {
  try {
    const userId = requireAuth(event)

    // 解析请求
    const body = await readBody(event)
    const request = RequestSchema.parse(body)

    // 获取运行时配置
    const runtimeConfig = useRuntimeConfig()
    const dashscopeApiKey = runtimeConfig.dashscopeApiKey as string | undefined

    if (!dashscopeApiKey) {
      return {
        success: false,
        message: '未配置图片生成 API Key，请在设置中配置通义千问 API Key'
      }
    }

    // 构建提示词
    const baseStyle = STYLE_PROMPTS[request.style]
    const finalPrompt = request.prompt
      ? `${request.prompt}, ${baseStyle}`
      : baseStyle

    // 初始化图片管理器
    resetImageManager()
    const imageManager = getImageManager({ dashscopeApiKey })

    const modelId = 'wanx2.1-t2i-turbo'
    if (!imageManager.isModelAvailable(modelId)) {
      return {
        success: false,
        message: '图片生成模型不可用'
      }
    }

    // 发起生成任务（正方形头像）
    const taskResult = await imageManager.generateImage(finalPrompt, modelId, {
      size: '1024*1024',
      n: 1
    })

    // 等待任务完成（最多 90 秒）
    const finalResult = await imageManager.waitForTask(
      taskResult.taskId,
      modelId,
      90000,
      2000
    )

    if (finalResult.status !== 'SUCCEEDED' || !finalResult.imageUrls?.length) {
      return {
        success: false,
        message: finalResult.error || '图片生成失败，请重试'
      }
    }

    // 下载生成的图片
    const imageUrl = finalResult.imageUrls[0]
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return { success: false, message: '下载生成图片失败' }
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // 上传到对象存储（覆盖同一路径，使头像生效）
    const objectKey = `avatars/${userId}.png`
    const storage = getStorageClient()
    await storage.uploadFile(objectKey, imageBuffer, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000'
    })

    // 更新数据库
    await UserDAO.update(userId, { avatarUrl: objectKey })

    // 返回代理 URL（带时间戳破缓存）
    const avatarUrl = `/api/user/avatar/${userId}?v=${Date.now()}`

    return { success: true, avatarUrl }
  } catch (error: any) {
    console.error('[Avatar Generate] Error:', error)

    if (error?.name === 'ZodError') {
      return { success: false, message: '请求参数无效' }
    }

    return { success: false, message: '生成头像失败，请重试' }
  }
})
