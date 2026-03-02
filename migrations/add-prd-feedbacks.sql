-- #54 PRD 用户反馈打分机制
-- 创建 prd_feedbacks 表

CREATE TABLE IF NOT EXISTS prd_feedbacks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id      UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  positives   TEXT[],
  negatives   TEXT[],
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prd_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prd_feedbacks_prd_id ON prd_feedbacks(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_feedbacks_user_id ON prd_feedbacks(user_id);
