/**
 * AI 图片编辑 API
 *
 * 支持的编辑功能:
 * - stylization_all: 全局风格化
 * - stylization_local: 局部风格化
 * - description_edit: 指令编辑（基于文字描述修改图片）
 * - description_edit_with_mask: 蒙版编辑 (inpaint)
 * - expand: 图片扩展
 * - super_resolution: 超分辨率放大
 * - colorization: 黑白图片上色
 */

import { z } from 'zod'
import { AssetDAO } from '~/lib/db/dao/asset-dao'
import { getStorageClient, generateObjectKey, calculateFileHash } from '~/lib/storage/storage-factory'
import { getImageManager, resetImageManager } from '~/lib/ai/image-manager'
import { ErrorKeys } from '~/server/utils/errors'
import type { ImageEditFunction } from '~/types/asset'

const RequestSchema = z.object({
  assetId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  function: z.enum([
    'stylization_all',
    'stylization_local',
    'description_edit',
    'description_edit_with_mask',
    'expand',
    'super_resolution',
    'colorization'
  ]).optional().default('description_edit'),
  maskAssetId: z.string().uuid().optional(), // 用于 inpaint
  strength: z.number().min(0).max(1).optional().default(0.5),
  n: z.number().int().min(1).max(4).optional().default(1),
  seed: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)

  try {
    // 解析请求
    const body = await readBody(event)
    const request = RequestSchema.parse(body)

    // 获取原始资源
    const originalAsset = await AssetDAO.findById(request.assetId)
    if (!originalAsset) {
      return {
        success: false,
        message: t('errors.assetNotFound'),
        code: 'ASSET_NOT_FOUND'
      }
    }

    // 校验原资源归属权
    requireResourceOwner(originalAsset, userId)

    // 获取运行时配置
    const runtimeConfig = useRuntimeConfig()
    const dashscopeApiKey = runtimeConfig.dashscopeApiKey

    if (!dashscopeApiKey) {
      return {
        success: false,
        message: t('errors.imageApiKeyNotConfigured'),
        code: 'API_KEY_NOT_CONFIGURED'
      }
    }

    // 获取原始图片的预览 URL
    const storage = getStorageClient()
    const baseImageUrl = await storage.generatePresignedUrl(originalAsset.storageKey, 3600)

    // 获取蒙版图片 URL (如果需要)
    let maskImageUrl: string | undefined
    if (request.function === 'description_edit_with_mask' && request.maskAssetId) {
      const maskAsset = await AssetDAO.findById(request.maskAssetId)
      if (maskAsset) {
        maskImageUrl = await storage.generatePresignedUrl(maskAsset.storageKey, 3600)
      }
    }

    // 初始化图片管理器
    resetImageManager()
    const imageManager = getImageManager({
      dashscopeApiKey: dashscopeApiKey as string
    })

    console.log(`[Image Edit] Starting edit with function ${request.function}`)
    console.log(`[Image Edit] Asset: ${request.assetId}`)
    console.log(`[Image Edit] Prompt: ${request.prompt.substring(0, 100)}...`)

    // 调用图片编辑 API
    const taskResult = await imageManager.editImage(baseImageUrl, request.prompt, 'wanx2.1-imageedit', {
      function: request.function as ImageEditFunction,
      maskImageUrl,
      strength: request.strength,
      n: request.n,
      seed: request.seed
    })

    console.log(`[Image Edit] Task created: ${taskResult.taskId}, status: ${taskResult.status}`)

    // 等待任务完成 (最多等待 2 分钟)
    const finalResult = await imageManager.waitForTask(
      taskResult.taskId,
      'wanx2.1-imageedit',
      120000,
      2000
    )

    if (finalResult.status !== 'SUCCEEDED' || !finalResult.imageUrls?.length) {
      console.error('[Image Edit] Task failed:', finalResult.error)
      return {
        success: false,
        message: finalResult.error || t('errors.imageEditFailed'),
        code: 'EDIT_FAILED'
      }
    }

    console.log(`[Image Edit] Task succeeded, ${finalResult.imageUrls.length} images generated`)

    // 下载编辑后的图片并上传到存储
    const createdAssets = []

    for (let i = 0; i < finalResult.imageUrls.length; i++) {
      const imageUrl = finalResult.imageUrls[i]

      try {
        // 下载图片
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          console.error(`[Image Edit] Failed to download image ${i + 1}: ${imageResponse.status}`)
          continue
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        const contentHash = await calculateFileHash(imageBuffer)

        // 检查是否已存在相同内容的资源
        const existingAsset = await AssetDAO.findByHash(contentHash)
        if (existingAsset) {
          console.log(`[Image Edit] Image ${i + 1} already exists: ${existingAsset.id}`)
          createdAssets.push(existingAsset)
          continue
        }

        // 生成存储路径
        const fileName = `ai-edited-${Date.now()}-${i}.png`
        const storageKey = generateObjectKey(fileName)

        // 上传到存储
        await storage.uploadFile(storageKey, imageBuffer, {
          'Content-Type': 'image/png',
          'X-Source': 'ai-edited',
          'X-Original-Asset': request.assetId
        })

        // 创建资源记录
        const asset = await AssetDAO.create({
          userId,
          title: `编辑: ${request.prompt.substring(0, 50)}${request.prompt.length > 50 ? '...' : ''}`,
          description: `编辑自 "${originalAsset.title}"\n\n编辑指令: ${request.prompt}`,
          fileName,
          fileType: 'image/png',
          fileSize: imageBuffer.length,
          storageProvider: storage.getProviderName() as any,
          storageKey,
          contentHash,
          source: 'ai-generated',
          generationPrompt: request.prompt,
          modelUsed: 'wanx2.1-imageedit',
          metadata: {
            originalAssetId: request.assetId,
            editFunction: request.function,
            strength: request.strength,
            seed: request.seed,
            originalUrl: imageUrl,
            editedAt: new Date().toISOString()
          }
        })

        console.log(`[Image Edit] Asset created: ${asset.id}`)
        createdAssets.push(asset)
      } catch (downloadError) {
        console.error(`[Image Edit] Failed to process image ${i + 1}:`, downloadError)
      }
    }

    if (createdAssets.length === 0) {
      return {
        success: false,
        message: t('errors.imageDownloadFailed'),
        code: 'DOWNLOAD_FAILED'
      }
    }

    return {
      success: true,
      data: {
        assets: createdAssets
      },
      message: t('assets.editSuccess')
    }
  } catch (error) {
    console.error('[Image Edit] Error:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.errors.map(e => e.message).join(', '),
        code: 'VALIDATION_ERROR'
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
      code: 'INTERNAL_ERROR'
    }
  }
})
