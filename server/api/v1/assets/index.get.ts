import { ErrorMessages } from '~/server/utils/errors'
/**
 * 获取资源列表 API
 */

import { AssetDAO } from '~/lib/db/dao/asset-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 50
    const offset = parseInt(query.offset as string) || 0
    const source = query.source as 'upload' | 'ai-generated' | undefined

    const assets = await AssetDAO.findAll({ limit, offset, source, userId })
    const total = await AssetDAO.count({ source, userId })

    // 为每个资源生成预览 URL
    const storage = getStorageClient()
    const assetsWithPreview = await Promise.all(
      assets.map(async (asset) => {
        const previewUrl = await storage.generatePresignedUrl(asset.storageKey, 3600) // 1小时有效
        return { ...asset, previewUrl }
      })
    )

    return {
      success: true,
      data: {
        assets: assetsWithPreview,
        total,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    }
  } catch (error) {
    console.error('Failed to fetch assets:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR,
      code: 'FETCH_FAILED'
    }
  }
})
