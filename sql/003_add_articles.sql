-- 記事テーブルを作成
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  author_url TEXT,
  site_name TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'blog', 'other')),
  thumbnail_url TEXT,
  published_at TIMESTAMP,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  summary TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- productsテーブルにarticle_idとsource_typeを追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS article_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'video';

-- product_mentionsテーブルにarticle_idとsource_typeを追加
ALTER TABLE product_mentions ADD COLUMN IF NOT EXISTS article_id TEXT;
ALTER TABLE product_mentions ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'video';

-- influencersテーブルにarticle関連カラムを追加
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS article_count INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'youtube';

-- channel_idのNOT NULL制約を削除（記事著者の場合はnull）
ALTER TABLE influencers ALTER COLUMN channel_id DROP NOT NULL;
ALTER TABLE influencers ALTER COLUMN channel_title DROP NOT NULL;
ALTER TABLE influencers ALTER COLUMN subscriber_count DROP NOT NULL;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author);
CREATE INDEX IF NOT EXISTS idx_products_article_id ON products(article_id);
CREATE INDEX IF NOT EXISTS idx_products_source_type ON products(source_type);
CREATE INDEX IF NOT EXISTS idx_product_mentions_article_id ON product_mentions(article_id);
CREATE INDEX IF NOT EXISTS idx_influencers_author_id ON influencers(author_id);
CREATE INDEX IF NOT EXISTS idx_influencers_source_type ON influencers(source_type);
