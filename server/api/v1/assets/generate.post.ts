/**
 * AI 图片生成 API
 *
 * 支持的模型:
 * - wanx2.1-t2i-turbo: 快速文生图
 * - wanx2.1-t2i-plus: 高质量文生图
 * - flux-schnell: FLUX 快速生成
 */

import { z } from 'zod'
import { AssetDAO, PrdAssetDAO } from '~/lib/db/dao/asset-dao'
import { getStorageClient, generateObjectKey, calculateFileHash } from '~/lib/storage/storage-factory'
import { getImageManager, resetImageManager } from '~/lib/ai/image-manager'
import { ErrorKeys } from '~/server/utils/errors'

const RequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  modelId: z.string().optional().default('wanx2.1-t2i-turbo'),
  prdId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(4).optional().default(1),
  negativePrompt: z.string().max(1000).optional(),
  size: z.string().optional().default('1024*1024'),
  seed: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)

  try {
    // 解析请求
    const body = await readBody(event)
    const request = RequestSchema.parse(body)

    // 获取运行时配置
    const runtimeConfig = useRuntimeConfig()
    const dashscopeApiKey = runtimeConfig.dashscopeApiKey

    if (!dashscopeApiKey) {
      console.error('[Image Generate] DashScope API Key not configured')
      return {
        success: false,
        message: t('errors.imageApiKeyNotConfigured'),
        code: 'API_KEY_NOT_CONFIGURED'
      }
    }

    // 初始化图片管理器
    resetImageManager()
    const imageManager = getImageManager({
      dashscopeApiKey: dashscopeApiKey as string
    })

    // 检查模型是否可用
    if (!imageManager.isModelAvailable(request.modelId)) {
      return {
        success: false,
        message: `${t('errors.imageModelNotAvailable')}: ${request.modelId}`,
        code: 'MODEL_NOT_AVAILABLE'
      }
    }

    console.log(`[Image Generate] Starting generation with model ${request.modelId}`)
    console.log(`[Image Generate] Prompt: ${request.prompt.substring(0, 100)}...`)

    // 调用图片生成 API
    const taskResult = await imageManager.generateImage(request.prompt, request.modelId, {
      negativePrompt: request.negativePrompt,
      size: request.size,
      n: request.count,
      seed: request.seed
    })

    console.log(`[Image Generate] Task created: ${taskResult.taskId}, status: ${taskResult.status}`)

    // 等待任务完成 (最多等待 2 分钟)
    const finalResult = await imageManager.waitForTask(
      taskResult.taskId,
      request.modelId,
      120000, // 2 分钟超时
      2000 // 2 秒轮询间隔
    )

    if (finalResult.status !== 'SUCCEEDED' || !finalResult.imageUrls?.length) {
      console.error('[Image Generate] Task failed:', finalResult.error)
      return {
        success: false,
        message: finalResult.error || t('errors.imageGenerationFailed'),
        code: 'GENERATION_FAILED'
      }
    }

    console.log(`[Image Generate] Task succeeded, ${finalResult.imageUrls.length} images generated`)

    // 下载生成的图片并上传到存储
    const storage = getStorageClient()
    const createdAssets = []
    const createdPrdAssets = []

    for (let i = 0; i < finalResult.imageUrls.length; i++) {
      const imageUrl = finalResult.imageUrls[i]

      try {
        // 下载图片
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          console.error(`[Image Generate] Failed to download image ${i + 1}: ${imageResponse.status}`)
          continue
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        const contentHash = await calculateFileHash(imageBuffer)

        // 检查是否已存在相同内容的资源
        const existingAsset = await AssetDAO.findByHash(contentHash)
        if (existingAsset) {
          console.log(`[Image Generate] Image ${i + 1} already exists: ${existingAsset.id}`)
          createdAssets.push(existingAsset)

          // 如果提供了 prdId，创建关联
          if (request.prdId) {
            const prdAsset = await PrdAssetDAO.create({
              prdId: request.prdId,
              assetId: existingAsset.id,
              addedBy: 'ai-generated',
              sortOrder: i
            })
            createdPrdAssets.push(prdAsset)
          }
          continue
        }

        // 生成存储路径
        const fileName = `ai-generated-${Date.now()}-${i}.png`
        const storageKey = generateObjectKey(fileName)

        // 上传到存储
        await storage.uploadFile(storageKey, imageBuffer, {
          'Content-Type': 'image/png',
          'X-Source': 'ai-generated',
          'X-Model': request.modelId
        })

        // 创建资源记录
        const asset = await AssetDAO.create({
          userId,
          title: `AI 生成: ${request.prompt.substring(0, 50)}${request.prompt.length > 50 ? '...' : ''}`,
          description: request.prompt,
          fileName,
          fileType: 'image/png',
          fileSize: imageBuffer.length,
          storageProvider: storage.getProviderName() as any,
          storageKey,
          contentHash,
          source: 'ai-generated',
          generationPrompt: request.prompt,
          modelUsed: request.modelId,
          metadata: {
            negativePrompt: request.negativePrompt,
            size: request.size,
            seed: request.seed,
            originalUrl: imageUrl,
            generatedAt: new Date().toISOString()
          }
        })

        console.log(`[Image Generate] Asset created: ${asset.id}`)
        createdAssets.push(asset)

        // 如果提供了 prdId，创建关联
        if (request.prdId) {
          const prdAsset = await PrdAssetDAO.create({
            prdId: request.prdId,
            assetId: asset.id,
            addedBy: 'ai-generated',
            sortOrder: i
          })
          createdPrdAssets.push(prdAsset)
          console.log(`[Image Generate] PRD asset linked: ${prdAsset.id}`)
        }
      } catch (downloadError) {
        console.error(`[Image Generate] Failed to process image ${i + 1}:`, downloadError)
        // 继续处理其他图片
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
        assets: createdAssets,
        prdAssets: createdPrdAssets.length > 0 ? createdPrdAssets : undefined
      },
      message: t('assets.aiGenerateDialog.generateSuccess')
    }
  } catch (error) {
    console.error('[Image Generate] Error:', error)

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
