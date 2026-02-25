/**
 * 文档上传 API 端点（重构版）
 * 使用对象存储（华为云 OBS）替代本地文件系统
 */

import { promises as fs } from 'fs'
import { extname, join } from 'path'
import { createHash } from 'crypto'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { processDocumentAsync } from '~/server/utils/document-processing'
import { getStorageClient, generateObjectKey } from '~/lib/storage/storage-factory'
import type { Document } from '~/types/document'

// 文件类型映射
const FILE_TYPE_MAPPING: Record<string, string> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.md': 'markdown',
  '.markdown': 'markdown'
}

// Vercel Serverless 请求体限制为 4.5MB，本地环境允许 100MB
const MAX_FILE_SIZE = process.env.VERCEL ? 4 * 1024 * 1024 : 100 * 1024 * 1024

// 临时目录：Vercel 只有 /tmp 可写
const TEMP_DIR = process.env.VERCEL ? '/tmp' : 'temp'

/**
 * 计算文件 SHA-256 哈希
 */
function calculateFileHash(fileData: Buffer): string {
  return createHash('sha256').update(fileData).digest('hex')
}

/**
 * 提取 PDF 内容
 */
async function extractPdfContent (filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const fileContent = await fs.readFile(filePath)

  const pdfData = await pdfParse(fileContent)
  return pdfData.text || ''
}

/**
 * 提取 DOCX 内容
 */
async function extractDocxContent (filePath: string): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const fileBuffer = await fs.readFile(filePath)

  const result = await mammoth.extractRawText({ buffer: fileBuffer })
  return result.value || ''
}

/**
 * 提取 Markdown 内容
 */
async function extractMarkdownContent (filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

/**
 * 根据文件类型提取内容
 */
async function extractContent (filePath: string, fileType: string): Promise<string> {
  if (fileType === 'pdf') {
    return extractPdfContent(filePath)
  } else if (fileType === 'docx') {
    return extractDocxContent(filePath)
  } else if (fileType === 'markdown') {
    return extractMarkdownContent(filePath)
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  let tempFilePath: string | null = null

  try {
    const userId = requireAuth(event)
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      throw new Error('No file provided')
    }

    const fileData = formData.find(item => item.name === 'file')
    if (!fileData) {
      throw new Error('File field not found')
    }

    // 读取工作区 ID
    const workspaceIdField = formData.find(item => item.name === 'workspace_id')
    const workspaceId = workspaceIdField?.data?.toString() || null

    if (!fileData.filename) {
      throw new Error('Filename is required')
    }

    const fileName = fileData.filename
    const ext = extname(fileName).toLowerCase()
    const fileType = FILE_TYPE_MAPPING[ext]

    if (!fileType) {
      throw new Error(`Unsupported file type: ${ext}. Supported types: .pdf, .docx, .md, .markdown`)
    }

    if (fileData.data.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // 计算文件哈希（用于去重）
    const contentHash = calculateFileHash(fileData.data)
    console.log(`File hash: ${contentHash}`)

    // 检查是否已存在相同文件
    const existingDoc = await DocumentDAO.findByHash(contentHash)
    if (existingDoc) {
      console.log(`Duplicate file found: ${existingDoc.id}`)
      return {
        success: true,
        data: existingDoc,
        message: t('errors.fileAlreadyExists'),
        duplicate: true
      }
    }

    // 保存到临时目录以便提取内容
    const uniqueFileName = `${Date.now()}_${fileName}`
    const tempDir = join(process.cwd(), TEMP_DIR)

    try {
      await fs.mkdir(tempDir, { recursive: true })
    } catch (err) {
      console.error('Failed to create temp directory:', err)
    }

    tempFilePath = join(tempDir, uniqueFileName)
    await fs.writeFile(tempFilePath, fileData.data)
    console.log(`Temp file saved: ${tempFilePath}`)

    // 提取文档内容
    let content = ''
    try {
      content = await extractContent(tempFilePath, fileType)
      console.log(`Content extracted: ${content.length} characters`)
    } catch (error) {
      console.error('Failed to extract content:', error)
      throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)}`)
    }

    // 上传到对象存储
    const storage = getStorageClient()
    const objectKey = generateObjectKey(fileName)

    console.log(`Uploading to storage: ${objectKey}`)
    const uploadResult = await storage.uploadFile(objectKey, fileData.data, {
      'Content-Type': fileData.type || 'application/octet-stream',
      'X-Original-Filename': encodeURIComponent(fileName), // URL 编码以支持中文字符
      'X-Content-Hash': contentHash
    })

    console.log(`Upload successful: ${uploadResult.objectKey}`)

    // 获取当前存储配置
    const storageProvider = process.env.STORAGE_PROVIDER || 'huawei-obs'
    const storageBucket = process.env.HUAWEI_OBS_BUCKET || 'archmind-documents'

    // 创建文档记录
    const doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      workspaceId: workspaceId || undefined,
      title: fileName.replace(ext, ''),
      filePath: objectKey, // 保存对象键作为路径
      fileType: fileType as 'pdf' | 'docx' | 'markdown',
      fileSize: fileData.data.length,
      content,
      contentHash,
      storageProvider: storageProvider as any,
      storageBucket,
      storageKey: objectKey,
      processingStatus: 'pending',
      metadata: {
        originalFileName: fileName,
        uploadedAt: new Date().toISOString(),
        etag: uploadResult.etag,
        provider: uploadResult.provider
      },
      status: 'uploaded'
    }

    const createdDoc = await DocumentDAO.create(doc)
    console.log(`Document record created: ${createdDoc.id}`)

    // 清理临时文件
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath)
        console.log('Temp file cleaned up')
      } catch (err) {
        console.warn('Failed to clean up temp file:', err)
      }
    }

    // 异步处理向量化（不阻塞响应）
    if (content) {
      processDocumentAsync(createdDoc.id, content).catch((error) => {
        console.error('文档处理管道失败:', error)
      })
    }

    setResponseStatus(event, 201)
    return {
      success: true,
      data: createdDoc,
      message: t('errors.documentUploadedSuccess')
    }
  } catch (error) {
    console.error('Upload error:', error)

    // 清理临时文件
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath)
      } catch {
        // Ignore cleanup errors
      }
    }

    setResponseStatus(event, 400)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'UPLOAD_FAILED'
    }
  }
})

