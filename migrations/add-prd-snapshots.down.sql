-- 回滚：移除 PRD 快照表
DROP INDEX IF EXISTS idx_prd_snapshots_type;
DROP INDEX IF EXISTS idx_prd_snapshots_prd_created;
DROP TABLE IF EXISTS prd_snapshots;
