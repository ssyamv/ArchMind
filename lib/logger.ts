/**
 * 统一日志模块
 *
 * 基于 pino 实现结构化 JSON 日志输出到 stdout。
 * Vercel / Docker 等平台会自动收集 stdout 日志。
 *
 * 日志级别通过 LOG_LEVEL 环境变量控制（默认 info）：
 *   LOG_LEVEL=debug  → 输出所有日志（开发调试）
 *   LOG_LEVEL=info   → 输出 info/warn/error（生产推荐）
 *   LOG_LEVEL=warn   → 只输出 warn/error
 *   LOG_LEVEL=error  → 只输出 error
 *   LOG_LEVEL=silent → 关闭所有日志（测试环境）
 *
 * 使用示例：
 *   import { logger, createContextLogger } from '~/lib/logger'
 *
 *   // 全局 logger
 *   logger.info('Server started')
 *   logger.error({ err, userId }, 'Failed to generate PRD')
 *
 *   // 带上下文的 child logger（推荐在业务模块中使用）
 *   const log = createContextLogger('prd-generator')
 *   log.info({ prdId }, 'PRD generation started')
 */

import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

// 测试环境静默，避免污染测试输出
const level = isTest
  ? 'silent'
  : (process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'))

export const logger = pino({
  level,
  base: {
    env: process.env.NODE_ENV ?? 'production',
  },
  // 时间戳使用 ISO 格式，便于日志平台解析
  timestamp: pino.stdTimeFunctions.isoTime,
  // 序列化 Error 对象
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
})

/**
 * 创建带 context 标签的 child logger
 * 推荐每个业务模块创建独立的 child logger，便于按模块过滤日志
 *
 * @param context 模块名称，如 'prd-generator', 'rag-pipeline', 'auth'
 */
export function createContextLogger(context: string) {
  return logger.child({ context })
}

/**
 * 预定义的业务模块 logger
 * 直接在各模块中 import 使用，避免重复创建
 */
export const ragLogger = createContextLogger('rag')
export const prdLogger = createContextLogger('prd')
export const aiLogger = createContextLogger('ai')
export const authLogger = createContextLogger('auth')
export const dbLogger = createContextLogger('db')
export const storageLogger = createContextLogger('storage')
