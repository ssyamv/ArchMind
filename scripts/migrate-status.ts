#!/usr/bin/env node
/**
 * 数据库迁移状态查询工具
 *
 * 使用：
 *   pnpm db:migrate-status
 *
 * 输出当前所有迁移文件的状态（已执行 / 待执行 / 缺少 down 脚本）
 */

import { readdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const MIGRATIONS_DIR = join(process.cwd(), 'migrations')
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'

const pool = new Pool({ connectionString: DATABASE_URL })

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function getExecutedHistory(): Promise<Array<{ filename: string; direction: string; executed_at: Date }>> {
  try {
    const result = await pool.query<{ filename: string; direction: string; executed_at: Date }>(
      `SELECT filename, direction, executed_at
       FROM migration_history
       ORDER BY executed_at DESC`
    )
    return result.rows
  } catch {
    // migration_history 表可能尚未创建（旧版本）
    return []
  }
}

async function main(): Promise<void> {
  const files = await readdir(MIGRATIONS_DIR)
  const upFiles = files
    .filter((f) => f.endsWith('.sql') && !f.includes('.down.') && !f.startsWith('000-'))
    .sort()

  const history = await getExecutedHistory()
  const executedMap = new Map<string, Date>()
  for (const h of history) {
    if (h.direction === 'up') {
      executedMap.set(h.filename, h.executed_at)
    }
    if (h.direction === 'down') {
      executedMap.delete(h.filename)
    }
  }

  console.log('\n📊 数据库迁移状态\n')
  console.log('─'.repeat(80))

  let upCount = 0
  let pendingCount = 0
  let noDownCount = 0

  for (const filename of upFiles) {
    const downFilename = filename.replace(/\.sql$/, '.down.sql')
    const downPath = join(MIGRATIONS_DIR, downFilename)
    const hasDown = await fileExists(downPath)
    const executedAt = executedMap.get(filename)

    const statusIcon = executedAt ? '✅' : '⏳'
    const downIcon = hasDown ? '↩️' : '⚠️ '
    const executedStr = executedAt ? executedAt.toLocaleString('zh-CN') : '未执行'

    console.log(`${statusIcon} ${downIcon} ${filename.padEnd(50)} ${executedStr}`)

    if (executedAt) upCount++
    else pendingCount++
    if (!hasDown) noDownCount++
  }

  console.log('─'.repeat(80))
  console.log(`\n✅ 已执行：${upCount} 个`)
  console.log(`⏳ 待执行：${pendingCount} 个`)
  if (noDownCount > 0) {
    console.log(`⚠️  缺少 down 脚本：${noDownCount} 个`)
  }
  console.log()
}

main()
  .catch((err) => {
    console.error('❌ 错误:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
