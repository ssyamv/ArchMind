/**
 * 资源上传 API 端点
 */

import { extname } from 'path'
import { createHash } from 'crypto'
import { AssetDAO, PrdAssetDAO } from '~/lib/db/dao/asset-dao'
import { getStorageClient, generateObjectKey } from '~/lib/storage/storage-factory'
import type { Asset } from '~/types/asset'

// 支持的图片类型
const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

// 最大文件大小: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024

function calculateFileHash (fileData: Buffer): string {
  return createHash('sha256').update(fileData).digest('hex')
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      throw new Error('No file provided')
    }

    const fileData = formData.find(item => item.name === 'file')
    const prdIdField = formData.find(item => item.name === 'prdId')
    const titleField = formData.find(item => item.name === 'title')
    const descriptionField = formData.find(item => item.name === 'description')

    if (!fileData || !fileData.filename) {
      throw new Error('File is required')
    }

    const fileName = fileData.filename
    const ext = extname(fileName).toLowerCase()
    const mimeType = SUPPORTED_IMAGE_TYPES[ext]

    if (!mimeType) {
      throw new Error(`Unsupported file type: ${ext}. Supported: ${Object.keys(SUPPORTED_IMAGE_TYPES).join(', ')}`)
    }

    if (fileData.data.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }

    // 计算文件哈希
    const contentHash = calculateFileHash(fileData.data)

    // 检查重复
    const existingAsset = await AssetDAO.findByHash(contentHash)
    if (existingAsset) {
      return {
        success: true,
        data: existingAsset,
        message: t('errors.assetAlreadyExists'),
        duplicate: true
      }
    }

    // 上传到对象存储
    const storage = getStorageClient()
    const objectKey = generateObjectKey(`assets/${fileName}`)

    await storage.uploadFile(objectKey, fileData.data, {
      'Content-Type': mimeType,
      'X-Original-Filename': encodeURIComponent(fileName),
      'X-Content-Hash': contentHash
    })

    // 获取存储配置
    const storageProvider = process.env.STORAGE_PROVIDER || 'huawei-obs'
    const storageBucket = process.env.HUAWEI_OBS_BUCKET || 'archmind-assets'

    // 创建资源记录
    const asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      title: titleField ? new TextDecoder().decode(titleField.data) : fileName.replace(ext, ''),
      description: descriptionField ? new TextDecoder().decode(descriptionField.data) : undefined,
      fileName,
      fileType: mimeType,
      fileSize: fileData.data.length,
      storageProvider: storageProvider as any,
      storageBucket,
      storageKey: objectKey,
      contentHash,
      source: 'upload',
      metadata: {
        originalFileName: fileName,
        uploadedAt: new Date().toISOString()
      }
    }

    const createdAsset = await AssetDAO.create(asset)

    // 如果提供了 prdId, 创建关联
    if (prdIdField) {
      const prdId = new TextDecoder().decode(prdIdField.data)
      await PrdAssetDAO.create({
        prdId,
        assetId: createdAsset.id,
        addedBy: 'manual',
        sortOrder: 0
      })
    }

    setResponseStatus(event, 201)
    return {
      success: true,
      data: createdAsset,
      message: t('errors.assetUploadedSuccess')
    }
  } catch (error) {
    console.error('Asset upload error:', error)

    setResponseStatus(event, 400)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
      code: 'UPLOAD_FAILED'
    }
  }
})
