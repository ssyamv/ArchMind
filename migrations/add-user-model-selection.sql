-- 迁移：为 user_api_configs 表添加 models 字段
-- 用于存储用户自选/自定义的模型 ID 列表
ALTER TABLE user_api_configs
ADD COLUMN IF NOT EXISTS models JSONB NOT NULL DEFAULT '[]'::jsonb;
