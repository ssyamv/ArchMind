-- 回滚：移除协作表（评论、活动日志）
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS comments;
