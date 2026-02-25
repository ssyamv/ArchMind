/**
 * POST /api/documents/batch-upload
 * 批量上传文档（异步队列处理）
 *
 * 功能:
 * 1. 接收多个文件，并行验证、提取文本、上传存储
 * 2. 为每个文件创建数据库记录（status: pending）
 * 3. 立即返回文档 ID 列表（不等待向量化）
 * 4. 后台异步触发向量化处理
 * 5. 前端可通过 GET /api/documents/:id/status 轮询进度
 */

import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { getStorageClient, generateObjectKey, calculateFileHash } from '~/lib/storage/storage-factory'
import { processDocumentAsync } from '~/server/utils/document-processing'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { readFile } from 'fs/promises'

interface UploadResult {
  fileName: string
  success: boolean
  documentId?: string
  error?: string
  duplicate?: boolean
  queued?: boolean
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)

    // 1. 接收文件
    const formData = await readMultipartFormData(event)
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: t('errors.noFilesUploaded')
      })
    }

    console.log(`[BatchUpload] Received ${formData.length} files`)

    // 2. 并行处理所有文件（只做上传+建档，不做向量化）
    const results: UploadResult[] = await Promise.all(
      formData.map(file => processFile(file, userId))
    )

    // 3. 对成功创建的文档触发异步向量化（fire-and-forget）
    for (const result of results) {
      if (result.success && result.documentId && !result.duplicate && result.queued) {
        const doc = await DocumentDAO.findById(result.documentId)
        if (doc?.content) {
          processDocumentAsync(doc.id, doc.content).catch((error) => {
            console.error(`[BatchUpload] Async processing failed for ${doc.id}:`, error)
          })
        }
      }
    }

    // 4. 统计结果
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const duplicateCount = results.filter(r => r.duplicate).length
    const queuedCount = results.filter(r => r.queued).length

    console.log(`[BatchUpload] Completed: ${successCount} success, ${failCount} fail, ${duplicateCount} duplicate, ${queuedCount} queued`)

    return {
      success: true,
      data: {
        total: formData.length,
        successCount,
        failCount,
        duplicateCount,
        queuedCount,
        results,
        // 前端可用这些 ID 轮询 GET /api/documents/:id/status
        documentIds: results
          .filter(r => r.success && r.documentId && !r.duplicate)
          .map(r => r.documentId!)
      }
    }
  } catch (error) {
    console.error('[BatchUpload] Error:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Batch upload failed'
    })
  }
})

/**
 * 处理单个文件上传（只建档，不向量化）
 */
async function processFile(file: any, userId: string): Promise<UploadResult> {
  const fileName = file.filename || 'unnamed'
  let tempFilePath: string | null = null

  try {
    // 1. 验证文件类型
    const fileType = fileName.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'md'].includes(fileType || '')) {
      return {
        fileName,
        success: false,
        error: 'Invalid file type (only PDF, DOCX, MD allowed)'
      }
    }

    // 2. 保存到临时目录（Vercel 只有 /tmp 可写）
    const tempDir = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'temp')
    await mkdir(tempDir, { recursive: true })
    tempFilePath = join(tempDir, `${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName}`)
    await writeFile(tempFilePath, file.data)

    // 3. 计算文件哈希（用于去重）
    const fileBuffer = await readFile(tempFilePath)
    const contentHash = await calculateFileHash(fileBuffer)

    // 4. 检查是否已存在
    const existingDoc = await DocumentDAO.findByHash(contentHash)
    if (existingDoc) {
      await unlink(tempFilePath)
      return {
        fileName,
        success: true,
        documentId: existingDoc.id,
        duplicate: true
      }
    }

    // 5. 提取文本内容
    let content = ''
    try {
      if (fileType === 'pdf') {
        const data = await pdfParse(fileBuffer)
        content = data.text
      } else if (fileType === 'docx') {
        const result = await mammoth.extractRawText({ path: tempFilePath })
        content = result.value
      } else if (fileType === 'md') {
        content = await readFile(tempFilePath, 'utf-8')
      }
    } catch (error) {
      console.error(`[BatchUpload] Text extraction failed (${fileName}):`, error)
      await unlink(tempFilePath)
      return {
        fileName,
        success: false,
        error: 'Failed to extract text content'
      }
    }

    // 6. 上传到对象存储
    const storage = getStorageClient()
    const objectKey = generateObjectKey(fileName)
    const uploadResult = await storage.uploadFile(objectKey, fileBuffer, {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Original-Filename': encodeURIComponent(fileName)
    })

    // 7. 创建数据库记录（状态为 pending，等待异步处理）
    const document = await DocumentDAO.create({
      userId,
      title: fileName,
      filePath: objectKey,
      fileType: fileType === 'md' ? 'markdown' : fileType as 'pdf' | 'docx' | 'markdown',
      fileSize: uploadResult.size,
      content,
      contentHash,
      storageProvider: (uploadResult.provider || 'huawei-obs') as 'huawei-obs' | 's3',
      storageBucket: 'archmind-documents',
      storageKey: objectKey,
      processingStatus: 'pending',
      metadata: {
        originalFileName: fileName,
        uploadedAt: new Date().toISOString(),
        etag: uploadResult.etag
      }
    })

    // 8. 清理临时文件
    await unlink(tempFilePath)

    return {
      fileName,
      success: true,
      documentId: document.id,
      queued: true
    }
  } catch (error) {
    if (tempFilePath) {
      try { await unlink(tempFilePath) } catch { /* ignore */ }
    }

    console.error(`[BatchUpload] File failed (${fileName}):`, error)
    return {
      fileName,
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}
