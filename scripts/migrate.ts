#!/usr/bin/env node
/**
 * 数据库迁移管理工具
 *
 * 功能：
 * 1. 自动检测未执行的迁移文件
 * 2. 按版本号顺序执行迁移
 * 3. 记录迁移历史到 schema_migrations 表
 * 4. 支持回滚（如果迁移文件提供 down 脚本）
 *
 * 使用：
 *   pnpm migrate up              # 执行所有待执行迁移
 *   pnpm migrate status          # 查看迁移状态
 *   pnpm migrate create <name>   # 创建新迁移文件
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { Pool, type PoolClient } from 'pg'

const MIGRATIONS_DIR = join(process.cwd(), 'migrations')
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'

const pool = new Pool({
  connectionString: DATABASE_URL
})

interface Migration {
  version: string
  name: string
  filename: string
  checksum: string
  content: string
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64),
      execution_time_ms INTEGER,
      status VARCHAR(20) DEFAULT 'success'
    )
  `)
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations WHERE status = $1',
    ['success']
  )
  return new Set(result.rows.map((r) => r.version))
}

async function getPendingMigrations(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR)
  const sqlFiles = files
    .filter((f) => f.endsWith('.sql') && !f.startsWith('000-'))
    .sort()

  const executed = await getExecutedMigrations()
  const pending: Migration[] = []

  for (const filename of sqlFiles) {
    // 解析文件名：20260302_001-add-search-vector.sql
    const match = filename.match(/^(\d{8}_\d{3})-(.+)\.sql$/)
    if (!match) continue

    const [, version, name] = match
    if (executed.has(version)) continue

    const filepath = join(MIGRATIONS_DIR, filename)
    const content = await readFile(filepath, 'utf-8')
    const checksum = createHash('sha256').update(content).digest('hex')

    pending.push({ version, name, filename, checksum, content })
  }

  return pending
}

async function executeMigration(migration: Migration): Promise<void> {
  const startTime = Date.now()
  const client = await pool.connect()

  try {
    console.log(`\n🔄 执行迁移: ${migration.version} - ${migration.name}`)

    await client.query('BEGIN')

    // 执行迁移 SQL
    await client.query(migration.content)

    // 记录到迁移表
    await client.query(
      `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [migration.version, migration.name, migration.checksum, Date.now() - startTime, 'success']
    )

    await client.query('COMMIT')

    console.log(`✅ 完成 (${Date.now() - startTime}ms)`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`❌ 失败: ${error}`)

    // 记录失败状态
    try {
      await pool.query(
        `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [migration.version, migration.name, migration.checksum, Date.now() - startTime, 'failed']
      )
    } catch (logError) {
      console.error('无法记录失败状态:', logError)
    }

    throw error
  } finally {
    client.release()
  }
}

async function showStatus(): Promise<void> {
  const result = await pool.query<{
    version: string
    name: string
    executed_at: Date
    status: string
  }>(
    `SELECT version, name, executed_at, status
     FROM schema_migrations
     ORDER BY version DESC
     LIMIT 10`
  )

  const pending = await getPendingMigrations()

  console.log('\n📊 迁移状态\n')
  console.log('最近执行的迁移:')
  if (result.rows.length === 0) {
    console.log('  (无)')
  } else {
    result.rows.forEach((m) => {
      const icon = m.status === 'success' ? '✅' : '❌'
      console.log(`  ${icon} ${m.version} - ${m.name} (${m.executed_at.toLocaleString()})`)
    })
  }

  console.log(`\n待执行的迁移: ${pending.length} 个`)
  pending.forEach((m) => {
    console.log(`  ⏳ ${m.version} - ${m.name}`)
  })
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable()
  const pending = await getPendingMigrations()

  if (pending.length === 0) {
    console.log('✅ 所有迁移已执行，数据库是最新的')
    return
  }

  console.log(`\n发现 ${pending.length} 个待执行迁移\n`)

  for (const migration of pending) {
    await executeMigration(migration)
  }

  console.log('\n✅ 所有迁移执行完成\n')
}

async function createMigration(name: string): Promise<void> {
  const now = new Date()
  const version = now.toISOString().slice(0, 10).replace(/-/g, '') + '_001'
  const filename = `${version}-${name}.sql`
  const filepath = join(MIGRATIONS_DIR, filename)

  const template = `-- Migration: ${name}
-- Version: ${version}
-- Created: ${now.toISOString()}

-- TODO: 在此编写迁移 SQL

-- 示例：
-- ALTER TABLE documents ADD COLUMN new_field TEXT;
-- CREATE INDEX idx_new_field ON documents(new_field);
`

  await writeFile(filepath, template, 'utf-8')
  console.log(`✅ 创建迁移文件: ${filename}`)
}

// CLI
const command = process.argv[2]
const arg = process.argv[3]

;(async () => {
  try {
    switch (command) {
      case 'up':
        await runMigrations()
        break
      case 'status':
        await showStatus()
        break
      case 'create':
        if (!arg) {
          console.error('❌ 请提供迁移名称: pnpm migrate create <name>')
          process.exit(1)
        }
        await createMigration(arg)
        break
      default:
        console.log(`
数据库迁移工具

用法:
  pnpm migrate up              执行所有待执行迁移
  pnpm migrate status          查看迁移状态
  pnpm migrate create <name>   创建新迁移文件

示例:
  pnpm migrate create add-user-avatar
        `)
    }
  } catch (error) {
    console.error('❌ 错误:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
