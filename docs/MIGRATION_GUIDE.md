# 数据库迁移规范

## 文件命名规范

所有迁移文件必须遵循以下命名格式：

```
YYYYMMDD_NNN-description.sql
```

### 格式说明

- `YYYYMMDD`: 8 位日期（如 20260302）
- `_`: 下划线分隔符
- `NNN`: 3 位序号（001, 002, 003...），同一天的多个迁移按顺序递增
- `-`: 连字符分隔符
- `description`: 简短描述（使用 kebab-case）
- `.sql`: 文件扩展名

### 示例

```
20260302_001-add-search-vector-column.sql
20260302_002-add-prd-parent-id.sql
20260303_001-create-webhooks-table.sql
```

---

## 迁移文件内容规范

### 1. 文件头部注释

每个迁移文件必须包含以下注释：

```sql
-- Migration: <描述>
-- Version: <版本号>
-- Created: <ISO 8601 时间戳>
-- Author: <作者>（可选）
--
-- Description:
-- <详细说明迁移的目的和影响>
--
-- Dependencies:
-- <依赖的其他迁移>（可选）
```

### 2. 幂等性

所有迁移必须是幂等的（可重复执行），使用以下模式：

```sql
-- 添加列
ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS column_name TYPE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column_name);

-- 创建表
CREATE TABLE IF NOT EXISTS table_name (...);

-- 删除列（谨慎使用）
ALTER TABLE table_name
  DROP COLUMN IF EXISTS column_name;
```

### 3. 事务包裹

对于复杂迁移，使用事务确保原子性：

```sql
BEGIN;

-- 迁移操作
ALTER TABLE ...;
CREATE INDEX ...;

COMMIT;
```

### 4. 数据回填

如果需要回填数据，添加进度提示：

```sql
-- 回填数据（可能耗时较长）
DO $$
DECLARE
  total_rows INTEGER;
  processed_rows INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM documents WHERE search_vector IS NULL;
  RAISE NOTICE '开始回填 % 行数据', total_rows;

  UPDATE documents
  SET search_vector = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  WHERE search_vector IS NULL;

  GET DIAGNOSTICS processed_rows = ROW_COUNT;
  RAISE NOTICE '完成回填 % 行数据', processed_rows;
END $$;
```

---

## 迁移类型与模板

### 1. 添加列

```sql
-- Migration: Add column_name to table_name
-- Version: YYYYMMDD_NNN
-- Created: YYYY-MM-DDTHH:MM:SSZ

ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- 添加索引（如需要）
CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column_name);

-- 回填数据（如需要）
UPDATE table_name
SET column_name = <expression>
WHERE column_name IS NULL;
```

### 2. 创建表

```sql
-- Migration: Create table_name table
-- Version: YYYYMMDD_NNN
-- Created: YYYY-MM-DDTHH:MM:SSZ

CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- 其他字段
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_table_created ON table_name(created_at DESC);

-- 添加注释
COMMENT ON TABLE table_name IS '表描述';
COMMENT ON COLUMN table_name.id IS '主键';
```

### 3. 添加外键

```sql
-- Migration: Add foreign key from table_a to table_b
-- Version: YYYYMMDD_NNN
-- Created: YYYY-MM-DDTHH:MM:SSZ

-- 添加列
ALTER TABLE table_a
  ADD COLUMN IF NOT EXISTS table_b_id UUID;

-- 添加外键约束
ALTER TABLE table_a
  ADD CONSTRAINT fk_table_a_table_b
  FOREIGN KEY (table_b_id)
  REFERENCES table_b(id)
  ON DELETE CASCADE;  -- 或 SET NULL, RESTRICT 等

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_table_a_table_b_id ON table_a(table_b_id);
```

### 4. 修改列类型

```sql
-- Migration: Change column_name type in table_name
-- Version: YYYYMMDD_NNN
-- Created: YYYY-MM-DDTHH:MM:SSZ

-- 修改列类型（需要 USING 子句转换数据）
ALTER TABLE table_name
  ALTER COLUMN column_name TYPE new_type
  USING column_name::new_type;

-- 如果有默认值，重新设置
ALTER TABLE table_name
  ALTER COLUMN column_name SET DEFAULT new_default;
```

