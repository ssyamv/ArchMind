import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter, UploadResult } from '../storage-adapter'
import { storageLogger } from '~/lib/logger'

/**
 * 华为云 OBS 存储适配器
 * 使用 AWS SDK 通过 S3 兼容 API 访问华为云 OBS
 */
export class HuaweiOBSAdapter implements StorageAdapter {
  private client: S3Client
  private bucket: string
  private region: string

  constructor() {
    this.region = process.env.HUAWEI_OBS_REGION || 'cn-north-4'
    this.bucket = process.env.HUAWEI_OBS_BUCKET || 'archmind-documents'

    // 华为云 OBS endpoint 格式: https://obs.{region}.myhuaweicloud.com
    const endpoint = `https://obs.${this.region}.myhuaweicloud.com`

    this.client = new S3Client({
      region: this.region,
      endpoint,
      credentials: {
        accessKeyId: process.env.HUAWEI_OBS_ACCESS_KEY!,
        secretAccessKey: process.env.HUAWEI_OBS_SECRET_KEY!
      },
      forcePathStyle: false, // 华为云要求使用虚拟主机样式访问
      // 连接配置
      requestHandler: {
        connectionTimeout: 30000,
        requestTimeout: 60000
      }
    })
  }

  /**
   * 上传文件到华为云 OBS
   */
  async uploadFile(
    objectKey: string,
    fileBuffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: fileBuffer,
        Metadata: metadata,
        ContentType: this.getContentType(objectKey)
      })

      const response = await this.client.send(command)

      return {
        objectKey,
        etag: response.ETag || '',
        size: fileBuffer.length,
        provider: 'huawei-obs'
      }
    } catch (error) {
      storageLogger.error({ err: error, objectKey }, 'OBS upload failed')
      throw new Error(`Failed to upload to Huawei OBS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 生成预签名下载 URL
   * @param objectKey 对象键
   * @param expirySeconds 过期时间(秒), 默认 1 小时
   */
  async generatePresignedUrl(
    objectKey: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })

      const presignedUrl = await getSignedUrl(this.client, command, {
        expiresIn: expirySeconds
      })

      return presignedUrl
    } catch (error) {
      storageLogger.error({ err: error, objectKey }, 'OBS generate presigned URL failed')
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 生成公开访问 URL（适用于公开读的对象）
   * @param objectKey 对象键
   */
  getPublicUrl(objectKey: string): string {
    // 华为云 OBS 公开访问 URL 格式: https://{bucket}.obs.{region}.myhuaweicloud.com/{objectKey}
    return `https://${this.bucket}.obs.${this.region}.myhuaweicloud.com/${objectKey}`
  }

  /**
   * 获取文件内容
   */
  async getFile(objectKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })

      const response = await this.client.send(command)
      const stream = response.Body as NodeJS.ReadableStream
      const chunks: Buffer[] = []

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk))
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType || this.getContentType(objectKey)
      }
    } catch (error) {
      storageLogger.error({ err: error, objectKey }, 'OBS get file failed')
      throw new Error(`Failed to get file from Huawei OBS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(objectKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })

      await this.client.send(command)
    } catch (error) {
      storageLogger.error({ err: error, objectKey }, 'OBS delete file failed')
      throw new Error(`Failed to delete from Huawei OBS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(objectKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })

      await this.client.send(command)
      return true
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * 复制文件(用于版本控制)
   */
  async copyFile(sourceKey: string, targetKey: string): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: targetKey
      })

      await this.client.send(command)
    } catch (error) {
      storageLogger.error({ err: error, sourceKey, targetKey }, 'OBS copy file failed')
      throw new Error(`Failed to copy file in Huawei OBS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(objectKeys: string[]): Promise<void> {
    // 华为云 OBS 支持批量删除,但 AWS SDK 需要使用 DeleteObjectsCommand
    // 这里简化实现为串行删除
    for (const key of objectKeys) {
      await this.deleteFile(key)
    }
  }

  /**
   * 根据文件扩展名获取 Content-Type
   */
  private getContentType(objectKey: string): string {
    const ext = objectKey.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      md: 'text/markdown',
      txt: 'text/plain',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  /**
   * 获取存储提供商名称
   */
  getProviderName(): string {
    return 'huawei-obs'
  }

  /**
   * 健康检查 - 验证连接是否正常
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 尝试列举桶来验证连接
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: '.health-check' // 使用一个不存在的键来测试连接
      })

      try {
        await this.client.send(command)
      } catch (error: any) {
        // 404 错误说明连接正常,只是对象不存在
        if (error.$metadata?.httpStatusCode === 404) {
          return true
        }
        throw error
      }

      return true
    } catch (error) {
      storageLogger.error({ err: error }, 'OBS health check failed')
      return false
    }
  }
}
