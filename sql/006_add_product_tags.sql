-- productsテーブルにtagsカラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[];

-- tagsにインデックスを追加（配列検索用）
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);
