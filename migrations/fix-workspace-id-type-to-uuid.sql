-- ============================================================
-- 修复 workspace_id / workspaces.id 类型 TEXT -> UUID（v0.5.0）
-- ============================================================
-- 背景：add-workspaces-support.sql 最初使用 TEXT 作为工作区主键，
-- 并将 documents/prd_documents/webhooks 的 workspace_id 定义为 TEXT。
-- 本迁移将这些字段统一转换为 UUID 类型，与其他迁移文件保持一致。
--
-- 执行前提：
--   1. workspaces.id 中不存在无法转换为 UUID 的值（如 'default' 字符串）
--      => 如有旧 'default' 记录，需先通过 migrate-workspace-id.ts 脚本完成数据迁移
--   2. 已执行过 add-workspaces-support.sql 的环境才需要运行本脚本
--      （新建环境直接从修正后的 add-workspaces-support.sql 建表，无需此补丁）
-- ============================================================

-- 1. 删除依赖 workspaces.id 的外键约束（documents）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND confrelid = 'workspaces'::regclass
  LOOP
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- 2. 删除依赖 workspaces.id 的外键约束（prd_documents）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'prd_documents'::regclass
      AND confrelid = 'workspaces'::regclass
  LOOP
    EXECUTE format('ALTER TABLE prd_documents DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- 3. 删除依赖 workspaces.id 的外键约束（webhooks）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'webhooks'::regclass
      AND confrelid = 'workspaces'::regclass
  LOOP
    EXECUTE format('ALTER TABLE webhooks DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- 4. 转换 workspaces.id 为 UUID
ALTER TABLE workspaces
  ALTER COLUMN id TYPE UUID USING id::uuid;

-- 5. 转换 documents.workspace_id 为 UUID（NULL 值保留 NULL）
ALTER TABLE documents
  ALTER COLUMN workspace_id TYPE UUID USING workspace_id::uuid;

-- 6. 转换 prd_documents.workspace_id 为 UUID（NULL 值保留 NULL）
ALTER TABLE prd_documents
  ALTER COLUMN workspace_id TYPE UUID USING workspace_id::uuid;

-- 7. 转换 webhooks.workspace_id 为 UUID（若 webhooks 表存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'webhooks'
  ) THEN
    ALTER TABLE webhooks
      ALTER COLUMN workspace_id TYPE UUID USING workspace_id::uuid;
  END IF;
END;
$$;

-- 8. 重新添加外键约束
ALTER TABLE documents
  ADD CONSTRAINT documents_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE prd_documents
  ADD CONSTRAINT prd_documents_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'webhooks'
  ) THEN
    EXECUTE '
      ALTER TABLE webhooks
        ADD CONSTRAINT webhooks_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    ';
  END IF;
END;
$$;
