import { HuaweiOBSAdapter } from './adapters/huawei-obs-adapter'
import type { StorageAdapter } from './storage-adapter'
import { storageLogger } from '~/lib/logger'

/**
 * 存储工厂 - 根据环境变量选择存储后端
 *
 * 使用方式:
 * ```typescript
 * const storage = getStorageClient()
 * await storage.uploadFile(key, buffer)
 * ```
 *
 * 支持的存储提供商:
 * - huawei-obs: 华为云 OBS (默认)
 */

let storageClientInstance: StorageAdapter | null = null

export function getStorageClient(): StorageAdapter {
  // 单例模式 - 避免重复创建客户端实例
  if (storageClientInstance) {
    return storageClientInstance
  }

  const provider = process.env.STORAGE_PROVIDER || 'huawei-obs'

  storageLogger.info({ provider }, 'Storage client initialized')

  switch (provider) {
    case 'huawei-obs':
      storageClientInstance = new HuaweiOBSAdapter()
      break

    // 预留接口 - 未来支持更多云存储
    // case 'aliyun-oss':
    //   storageClientInstance = new AliyunOSSAdapter()
    //   break
    //
    // case 'tencent-cos':
    //   storageClientInstance = new TencentCOSAdapter()
    //   break

    default:
      throw new Error(`不支持的存储提供商: ${provider}. 可选值: huawei-obs`)
  }

  return storageClientInstance
}

/**
 * 重置存储客户端实例(用于测试或切换配置)
 */
export function resetStorageClient(): void {
  storageClientInstance = null
}

/**
 * 工具函数: 生成对象存储的键(路径)
 * 格式: {year}/{month}/{uuid}_{filename}
 */
export function generateObjectKey(fileName: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const uuid = crypto.randomUUID()

  // 清理文件名中的特殊字符
  const sanitizedFileName = fileName
    .replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    .replace(/_{2,}/g, '_')

  return `${year}/${month}/${uuid}_${sanitizedFileName}`
}

/**
 * 工具函数: 计算文件内容的 SHA-256 哈希
 */
export async function calculateFileHash(fileBuffer: Buffer): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(fileBuffer).digest('hex')
}
