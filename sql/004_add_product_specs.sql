-- productsテーブルに詳細スペック情報カラムを追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_manufacturer TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_model_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_size TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_weight TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_release_date TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_features TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_technical_info JSONB;
