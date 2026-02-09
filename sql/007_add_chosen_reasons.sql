-- 商品の「選ばれている理由」カラムを追加（Geminiによるコメント要約）
ALTER TABLE products ADD COLUMN IF NOT EXISTS chosen_reasons JSONB;

-- コメント数が多い商品を検索しやすくするためのインデックスは不要
-- chosen_reasons は商品詳細ページ表示時にのみ参照されるため
