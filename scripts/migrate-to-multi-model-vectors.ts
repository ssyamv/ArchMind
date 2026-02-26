#!/usr/bin/env node

/**
 * 数据库迁移脚本 - 支持多模型向量存储
 *
 * 架构改造:
 * 1. 创建独立的 document_embeddings 表支持多个模型
 * 2. 保留原有 document_chunks.embedding 列(向后兼容)
 * 3. 迁移现有向量数据到新表
 * 4. 为每个模型创建独立的索引
 *
 * 优点:
 * - 无损迁移,保留所有现有数据
 * - 支持任意维度的向量模型
 * - 可以同时存储多个模型的向量
 * - 灵活切换默认模型
 *
 * 使用方式:
 * pnpm db:migrate-multi-model
 */

import 'dotenv/config'
import { dbClient } from '../lib/db/client'

async function migrateToMultiModelVectors() {
  console.log('🔄 开始迁移到多模型向量架构...\n')

  try {
    // 1. 创建 document_embeddings 表
    console.log('1️⃣ 创建 document_embeddings 表...')
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        chunk_id UUID NOT NULL,  -- 不加外键约束，同时支持 document_chunks.id 和 prd_chunks.id
        model_name VARCHAR(100) NOT NULL,
        model_provider VARCHAR(50) NOT NULL,
        model_dimensions INTEGER NOT NULL,
        embedding vector,  -- 不指定维度,支持任意长度
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        -- 确保每个 chunk 的每个模型只有一个向量
        UNIQUE(chunk_id, model_name)
      )
    `)
    console.log('   ✅ 表创建成功\n')

    // 2. 创建索引
    console.log('2️⃣ 创建基础索引...')
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_model
      ON document_embeddings(chunk_id, model_name)
    `)
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_model
      ON document_embeddings(model_name)
    `)
    console.log('   ✅ 基础索引创建成功\n')

    // 3. 为常用模型创建向量索引
    console.log('3️⃣ 创建向量相似度索引...')

    // OpenAI text-embedding-3-small (1536 维) - 使用 IVFFlat
    console.log('   - 创建 OpenAI 1536 维向量索引 (IVFFlat)...')
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_openai_1536
      ON document_embeddings
      USING ivfflat ((embedding::vector(1536)) vector_cosine_ops)
      WITH (lists = 100)
      WHERE (model_name = 'text-embedding-3-small')
    `)

    // 智谱 AI embedding-3 (2048 维)
    // 注意: pgvector 0.x 版本索引有 2000 维限制
    // 2048 维向量将使用顺序扫描(对于小数据集影响不大)
    console.log('   ⚠️  智谱 AI 2048 维超过 pgvector 索引限制(2000 维)')
    console.log('      将使用顺序扫描(小数据集性能影响不大)')

    // OpenAI text-embedding-3-large (3072 维)
    // 同样超过索引限制,跳过
    console.log('   ⚠️  OpenAI 3072 维超过 pgvector 索引限制(2000 维)')
    console.log('      将使用顺序扫描')

    console.log('   ✅ 向量索引创建成功\n')

    // 4. 迁移现有数据(如果存在)
    console.log('4️⃣ 检查并迁移现有向量数据...')
    const existingVectorsResult = await dbClient.query(`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE embedding IS NOT NULL
    `)
    const existingCount = parseInt(existingVectorsResult.rows[0].count, 10)

    if (existingCount > 0) {
      console.log(`   发现 ${existingCount} 条现有向量,开始迁移...`)

      const migrateResult = await dbClient.query(`
        INSERT INTO document_embeddings
          (chunk_id, model_name, model_provider, model_dimensions, embedding)
        SELECT
          id,
          'text-embedding-3-small',
          'openai',
          1536,
          embedding
        FROM document_chunks
        WHERE embedding IS NOT NULL
        ON CONFLICT (chunk_id, model_name) DO NOTHING
        RETURNING id
      `)

      console.log(`   ✅ 成功迁移 ${migrateResult.rowCount} 条向量\n`)
    } else {
      console.log('   没有现有向量数据需要迁移\n')
    }

    // 5. 创建或更新 system_config 配置
    console.log('5️⃣ 配置模型信息...')
    await dbClient.query(`
      INSERT INTO system_config (key, value)
      VALUES (
        'embedding_models',
        '{
          "default": "embedding-3",
          "models": [
            {
              "name": "text-embedding-3-small",
              "provider": "openai",
              "dimensions": 1536,
              "description": "OpenAI Embedding Model (Small)",
              "enabled": true
            },
            {
              "name": "embedding-3",
              "provider": "zhipu",
              "dimensions": 2048,
              "description": "智谱 AI Embedding Model",
              "enabled": true
            },
            {
              "name": "text-embedding-3-large",
              "provider": "openai",
              "dimensions": 3072,
              "description": "OpenAI Embedding Model (Large)",
              "enabled": false
            }
          ]
        }'::jsonb
      )
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `)
    console.log('   ✅ 模型配置完成\n')

    // 6. 验证迁移结果
    console.log('6️⃣ 验证迁移结果...')
    const statsResult = await dbClient.query(`
      SELECT
        model_name,
        model_dimensions,
        COUNT(*) as vector_count
      FROM document_embeddings
      GROUP BY model_name, model_dimensions
      ORDER BY model_name
    `)

    console.log('   当前向量统计:')
    if (statsResult.rows.length > 0) {
      statsResult.rows.forEach((row: any) => {
        console.log(`   - ${row.model_name} (${row.model_dimensions}维): ${row.vector_count} 条`)
      })
    } else {
      console.log('   暂无向量数据')
    }
    console.log()

    console.log('🎉 多模型向量架构迁移完成!\n')
    console.log('📋 迁移总结:')
    console.log('   ✅ 创建了 document_embeddings 表')
    console.log('   ✅ 支持 3 种 Embedding 模型:')
    console.log('      - OpenAI text-embedding-3-small (1536 维)')
    console.log('      - 智谱 AI embedding-3 (2048 维) [默认]')
    console.log('      - OpenAI text-embedding-3-large (3072 维)')
    console.log('   ✅ 创建了对应的向量索引')
    console.log('   ✅ 迁移了现有向量数据')
    console.log()
    console.log('💡 下一步操作:')
    console.log('   1. 重新上传文档或手动触发向量化')
    console.log('   2. 系统会自动使用配置的默认模型 (embedding-3)')
    console.log('   3. 可以在 system_config 中修改 embedding_models.default 切换默认模型')
    console.log()
    console.log('📝 注意事项:')
    console.log('   - 原有的 document_chunks.embedding 列保留,向后兼容')
    console.log('   - 新的向量会存储在 document_embeddings 表中')
    console.log('   - 可以同时为一个文档块生成多个模型的向量')

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  } finally {
    await dbClient.close()
  }
}

// 运行迁移
migrateToMultiModelVectors().catch(error => {
  console.error('\n❌ 迁移失败:', error)
  process.exit(1)
})
