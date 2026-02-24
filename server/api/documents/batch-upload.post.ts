/**
 * POST /api/documents/batch-upload
 * 批量上传文档
 *
 * 功能:
 * 1. 接收多个文件
 * 2. 并行处理上传
 * 3. 返回每个文件的处理结果
 * 4. 支持部分成功场景
 */

import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { getStorageClient, generateObjectKey, calculateFileHash } from '~/lib/storage/storage-factory'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { readFile } from 'fs/promises'

interface UploadResult {
  fileName: string
  success: boolean
  documentId?: string
  error?: string
  duplicate?: boolean
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

    console.log(`收到 ${formData.length} 个文件,开始批量上传...`)

    // 2. 并行处理所有文件
    const results: UploadResult[] = await Promise.all(
      formData.map(file => processFile(file, userId))
    )

    // 3. 统计结果
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const duplicateCount = results.filter(r => r.duplicate).length

    console.log(`批量上传完成: ${successCount} 成功, ${failCount} 失败, ${duplicateCount} 重复`)

    return {
      success: true,
      data: {
        total: formData.length,
        successCount,
        failCount,
        duplicateCount,
        results
      }
    }
  } catch (error) {
    console.error('Batch upload error:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Batch upload failed'
    })
  }
})

/**
 * 处理单个文件上传
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
    tempFilePath = join(tempDir, `${Date.now()}_${fileName}`)
    await writeFile(tempFilePath, file.data)

    // 3. 计算文件哈希(用于去重)
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
      console.error(`文本提取失败 (${fileName}):`, error)
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
      'X-Original-Filename': encodeURIComponent(fileName) // URL 编码以支持中文字符
    })

    // 7. 创建数据库记录
    const document = await DocumentDAO.create({
      userId,
      title: fileName,
      filePath: `/uploads/${fileName}`, // 保留兼容性
      fileType: fileType as 'pdf' | 'docx' | 'markdown',
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

    // 9. 触发异步向量化处理
    // TODO: 实现异步队列处理
    // processDocumentAsync(document.id, content)

    return {
      fileName,
      success: true,
      documentId: document.id
    }
  } catch (error) {
    // 清理临时文件
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
      } catch {
        // 忽略清理错误
      }
    }

    console.error(`文件上传失败 (${fileName}):`, error)
    return {
      fileName,
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}
