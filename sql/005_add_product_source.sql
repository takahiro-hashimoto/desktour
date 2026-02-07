-- 商品の取得元（amazon/rakuten）を記録するカラムを追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_source VARCHAR(20) DEFAULT 'amazon';

-- 楽天固有の情報用カラム（必要に応じて）
ALTER TABLE products ADD COLUMN IF NOT EXISTS rakuten_shop_name VARCHAR(255);

-- コメント:
-- asin カラムは楽天の場合 itemCode を格納
-- amazon_url カラムは楽天の場合 affiliateUrl を格納
-- amazon_image_url カラムは楽天の場合 mediumImageUrls を格納
-- amazon_price カラムは楽天の場合 itemPrice を格納
-- amazon_title カラムは楽天の場合 itemName を格納
