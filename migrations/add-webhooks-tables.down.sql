-- 回滚：移除 Webhook 表
DROP INDEX IF EXISTS idx_webhook_deliveries_success;
DROP INDEX IF EXISTS idx_webhook_deliveries_created;
DROP INDEX IF EXISTS idx_webhook_deliveries_webhook;
DROP TABLE IF EXISTS webhook_deliveries;
DROP INDEX IF EXISTS idx_webhooks_user;
DROP INDEX IF EXISTS idx_webhooks_active;
DROP INDEX IF EXISTS idx_webhooks_workspace;
DROP TABLE IF EXISTS webhooks;
