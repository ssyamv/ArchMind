-- 回滚：移除 Onboarding 状态字段
ALTER TABLE users DROP COLUMN IF EXISTS onboarding_state;
