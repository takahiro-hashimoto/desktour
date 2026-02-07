-- videosテーブルにtagsカラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags TEXT[];

-- tagsにインデックスを追加（配列検索用）
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN (tags);
