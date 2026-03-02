#!/usr/bin/env node

/**
 * 迁移脚本：为 webhooks 表添加 type 字段
 *
 * 用法: npx tsx scripts/migrate-add-webhook-type.ts
 */

import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'
const pool = new Pool({ connectionString: DATABASE_URL })

async function migrate (): Promise<void> {
  const client = await pool.connect()
  try {
    console.log('🔄 Running migration: add webhook type field...')

    const sqlPath = join(process.cwd(), 'migrations', 'add-webhook-type.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    await client.query(sql)

    console.log('✅ Column webhooks.type added (or already exists)')
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
