#!/bin/bash
# v0.4.0 生产环境数据库迁移脚本
set -e

echo "========================================="
echo "ArchMind v0.4.0 数据库迁移"
echo "========================================="
echo ""

# 加载环境变量
if [ -f .vercel/.env.production.local ]; then
    export $(grep -v '^#' .vercel/.env.production.local | grep DATABASE_URL | xargs)
    echo "✅ 环境变量已加载"
else
    echo "❌ 错误: .vercel/.env.production.local 不存在"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 未设置"
    exit 1
fi

echo "DATABASE_URL: ${DATABASE_URL:0:30}..."
echo ""

# 1. 创建备份
echo "📦 步骤 1/7: 创建数据库备份..."
BACKUP_FILE="backup_v0.4.0_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 备份已创建: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "❌ 备份失败"
    exit 1
fi
echo ""

# 2. 检查现有表
echo "🔍 步骤 2/7: 检查现有表..."
psql "$DATABASE_URL" -c "\dt" 2>&1 | grep -E "(prd_feedbacks|prd_snapshots|rag_retrieval_logs)" && {
    echo "⚠️  警告: 部分表已存在"
} || {
    echo "✅ 新表不存在，继续迁移"
}
echo ""

# 3. 添加 PRD 反馈表
echo "📝 步骤 3/7: 添加 PRD 反馈表..."
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prd_feedbacks');" 2>&1 | tr -d ' ')
if [ "$TABLE_EXISTS" = "t" ]; then
    echo "⏭️  prd_feedbacks 表已存在，跳过"
else
    psql "$DATABASE_URL" -f migrations/add-prd-feedbacks.sql 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ prd_feedbacks 表创建成功"
    else
        echo "❌ prd_feedbacks 表创建失败"
        exit 1
    fi
fi
echo ""

# 4. 添加 PRD 快照表
echo "📸 步骤 4/7: 添加 PRD 快照表..."
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prd_snapshots');" 2>&1 | tr -d ' ')
if [ "$TABLE_EXISTS" = "t" ]; then
    echo "⏭️  prd_snapshots 表已存在，跳过"
else
    psql "$DATABASE_URL" -f migrations/add-prd-snapshots.sql 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ prd_snapshots 表创建成功"
    else
        echo "❌ prd_snapshots 表创建失败"
        exit 1
    fi
fi
echo ""

# 5. 添加 RAG 检索日志表
echo "📊 步骤 5/7: 添加 RAG 检索日志表..."
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rag_retrieval_logs');" 2>&1 | tr -d ' ')
if [ "$TABLE_EXISTS" = "t" ]; then
    echo "⏭️  rag_retrieval_logs 表已存在，跳过"
else
    psql "$DATABASE_URL" -f migrations/add-rag-retrieval-logs.sql 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ rag_retrieval_logs 表创建成功"
    else
        echo "❌ rag_retrieval_logs 表创建失败"
        exit 1
    fi
fi
echo ""

# 6. 检查脏数据
echo "🧹 步骤 6/7: 检查脏数据..."
echo "检查 prd_documents 表..."
DIRTY_PRD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM prd_documents WHERE workspace_id = 'default';" 2>&1 | tr -d ' ')
if [ "$DIRTY_PRD_COUNT" -gt 0 ] 2>/dev/null; then
    echo "⚠️  发现 $DIRTY_PRD_COUNT 条 PRD 使用 'default' 工作区"
    echo "需要手动清理（参考 docs/PRODUCTION_MIGRATION_v0.4.0.md）"
else
    echo "✅ prd_documents 表无脏数据"
fi

echo "检查 documents 表..."
DIRTY_DOC_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM documents WHERE workspace_id = 'default';" 2>&1 | tr -d ' ')
if [ "$DIRTY_DOC_COUNT" -gt 0 ] 2>/dev/null; then
    echo "⚠️  发现 $DIRTY_DOC_COUNT 条文档使用 'default' 工作区"
    echo "需要手动清理（参考 docs/PRODUCTION_MIGRATION_v0.4.0.md）"
else
    echo "✅ documents 表无脏数据"
fi
echo ""

# 7. 验证迁移结果
echo "✅ 步骤 7/7: 验证迁移结果..."
echo "新表列表:"
psql "$DATABASE_URL" -c "SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size FROM pg_tables WHERE tablename IN ('prd_feedbacks', 'prd_snapshots', 'rag_retrieval_logs') ORDER BY tablename;" 2>&1
echo ""

echo "========================================="
echo "✅ 数据库迁移完成！"
echo "========================================="
echo ""
echo "📋 后续步骤:"
echo "1. 如果有脏数据，请参考 docs/PRODUCTION_MIGRATION_v0.4.0.md 进行清理"
echo "2. 清理 Redis 缓存"
echo "3. 访问应用并测试新功能"
echo "4. 检查 Sentry 是否有新错误"
echo ""
echo "备份文件: $BACKUP_FILE"
