-- CURATED. データベーススキーマ
-- Supabase SQL Editor で実行してください

-- 動画テーブル
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  subscriber_count INTEGER NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMP,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 商品テーブル
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  video_id TEXT NOT NULL,  -- 最初に紹介された動画
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reason TEXT,
  -- Amazon情報
  asin TEXT,
  amazon_url TEXT,
  amazon_image_url TEXT,
  amazon_price DECIMAL(10, 2),
  amazon_title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 商品言及テーブル（どの動画でどの商品が紹介されたか）
CREATE TABLE IF NOT EXISTS product_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  reason TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, video_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_product_mentions_product_id ON product_mentions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_mentions_video_id ON product_mentions(video_id);

-- 言及数を取得するビュー
CREATE OR REPLACE VIEW product_rankings AS
SELECT
  p.*,
  COUNT(pm.id) as mention_count
FROM products p
LEFT JOIN product_mentions pm ON p.id = pm.product_id
GROUP BY p.id
ORDER BY mention_count DESC;

-- RLS（Row Level Security）を有効化
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mentions ENABLE ROW LEVEL SECURITY;

-- 全員が読み書きできるポリシー（開発用）
CREATE POLICY "Allow all for videos" ON videos FOR ALL USING (true);
CREATE POLICY "Allow all for products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all for product_mentions" ON product_mentions FOR ALL USING (true);
