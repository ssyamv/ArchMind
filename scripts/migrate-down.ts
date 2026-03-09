#!/usr/bin/env node
/**
 * 数据库迁移回滚工具
 *
 * 使用：
 *   pnpm db:migrate-down              # 回滚最近 1 次迁移
 *   pnpm db:migrate-down --steps 3   # 回滚最近 3 次迁移
 *   pnpm db:migrate-down --filename add-prd-snapshots.sql  # 回滚指定迁移
 *
 * 注意：
 *   - 仅回滚已在 migration_history 表中记录的迁移
 *   - 对应的 .down.sql 文件必须存在
 *   - 回滚同样记录到 migration_history（direction = 'down'）
 */

import { readFile, access } from 'node:fs/promises'
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

async function getLastUpMigrations(steps: number): Promise<string[]> {
  const result = await pool.query<{ filename: string }>(
    `SELECT filename FROM migration_history
     WHERE direction = 'up'
     ORDER BY executed_at DESC
     LIMIT $1`,
    [steps]
  )
  return result.rows.map((r) => r.filename)
}

async function rollbackMigration(filename: string): Promise<void> {
  const downFilename = filename.replace(/\.sql$/, '.down.sql')
  const downPath = join(MIGRATIONS_DIR, downFilename)

  if (!(await fileExists(downPath))) {
    console.warn(`⚠️  未找到 down 脚本: ${downFilename}，跳过`)
    return
  }

  const sql = await readFile(downPath, 'utf-8')
  const client = await pool.connect()
  const start = Date.now()

  try {
    console.log(`\n↩️  回滚: ${filename}`)
    await client.query('BEGIN')
    await client.query(sql)

    // 记录回滚历史
    await client.query(
      `INSERT INTO migration_history (version, filename, direction)
       VALUES ($1, $2, 'down')`,
      ['rollback', downFilename]
    )

    await client.query('COMMIT')
    console.log(`✅ 完成 (${Date.now() - start}ms)`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`❌ 回滚失败: ${err}`)
    throw err
  } finally {
    client.release()
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const stepsIdx = args.indexOf('--steps')
  const filenameIdx = args.indexOf('--filename')

  // 检查 migration_history 表是否存在
  try {
    await pool.query('SELECT 1 FROM migration_history LIMIT 1')
  } catch {
    console.error('❌ migration_history 表不存在，请先执行：')
    console.error('   psql $DATABASE_URL -f migrations/v0.6.0_migration-history.up.sql')
    process.exit(1)
  }

  if (filenameIdx !== -1) {
    // 指定文件名回滚
    const filename = args[filenameIdx + 1]
    if (!filename) {
      console.error('❌ 请提供文件名：--filename add-xxx.sql')
      process.exit(1)
    }
    await rollbackMigration(filename)
  } else {
    // 按步数回滚
    const steps = stepsIdx !== -1 ? parseInt(args[stepsIdx + 1] ?? '1', 10) : 1
    if (isNaN(steps) || steps < 1) {
      console.error('❌ --steps 必须为正整数')
      process.exit(1)
    }

    const migrations = await getLastUpMigrations(steps)
    if (migrations.length === 0) {
      console.log('ℹ️  没有可回滚的迁移记录')
      return
    }

    console.log(`\n将回滚最近 ${migrations.length} 次迁移：`)
    migrations.forEach((f) => console.log(`  - ${f}`))
    console.log()

    for (const filename of migrations) {
      await rollbackMigration(filename)
    }
  }

  console.log('\n✅ 回滚完成\n')
}

main()
  .catch((err) => {
    console.error('❌ 错误:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