### 5. 创建触发器

```sql
-- Migration: Add trigger for table_name
-- Version: YYYYMMDD_NNN
-- Created: YYYY-MM-DDTHH:MM:SSZ

-- 创建触发器函数
CREATE OR REPLACE FUNCTION table_name_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  -- 触发器逻辑
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器（如存在）
DROP TRIGGER IF EXISTS table_name_trigger ON table_name;

-- 创建新触发器
CREATE TRIGGER table_name_trigger
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION table_name_trigger_function();
```

---

## 迁移执行流程

### 1. 创建迁移

```bash
# 使用工具创建迁移文件
pnpm migrate create add-user-avatar

# 输出: migrations/20260302_001-add-user-avatar.sql
```

### 2. 编写迁移

在生成的文件中编写 SQL：

```sql
-- Migration: Add user avatar column
-- Version: 20260302_001
-- Created: 2026-03-02T10:00:00Z

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_users_avatar ON users(avatar_url)
WHERE avatar_url IS NOT NULL;
```

### 3. 本地测试

```bash
# 在本地测试数据库执行
export DATABASE_URL="postgresql://localhost:5432/archmind_dev"
pnpm migrate up

# 验证结果
psql $DATABASE_URL -c "\d users"
```

### 4. 提交代码

```bash
git add migrations/20260302_001-add-user-avatar.sql
git commit -m "feat: add user avatar column"
git push
```

### 5. 生产部署

```bash
# 1. 备份数据库
pg_dump $PROD_DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. 查看待执行迁移
pnpm migrate status

# 3. 执行迁移
pnpm migrate up

# 4. 验证结果
pnpm migrate status
```

---

## 迁移最佳实践

### 1. 向后兼容

- 添加列时使用 `DEFAULT` 或 `NULL`，避免锁表
- 不要删除正在使用的列或表
- 使用多步迁移处理破坏性变更

### 2. 性能考虑

- 大表添加索引时使用 `CONCURRENTLY`（需要在事务外执行）
- 数据回填分批处理，避免长时间锁表
- 在低峰期执行耗时迁移

### 3. 安全性

- 始终先在测试环境验证
- 生产环境执行前备份数据库
- 准备回滚方案

### 4. 文档化

- 在迁移文件中详细注释
- 更新 CHANGELOG.md
- 通知团队重大变更

---

## 常见错误与解决

### 错误 1: 列已存在

```
ERROR: column "xxx" of relation "yyy" already exists
```

**解决**: 使用 `IF NOT EXISTS`

```sql
ALTER TABLE yyy ADD COLUMN IF NOT EXISTS xxx TYPE;
```

### 错误 2: 外键约束失败

```
ERROR: insert or update on table "xxx" violates foreign key constraint
```

**解决**: 先清理无效数据

```sql
-- 删除无效引用
DELETE FROM xxx WHERE yyy_id NOT IN (SELECT id FROM yyy);

-- 再添加外键
ALTER TABLE xxx ADD CONSTRAINT fk_xxx_yyy ...;
```

### 错误 3: 迁移顺序错误

```
ERROR: relation "xxx" does not exist
```

**解决**: 检查迁移依赖，确保按正确顺序执行

```bash
# 查看迁移历史
pnpm migrate status

# 手动执行缺失的迁移
psql $DATABASE_URL < migrations/YYYYMMDD_NNN-xxx.sql
```

---

## 迁移回滚

### 自动回滚（推荐）

创建 `down` 迁移文件：

```
20260302_001-add-user-avatar.sql       # up 迁移
20260302_001-add-user-avatar.down.sql  # down 迁移
```

`down` 文件内容：

```sql
-- Rollback: Add user avatar column
-- Version: 20260302_001

DROP INDEX IF EXISTS idx_users_avatar;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
```

### 手动回滚

```bash
# 1. 恢复数据库备份
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# 2. 验证数据完整性
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# 3. 更新迁移记录
psql $DATABASE_URL -c "
  DELETE FROM schema_migrations
  WHERE version = '20260302_001';
"
```

---

*最后更新: 2026-03-02*
