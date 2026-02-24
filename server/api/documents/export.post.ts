/**
 * POST /api/documents/export
 * 批量导出文档
 *
 * 功能:
 * 1. 支持按条件筛选文档(ID列表、标签、分类、日期范围等)
 * 2. 生成 ZIP 压缩包
 * 3. 返回下载 URL
 *
 * 导出内容:
 * - 原始文档文件
 * - 元数据 JSON (metadata.json)
 * - 导出清单 (manifest.json)
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import archiver from 'archiver'
import { z } from 'zod'

const exportSchema = z.object({
  documentIds: z.array(z.string()).optional(), // 指定文档ID列表
  fileTypes: z.array(z.enum(['pdf', 'docx', 'markdown'])).optional(), // 按文件类型筛选
  startDate: z.string().optional(), // 起始日期
  endDate: z.string().optional(), // 结束日期
  includeContent: z.boolean().optional().default(true), // 是否包含文本内容
  includeMetadata: z.boolean().optional().default(true) // 是否包含元数据
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const body = await readBody(event)

    // 验证输入
    const validationResult = exportSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    const {
      documentIds,
      fileTypes,
      startDate,
      endDate,
      includeContent,
      includeMetadata
    } = validationResult.data

    // 1. 查询要导出的文档
    let documents

    if (documentIds && documentIds.length > 0) {
      // 按ID列表查询
      documents = await Promise.all(
        documentIds.map(id => DocumentDAO.findById(id))
      )
      documents = documents.filter(d => d !== null)
      // 验证每个文档的归属权
      for (const doc of documents) {
        requireResourceOwner(doc, userId)
      }
    } else {
      // 查询当前用户的文档,然后筛选
      documents = await DocumentDAO.findAll({ limit: 1000, userId })

      if (fileTypes && fileTypes.length > 0) {
        documents = documents.filter(d => fileTypes.includes(d.fileType))
      }

      if (startDate) {
        const start = new Date(startDate)
        documents = documents.filter(d => new Date(d.createdAt) >= start)
      }

      if (endDate) {
        const end = new Date(endDate)
        documents = documents.filter(d => new Date(d.createdAt) <= end)
      }
    }

    if (documents.length === 0) {
      throw createError({
        statusCode: 404,
        message: t('errors.noDocumentsFound')
      })
    }

    console.log(`准备导出 ${documents.length} 个文档...`)

    // 2. 创建 ZIP 文件
    const zipFileName = `archmind_export_${Date.now()}.zip`
    const zipFilePath = join(process.cwd(), 'temp', zipFileName)
    const output = createWriteStream(zipFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    // 监听错误
    archive.on('error', (err) => {
      throw err
    })

    // 连接 archive 到输出流
    archive.pipe(output)

    // 3. 下载并添加文档到 ZIP
    const storage = getStorageClient()
    const manifest: any[] = []

    for (const doc of documents) {
      try {
        if (!doc.storageKey) {
          console.warn(`文档 ${doc.id} 没有 storageKey,跳过`)
          continue
        }

        // 生成预签名 URL 并下载文件
        const presignedUrl = await storage.generatePresignedUrl(doc.storageKey, 300)

        // 下载文件内容
        const response = await fetch(presignedUrl)
        if (!response.ok) {
          console.error(`下载文件失败 (${doc.title}): ${response.statusText}`)
          continue
        }

        const fileBuffer = Buffer.from(await response.arrayBuffer())

        // 添加到 ZIP (使用原始文件名)
        archive.append(fileBuffer, { name: `documents/${doc.title}` })

        // 添加到清单
        manifest.push({
          id: doc.id,
          title: doc.title,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt
        })

        // 如果需要,添加文本内容
        if (includeContent && doc.content) {
          const contentFileName = `content/${doc.id}.txt`
          archive.append(doc.content, { name: contentFileName })
        }

        // 如果需要,添加元数据
        if (includeMetadata && doc.metadata) {
          const metadataFileName = `metadata/${doc.id}.json`
          archive.append(JSON.stringify(doc.metadata, null, 2), { name: metadataFileName })
        }
      } catch (error) {
        console.error(`处理文档失败 (${doc.title}):`, error)
      }
    }

    // 4. 添加清单文件
    archive.append(JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalDocuments: manifest.length,
      documents: manifest
    }, null, 2), { name: 'manifest.json' })

    // 5. 完成 ZIP 文件
    await archive.finalize()

    // 等待输出流完成
    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve())
      output.on('error', reject)
    })

    console.log(`ZIP 文件创建完成: ${zipFilePath} (${archive.pointer()} bytes)`)

    // 6. 上传 ZIP 到临时存储桶 (7天后自动删除)
    const zipBuffer = await import('fs/promises').then(fs => fs.readFile(zipFilePath))
    const zipObjectKey = `exports/${zipFileName}`

    await storage.uploadFile(zipObjectKey, zipBuffer, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}` // RFC 5987 编码以支持中文
    })

    // 7. 生成下载 URL (7天有效期)
    const downloadUrl = await storage.generatePresignedUrl(zipObjectKey, 7 * 24 * 3600)

    // 8. 清理本地临时文件
    await unlink(zipFilePath)

    return {
      success: true,
      data: {
        fileName: zipFileName,
        totalDocuments: manifest.length,
        fileSize: archive.pointer(),
        downloadUrl,
        expiresIn: 7 * 24 * 3600 // 7天
      }
    }
  } catch (error) {
    console.error('Export error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Export failed'
    })
  }
})
