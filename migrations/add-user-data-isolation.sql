-- 用户级数据隔离迁移
-- 为 user_api_configs 表添加 user_id 支持

-- 1. 添加 user_id 列
ALTER TABLE user_api_configs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 2. 将现有无 user_id 的配置分配给第一个活跃用户
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM users WHERE is_active = true ORDER BY created_at LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    UPDATE user_api_configs SET user_id = first_user_id WHERE user_id IS NULL;
  ELSE
    -- 没有用户时删除孤立配置
    DELETE FROM user_api_configs WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. 移除 provider 的全局唯一约束
ALTER TABLE user_api_configs
  DROP CONSTRAINT IF EXISTS user_api_configs_provider_unique;
-- 兼容不同的约束名
DROP INDEX IF EXISTS user_api_configs_provider_key;

-- 4. 将 user_id 设为 NOT NULL
ALTER TABLE user_api_configs
  ALTER COLUMN user_id SET NOT NULL;

-- 5. 添加 (user_id, provider) 联合唯一约束
ALTER TABLE user_api_configs
  ADD CONSTRAINT unique_user_provider UNIQUE (user_id, provider);

-- 6. 添加 user_id 索引
CREATE INDEX IF NOT EXISTS idx_user_api_configs_user_id
  ON user_api_configs(user_id);
