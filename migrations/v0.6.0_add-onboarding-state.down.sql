-- v0.6.0 回滚: 移除 onboarding_state 字段
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarding_state;
