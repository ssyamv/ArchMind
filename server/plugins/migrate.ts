/**
 * 数据库自动迁移插件
 * 服务启动时按顺序执行 migrations/ 目录下所有 SQL 迁移文件
 * 通过 schema_migrations 表记录已执行的迁移，避免重复执行
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { dbClient } from '~/lib/db/client'
import { dbLogger } from '~/lib/logger'

// 按执行顺序排列的迁移文件列表
// 新增迁移时，将文件名追加到列表末尾
const MIGRATIONS = [
  'add-workspaces-support.sql',
  'add-workspace-members-invitations.sql',
  'add-user-data-isolation.sql',
  'add-user-model-selection.sql',
  'add_reset_token_fields.sql',
  'add-audit-logs.sql',
  'add-assets-tables.sql',
  'add-prototype-device-type.sql',
  'add-documents-processing-fields.sql'
]

async function readMigrationSQL (filename: string): Promise<string> {
  // 优先尝试从文件系统读取（本地开发 / node-server）
  const filePath = join(process.cwd(), 'migrations', filename)
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8')
  }
  // Vercel 环境：从 serverAssets 读取（nitro.serverAssets 打包的内容）
  const storage = useStorage('assets:migrations')
  const content = await storage.getItem<string>(filename)
  if (!content) {
    throw new Error(`Migration file not found: ${filename}`)
  }
  return content
}

export default defineNitroPlugin(async () => {
  // 仅在生产环境或明确开启时执行自动迁移
  if (process.env.NODE_ENV !== 'production' && !process.env.RUN_MIGRATIONS) {
    return
  }

  try {
    // 确保迁移记录表存在
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // 查询已执行的迁移
    const { rows } = await dbClient.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    )
    const executed = new Set(rows.map(r => r.name))

    // 按顺序执行尚未执行的迁移
    for (const filename of MIGRATIONS) {
      if (executed.has(filename)) {
        continue
      }

      try {
        const sql = await readMigrationSQL(filename)

        await dbClient.transaction(async (client) => {
          await client.query(sql)
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [filename]
          )
        })

        dbLogger.info({ migration: filename }, 'Migration executed successfully')
      } catch (err) {
        dbLogger.error({ err, migration: filename }, 'Migration failed')
        // 迁移失败不阻止服务启动，但记录错误
      }
    }

    dbLogger.info('Database migrations check completed')
  } catch (err) {
    dbLogger.error({ err }, 'Failed to run database migrations')
  }
})
