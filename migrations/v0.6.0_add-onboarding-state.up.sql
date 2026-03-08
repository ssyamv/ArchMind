-- v0.6.0: 新增 onboarding_state 字段到 users 表
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}';
