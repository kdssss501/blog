-- D1 数据库初始化 SQL
-- 执行命令: npx wrangler d1 execute kdssss-blog-db --remote --file=./functions/_d1_init.sql

-- 键值存储表（统一存储所有数据）
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 索引（加速前缀查询）
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store(key);
