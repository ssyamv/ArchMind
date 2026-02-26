#!/usr/bin/env node

/**
 * 数据库初始化脚本 (TypeScript 版本)
 * 初始化 PostgreSQL 数据库，创建所有必要的表和索引
 *
 * 用法: pnpm db:init
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/archmind'

const pool = new Pool({
  connectionString: DATABASE_URL
})

/**
 * SQL 初始化脚本内容
 */
const INIT_SQL = `
-- ============================================
-- 启用必要的扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 用户表（为未来多用户做准备）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 文档表
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING gin(title gin_trgm_ops);

-- ============================================
-- 文档块表（用于向量检索）
-- ============================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);

-- 向量相似度搜索索引（IVFFlat）
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- PRD 文档表
-- ============================================
CREATE TABLE IF NOT EXISTS prd_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  user_input TEXT NOT NULL,
  model_used VARCHAR(100) NOT NULL,
  generation_time INTEGER,
  token_count INTEGER,
  estimated_cost DECIMAL(10, 4),
  status VARCHAR(20) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prd_user_id ON prd_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_prd_created_at ON prd_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prd_model_used ON prd_documents(model_used);

-- ============================================
-- PRD 文档引用表
-- ============================================
CREATE TABLE IF NOT EXISTS prd_document_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prd_id UUID REFERENCES prd_documents(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  relevance_score DECIMAL(5, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(prd_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_prd_refs_prd_id ON prd_document_references(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_refs_document_id ON prd_document_references(document_id);

-- ============================================
-- PRD 知识库分块表（用于 PRD 级别 RAG 检索）
-- ============================================
CREATE TABLE IF NOT EXISTS prd_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prd_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id ON prd_chunks(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id_chunk_index ON prd_chunks(prd_id, chunk_index);

-- ============================================
-- 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 生成历史表
-- ============================================
CREATE TABLE IF NOT EXISTS generation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prd_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  model_used VARCHAR(100) NOT NULL,
  user_input TEXT NOT NULL,
  token_count INTEGER,
  estimated_cost DECIMAL(10, 4),
  generation_time INTEGER,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_created_at ON generation_history(created_at DESC);

-- ============================================
-- 对话表
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  prd_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- ============================================
-- 对话消息表
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  model_used VARCHAR(100),
  use_rag BOOLEAN DEFAULT false,
  document_ids TEXT,
  prd_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_msgs_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_role ON conversation_messages(role);

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prd_documents_updated_at ON prd_documents;
CREATE TRIGGER update_prd_documents_updated_at
  BEFORE UPDATE ON prd_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 原型图表
-- ============================================
CREATE TABLE IF NOT EXISTS prototypes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prd_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  current_version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prototypes_prd_id ON prototypes(prd_id);
CREATE INDEX IF NOT EXISTS idx_prototypes_user_id ON prototypes(user_id);
CREATE INDEX IF NOT EXISTS idx_prototypes_created_at ON prototypes(created_at DESC);

-- ============================================
-- 原型页面表
-- ============================================
CREATE TABLE IF NOT EXISTS prototype_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prototype_id UUID REFERENCES prototypes(id) ON DELETE CASCADE NOT NULL,
  page_name VARCHAR(200) NOT NULL,
  page_slug VARCHAR(100) NOT NULL,
  html_content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_entry_page BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prototype_pages_prototype_id ON prototype_pages(prototype_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_pages_slug ON prototype_pages(prototype_id, page_slug);

-- ============================================
-- 原型版本表
-- ============================================
CREATE TABLE IF NOT EXISTS prototype_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prototype_id UUID REFERENCES prototypes(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  pages_snapshot JSONB NOT NULL,
  commit_message TEXT,
  model_used VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prototype_versions_prototype_id ON prototype_versions(prototype_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_versions_number ON prototype_versions(prototype_id, version_number);

DROP TRIGGER IF EXISTS update_prototypes_updated_at ON prototypes;
CREATE TRIGGER update_prototypes_updated_at
  BEFORE UPDATE ON prototypes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prototype_pages_updated_at ON prototype_pages;
CREATE TRIGGER update_prototype_pages_updated_at
  BEFORE UPDATE ON prototype_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`

async function initializeDatabase (): Promise<void> {
  const client = await pool.connect()

  try {
    console.log('🔄 Starting database initialization...')
    console.log(`📍 Database URL: ${DATABASE_URL.replace(/:[^:]*@/, ':***@')}`)

    // 检查数据库连接
    const result = await client.query('SELECT NOW()')
    console.log(`✅ Database connected at: ${result.rows[0].now}`)

    // 执行初始化 SQL
    console.log('\n📝 Creating tables and indexes...')
    // 使用智能分割，正确处理 $$ 引用的函数体（内部包含分号）
    const statements: string[] = []
    let current = ''
    let inDollarQuote = false
    for (const char of INIT_SQL) {
      if (char === '$' && (current.endsWith('$') || current.endsWith('$ '))) {
        // 简单检测 $$ 的开始/结束
      }
      current += char
      if (!inDollarQuote && current.endsWith('$$')) {
        inDollarQuote = true
      } else if (inDollarQuote && current.endsWith('$$') && current.indexOf('$$') !== current.length - 2) {
        inDollarQuote = false
      }
      if (char === ';' && !inDollarQuote) {
        const trimmed = current.trim()
        if (trimmed.length > 1) {
          statements.push(trimmed.slice(0, -1)) // 去掉末尾分号
        }
        current = ''
      }
    }
    if (current.trim().length > 0) {
      statements.push(current.trim())
    }

    for (const statement of statements) {
      try {
        await client.query(statement)
      } catch (error: any) {
        // 忽略"已存在"的错误，继续执行
        if (error.code !== '42P07' && error.code !== '42710') {
          console.error(`❌ Error executing statement:`, error.message)
          throw error
        }
      }
    }

    console.log('✅ Database initialized successfully!')

    // 验证表是否创建成功
    console.log('\n🔍 Verifying created tables...')
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log(`\n📊 Created tables (${tableCheck.rows.length}):`)
    tableCheck.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`)
    })

    console.log('\n✨ Database initialization complete!')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行初始化
initializeDatabase().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
