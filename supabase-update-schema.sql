-- スキーマ更新SQL
-- Supabase SQL Editor で実行してください

-- 1. influencersテーブルに職種カラム追加
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS occupation_tags TEXT[];

-- 2. productsテーブルにブランド・価格帯カラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_range TEXT;  -- 'under_5000', '5000_10000', '10000_30000', '30000_50000', 'over_50000'

-- 3. インデックス追加
CREATE INDEX IF NOT EXISTS idx_influencers_occupation ON influencers(occupation);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price_range ON products(price_range);
CREATE INDEX IF NOT EXISTS idx_influencers_occupation_tags ON influencers USING GIN (occupation_tags);

-- 4. productsテーブルにサブカテゴリカラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
