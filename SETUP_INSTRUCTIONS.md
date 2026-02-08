# サブカテゴリー・タグ機能のセットアップ手順

## 問題
商品詳細ページでサブカテゴリーとタグが表示されない

## 原因
`products`テーブルに`tags`カラムが存在しない、または値が入っていない

## 解決手順

### ステップ1: Supabaseでスキーマ確認

Supabase Dashboard → SQL Editor で以下を実行：

```sql
-- productsテーブルのスキーマを確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('subcategory', 'tags')
ORDER BY column_name;
```

### ステップ2: カラムが存在しない場合は追加

```sql
-- サブカテゴリカラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

-- タグカラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);
```

### ステップ3: 既存商品のタグ・サブカテゴリーを更新

既存の商品データにはsubcategoryとtagsが入っていないため、管理画面から再解析が必要です。

#### 方法1: 個別に再解析（推奨）
1. `/admin`ページにアクセス
2. 動画または記事を選択
3. 「再解析」ボタンをクリック
4. API検索が実行され、サブカテゴリーとタグが自動抽出されます

#### 方法2: 一括更新（開発中の機能）
今後、既存商品のタグを一括更新するバッチ処理を実装予定

### ステップ4: 動作確認

1. 新しい動画・記事を解析する
2. 商品詳細ページにアクセス
3. 基本情報の「特徴」に以下が表示される：
   - サブカテゴリー（青いバッジ）
   - タグ（グレーのバッジ）

## 追加されたタグの種類

### 全カテゴリー共通
- 接続方式: ワイヤレス、有線、Bluetooth、USB接続、2.4GHz
- 用途: ゲーミング、配信、仕事、音楽制作、クリエイティブ
- 特徴: コンパクト、軽量、静音、RGB、ホワイト、ブラック

### キーボード専用
- ホットスワップ、日本語配列、英語配列、Mac配列

### マウス専用
- 多ボタン、超軽量

### ディスプレイ・モニター専用
- IPS、VA、湾曲、HDR、USB-C
- サイズ: 24インチ以下、27インチ、32インチ、34インチ以上

### チェア専用
- リクライニング、ハイバック、アームレスト付き

### デスク専用
- 機能: 電動、手動
- 構成: 天板のみ、脚のみ
- 天板の色: 木目天板、黒天板、白天板
- サイズ: 120cm、140cm、160cm、180cm

## トラブルシューティング

### タグが表示されない場合
1. ブラウザのコンソールを開く
2. デバッグログを確認：
   - `Subcategory (raw): null` → データがない（再解析が必要）
   - `Tags (raw): undefined` → カラムが存在しない（ステップ2を実行）

### 既存商品のタグを追加したい
管理画面から該当の動画・記事を選択し、「再解析」を実行してください。
