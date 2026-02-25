/**
 * POST /api/documents/:id/versions
 * 创建文档的新版本
 *
 * 功能:
 * 1. 复制当前文档文件到版本存储路径
 * 2. 创建版本记录
 * 3. 更新文档的 current_version 字段
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentVersionDAO } from '~/lib/db/dao/document-version-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { z } from 'zod'

const createVersionSchema = z.object({
  changeSummary: z.string().min(1).max(500).optional()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentIdRequired')
    })
  }

  try {
    const body = await readBody(event)

    // 验证输入
    const validationResult = createVersionSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    const { changeSummary } = validationResult.data

    // 1. 查询文档
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    requireResourceOwner(document, userId)

    // 2. 计算新版本号
    const currentVersion = document.currentVersion || 1
    const newVersion = currentVersion + 1

    // 3. 复制文件到版本存储路径
    const storage = getStorageClient()
    const versionKey = `versions/${documentId}/v${newVersion}_${document.title}`

    if (!document.storageKey) {
      throw createError({
        statusCode: 400,
        message: t('errors.documentStorageKeyMissing')
      })
    }

    await storage.copyFile(document.storageKey, versionKey)

    // 4. 创建版本记录
    const version = await DocumentVersionDAO.create({
      documentId,
      version: newVersion,
      storageKey: versionKey,
      fileSize: document.fileSize,
      content: document.content,
      contentHash: document.contentHash,
      changeSummary,
      createdBy: userId
    })

    // 5. 更新文档的当前版本号
    await DocumentDAO.update(documentId, {
      currentVersion: newVersion
    })

    return {
      success: true,
      data: {
        documentId,
        version: newVersion,
        storageKey: versionKey,
        changeSummary,
        createdAt: version.createdAt
      }
    }
  } catch (error) {
    console.error('Create version error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to create version'
    })
  }
})
