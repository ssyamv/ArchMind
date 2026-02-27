#!/usr/bin/env node

/**
 * 迁移脚本：添加团队协作表（comments + activity_logs）
 *
 * 用法: npx tsx scripts/migrate-add-collaboration-tables.ts
 */

import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'
const pool = new Pool({ connectionString: DATABASE_URL })

async function migrate (): Promise<void> {
  const client = await pool.connect()
  try {
    console.log('🔄 Running migration: add collaboration tables...')

    const sqlPath = join(process.cwd(), 'migrations', 'add-collaboration-tables.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    await client.query(sql)

    console.log('✅ Table comments created (or already exists)')
    console.log('✅ Table activity_logs created (or already exists)')
    console.log('✅ Indexes created')
    console.log('✨ Migration complete!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
