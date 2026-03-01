-- ============================================
-- Webhook 类型字段（v0.4.0）
-- 支持多平台内置消息格式
-- ============================================

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (type IN ('standard', 'feishu', 'dingtalk', 'wecom', 'slack', 'discord'));
