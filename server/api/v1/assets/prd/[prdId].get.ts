import { ErrorMessages } from '~/server/utils/errors'
/**
 * 获取 PRD 关联的资源 API
 */

import { PrdAssetDAO } from '~/lib/db/dao/asset-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'prdId')

    if (!prdId) {
      throw new Error('PRD ID is required')
    }

    // 校验 PRD 归属权
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      throw new Error('PRD not found')
    }
    requireResourceOwner(prd, userId)

    const prdAssets = await PrdAssetDAO.findByPrdId(prdId)

    // 为每个资源生成预览 URL
    const storage = getStorageClient()
    const assetsWithPreview = await Promise.all(
      prdAssets.map(async (prdAsset) => {
        if (prdAsset.asset) {
          const previewUrl = await storage.generatePresignedUrl(prdAsset.asset.storageKey, 3600)
          prdAsset.asset.previewUrl = previewUrl
        }
        return prdAsset
      })
    )

    return {
      success: true,
      data: assetsWithPreview
    }
  } catch (error) {
    console.error('Failed to fetch PRD assets:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR,
      code: 'FETCH_FAILED'
    }
  }
})
