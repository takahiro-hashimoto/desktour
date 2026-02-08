/**
 * 既存の全商品にスラッグを生成して更新するスクリプト
 *
 * 実行方法:
 * npx tsx scripts/generate-product-slugs.ts
 */

import { createClient } from '@supabase/supabase-js';
import { generateUniqueSlug } from '../src/lib/productSlug';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('必要な環境変数: SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Product {
  id: number;
  name: string;
  brand: string | null;
  asin: string | null;
  slug: string | null;
}

async function generateSlugsForAllProducts() {
  console.log('🚀 商品スラッグ生成スクリプトを開始します...\n');

  // 1. slug が NULL の全商品を取得
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, asin, slug')
    .is('slug', null)
    .order('id');

  if (error) {
    console.error('❌ 商品データの取得に失敗:', error);
    return;
  }

  if (!products || products.length === 0) {
    console.log('✅ スラッグが未設定の商品はありません');
    return;
  }

  console.log(`📦 対象商品数: ${products.length}件\n`);

  // 2. 既存のスラッグを取得（重複チェック用）
  const { data: existingProducts } = await supabase
    .from('products')
    .select('slug')
    .not('slug', 'is', null);

  const existingSlugs = new Set<string>(
    existingProducts?.map((p) => p.slug).filter(Boolean) || []
  );

  // 3. 各商品にスラッグを生成して更新
  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    try {
      const slug = generateUniqueSlug(
        { name: product.name, brand: product.brand, asin: product.asin },
        existingSlugs
      );

      const { error: updateError } = await supabase
        .from('products')
        .update({ slug })
        .eq('id', product.id);

      if (updateError) {
        console.error(`❌ ID ${product.id} の更新に失敗:`, updateError.message);
        errorCount++;
      } else {
        successCount++;
        console.log(`✅ [${successCount}/${products.length}] ${product.brand || 'Unknown'} - ${product.name}`);
        console.log(`   → /product/${slug}\n`);
      }
    } catch (err) {
      console.error(`❌ ID ${product.id} でエラー:`, err);
      errorCount++;
    }
  }

  // 4. 結果サマリー
  console.log('\n===========================================');
  console.log('📊 実行結果');
  console.log('===========================================');
  console.log(`✅ 成功: ${successCount}件`);
  console.log(`❌ 失敗: ${errorCount}件`);
  console.log(`📦 合計: ${products.length}件`);
  console.log('===========================================\n');
}

// スクリプト実行
generateSlugsForAllProducts()
  .then(() => {
    console.log('✨ スラッグ生成が完了しました！');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ スクリプト実行中にエラーが発生:', err);
    process.exit(1);
  });
