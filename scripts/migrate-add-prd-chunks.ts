#!/usr/bin/env node

/**
 * 迁移脚本：添加 prd_chunks 表
 * 用于 PRD 知识库分块存储，支持 PRD 级别的 RAG 检索
 *
 * 用法: npx tsx scripts/migrate-add-prd-chunks.ts
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'

const pool = new Pool({ connectionString: DATABASE_URL })

async function migrate (): Promise<void> {
  const client = await pool.connect()
  try {
    console.log('🔄 Running migration: add prd_chunks table...')

    await client.query(`
      CREATE TABLE IF NOT EXISTS prd_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prd_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Table prd_chunks created (or already exists)')

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id ON prd_chunks(prd_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id_chunk_index ON prd_chunks(prd_id, chunk_index)
    `)
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
