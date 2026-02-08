-- productsテーブルにsubcategoryとtagsカラムを追加
-- Supabase SQL Editorで実行してください

-- サブカテゴリカラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

-- タグカラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);

-- 確認クエリ（実行後にこれを実行して確認）
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'products'
-- AND column_name IN ('subcategory', 'tags');
