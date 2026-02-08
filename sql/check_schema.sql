-- productsテーブルのスキーマを確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('subcategory', 'tags')
ORDER BY column_name;

-- 実際のデータを確認（最初の1件）
SELECT id, name, subcategory, tags
FROM products
LIMIT 1;
