-- 审计日志表
-- 记录关键用户操作、数据修改、文件下载、模型调用等

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,        -- 操作类型，如 document.download, prd.create
  resource_type VARCHAR(50),           -- 资源类型，如 document, prd, prototype
  resource_id UUID,                    -- 资源 ID
  status VARCHAR(20) NOT NULL DEFAULT 'success', -- success / failure
  ip_address INET,                     -- 客户端 IP
  user_agent TEXT,                     -- User-Agent
  metadata JSONB DEFAULT '{}',         -- 额外上下文（如文件名、token 用量等）
  error_message TEXT,                  -- 失败时的错误信息
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
