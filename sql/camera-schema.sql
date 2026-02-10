-- 撮影機材DB データベーススキーマ
-- Supabase SQL Editor で実行してください

-- ========================================
-- 動画テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS videos_camera (
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
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 記事テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS articles_camera (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  author_url TEXT,
  site_name TEXT,
  source_type TEXT CHECK (source_type IN ('note', 'blog', 'other')) DEFAULT 'other',
  thumbnail_url TEXT,
  published_at TIMESTAMP,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  summary TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 商品テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS products_camera (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT,
  slug TEXT UNIQUE,
  brand TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  lens_tags TEXT[],
  body_tags TEXT[],
  tags TEXT[],
  reason TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  video_id TEXT,
  article_id TEXT,
  source_type TEXT CHECK (source_type IN ('video', 'article')) DEFAULT 'video',
  price_range TEXT,
  product_source TEXT CHECK (product_source IN ('amazon', 'rakuten')),
  -- Amazon情報
  asin TEXT UNIQUE,
  amazon_url TEXT,
  amazon_image_url TEXT,
  amazon_price DECIMAL(10, 2),
  amazon_title TEXT,
  amazon_manufacturer TEXT,
  amazon_brand TEXT,
  amazon_model_number TEXT,
  amazon_color TEXT,
  amazon_size TEXT,
  amazon_weight TEXT,
  amazon_release_date TEXT,
  amazon_features TEXT[],
  amazon_features_raw TEXT[],
  amazon_technical_info JSONB,
  amazon_categories TEXT[],
  amazon_product_group TEXT,
  rakuten_shop_name TEXT,
  chosen_reasons JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 商品言及テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS product_mentions_camera (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products_camera(id) ON DELETE CASCADE,
  video_id TEXT,
  article_id TEXT,
  source_type TEXT CHECK (source_type IN ('video', 'article')) DEFAULT 'video',
  reason TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, video_id),
  UNIQUE(product_id, article_id)
);

-- ========================================
-- インフルエンサーテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS influencers_camera (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT UNIQUE,
  author_id TEXT UNIQUE,
  channel_title TEXT,
  author_name TEXT,
  subscriber_count INTEGER,
  thumbnail_url TEXT,
  video_count INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  source_type TEXT CHECK (source_type IN ('youtube', 'article')) DEFAULT 'youtube',
  occupation TEXT,
  occupation_tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- インデックス
-- ========================================

-- videos_camera
CREATE INDEX IF NOT EXISTS idx_videos_camera_tags ON videos_camera USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_videos_camera_channel_id ON videos_camera(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_camera_published_at ON videos_camera(published_at);

-- articles_camera
CREATE INDEX IF NOT EXISTS idx_articles_camera_tags ON articles_camera USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_articles_camera_published_at ON articles_camera(published_at);

-- products_camera
CREATE INDEX IF NOT EXISTS idx_products_camera_category ON products_camera(category);
CREATE INDEX IF NOT EXISTS idx_products_camera_subcategory ON products_camera(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_camera_brand ON products_camera(brand);
CREATE INDEX IF NOT EXISTS idx_products_camera_price_range ON products_camera(price_range);
CREATE INDEX IF NOT EXISTS idx_products_camera_name ON products_camera(name);
CREATE INDEX IF NOT EXISTS idx_products_camera_slug ON products_camera(slug);
CREATE INDEX IF NOT EXISTS idx_products_camera_tags ON products_camera USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_products_camera_lens_tags ON products_camera USING GIN (lens_tags);
CREATE INDEX IF NOT EXISTS idx_products_camera_body_tags ON products_camera USING GIN (body_tags);

-- product_mentions_camera
CREATE INDEX IF NOT EXISTS idx_product_mentions_camera_product_id ON product_mentions_camera(product_id);
CREATE INDEX IF NOT EXISTS idx_product_mentions_camera_video_id ON product_mentions_camera(video_id);
CREATE INDEX IF NOT EXISTS idx_product_mentions_camera_article_id ON product_mentions_camera(article_id);

-- influencers_camera
CREATE INDEX IF NOT EXISTS idx_influencers_camera_channel_id ON influencers_camera(channel_id);
CREATE INDEX IF NOT EXISTS idx_influencers_camera_author_id ON influencers_camera(author_id);
CREATE INDEX IF NOT EXISTS idx_influencers_camera_subscriber_count ON influencers_camera(subscriber_count);
CREATE INDEX IF NOT EXISTS idx_influencers_camera_occupation ON influencers_camera(occupation);
CREATE INDEX IF NOT EXISTS idx_influencers_camera_occupation_tags ON influencers_camera USING GIN (occupation_tags);

-- ========================================
-- ビュー: 言及数ランキング
-- ========================================
CREATE OR REPLACE VIEW product_rankings_camera AS
SELECT
  p.*,
  COUNT(pm.id) as mention_count
FROM products_camera p
LEFT JOIN product_mentions_camera pm ON p.id = pm.product_id
GROUP BY p.id
ORDER BY mention_count DESC;

-- ========================================
-- RLS（Row Level Security）
-- ========================================
ALTER TABLE videos_camera ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_camera ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_camera ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mentions_camera ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers_camera ENABLE ROW LEVEL SECURITY;

-- 全員が読み書きできるポリシー（開発用）
CREATE POLICY "Allow all for videos_camera" ON videos_camera FOR ALL USING (true);
CREATE POLICY "Allow all for articles_camera" ON articles_camera FOR ALL USING (true);
CREATE POLICY "Allow all for products_camera" ON products_camera FOR ALL USING (true);
CREATE POLICY "Allow all for product_mentions_camera" ON product_mentions_camera FOR ALL USING (true);
CREATE POLICY "Allow all for influencers_camera" ON influencers_camera FOR ALL USING (true);
