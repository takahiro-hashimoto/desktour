-- インフルエンサーテーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS influencers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT UNIQUE NOT NULL,
  channel_title TEXT NOT NULL,
  subscriber_count INTEGER NOT NULL,
  thumbnail_url TEXT,
  video_count INTEGER DEFAULT 0,  -- 解析した動画数
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_influencers_channel_id ON influencers(channel_id);
CREATE INDEX IF NOT EXISTS idx_influencers_subscriber_count ON influencers(subscriber_count);

-- RLS（Row Level Security）を有効化
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

-- 全員が読み書きできるポリシー（開発用）
CREATE POLICY "Allow all for influencers" ON influencers FOR ALL USING (true);
