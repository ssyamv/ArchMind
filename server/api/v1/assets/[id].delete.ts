/**
 * 删除资源 API
 */

import { AssetDAO } from '~/lib/db/dao/asset-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw new Error(t('errors.idRequired'))
    }

    // 获取资��信息
    const asset = await AssetDAO.findById(id)
    if (!asset) {
      throw new Error(t('errors.prototypeNotFound'))
    }

    // 校验资源归属权
    requireResourceOwner(asset, userId)

    // 从对象存储删除
    const storage = getStorageClient()
    await storage.deleteFile(asset.storageKey)

    // 从数据库删除 (级联删除 prd_assets 关联)
    await AssetDAO.delete(id)

    return {
      success: true,
      message: t('errors.assetDeletedSuccess')
    }
  } catch (error) {
    console.error('Failed to delete asset:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
      code: 'DELETE_FAILED'
    }
  }
})
