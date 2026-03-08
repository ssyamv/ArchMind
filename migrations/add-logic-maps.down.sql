-- 回滚：移除逻辑图谱表
DROP INDEX IF EXISTS idx_mermaid_lm_created_at;
DROP INDEX IF EXISTS idx_mermaid_lm_user_id;
DROP INDEX IF EXISTS idx_mermaid_lm_prd_id;
DROP INDEX IF EXISTS idx_mermaid_lm_workspace_id;
DROP TABLE IF EXISTS mermaid_logic_maps;
