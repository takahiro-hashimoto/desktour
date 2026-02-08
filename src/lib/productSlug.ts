/**
 * 商品スラッグ生成ユーティリティ
 */

// 日本語ブランド名のローマ字マッピング
const JAPANESE_BRAND_MAP: Record<string, string> = {
  'サンワサプライ': 'sanwa-supply',
  'サンワダイレクト': 'sanwa-direct',
  'マルトクショップ': 'marutoku',
  'サンニード': 'sanneed',
  'タイムタイマー': 'time-timer',
  '山崎実業': 'yamazaki',
  'コクヨ': 'kokuyo',
  'コクヨファニチャー': 'kokuyo-furniture',
  'ジャーナルスタンダードファニチャー': 'journal-standard-furniture',
  'キングジム': 'kingjim',
  'ゼンハイザー': 'sennheiser',
  'オウルテック': 'owltech',
  'オーディオテクニカ': 'audio-technica',
  'エルゴトロン': 'ergotron',
};

/**
 * 商品名とブランド名からURLスラッグを生成
 *
 * ルール:
 * 1. ブランド名を小文字化してハイフンで区切る（日本語ブランドはマッピングテーブルから取得）
 * 2. 商品名から英数字のみを抽出（日本語は自動削除）
 * 3. スペースをハイフンに変換
 * 4. 最大50文字に制限
 *
 * @example
 * generateProductSlug({ name: "MX Master 3S", brand: "Logicool" })
 * // → "logicool-mx-master-3s"
 *
 * generateProductSlug({ name: "電動昇降デスク E7", brand: "FlexiSpot" })
 * // → "flexispot-e7"
 *
 * generateProductSlug({ name: "Professional Hybrid Type-S 日本語配列", brand: "HHKB" })
 * // → "hhkb-professional-hybrid-type-s"
 */
export function generateProductSlug(product: {
  name: string;
  brand?: string | null;
  asin?: string | null;
}): string {
  // 1. ブランド名を処理
  let brandSlug = 'product'; // デフォルトを "unknown" から "product" に変更

  if (product.brand) {
    // 日本語ブランド名のマッピングをチェック
    if (JAPANESE_BRAND_MAP[product.brand]) {
      brandSlug = JAPANESE_BRAND_MAP[product.brand];
    } else {
      // 英語ブランド名の場合
      const processed = product.brand
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // 空文字列にならないようにチェック
      if (processed) {
        brandSlug = processed;
      }
    }
  }

  // 2. 商品名からブランド名を除去してから処理
  let productName = product.name;

  // 商品名の先頭にブランド名が含まれている場合は除去
  if (product.brand) {
    const brandLower = product.brand.toLowerCase();
    const nameLower = productName.toLowerCase();

    // 完全一致で先頭にブランド名がある場合は除去
    if (nameLower.startsWith(brandLower + ' ') || nameLower.startsWith(brandLower + '-')) {
      productName = productName.substring(product.brand.length).trim();
    }
  }

  const nameSlug = productName
    .toLowerCase()
    .trim()
    // 英数字、ハイフン、スペースのみ残す（日本語は削除される）
    .replace(/[^a-z0-9\s-]/g, ' ')
    // 連続スペースを1つに
    .replace(/\s+/g, '-')
    // 連続ハイフンを1つに
    .replace(/-+/g, '-')
    // 前後のハイフン削除
    .replace(/^-+|-+$/g, '');

  // 3. ブランド + 商品名を結合
  // 商品名が空の場合はASINを使用
  let fullSlug: string;
  if (nameSlug) {
    fullSlug = `${brandSlug}-${nameSlug}`;
  } else if (product.asin) {
    fullSlug = `${brandSlug}-${product.asin.toLowerCase()}`;
  } else {
    fullSlug = brandSlug;
  }

  // 4. 最大50文字に制限（ブランド部分は保持）
  if (fullSlug.length > 50) {
    const maxNameLength = 50 - brandSlug.length - 1; // -1 はハイフン分
    if (maxNameLength > 0) {
      const slug = nameSlug || (product.asin?.toLowerCase() || '');
      return `${brandSlug}-${slug.substring(0, maxNameLength)}`;
    }
  }

  return fullSlug;
}

/**
 * スラッグの重複を解決するためにサフィックスを追加
 *
 * @example
 * addSuffixToSlug("logicool-mx-master-3s", 2)
 * // → "logicool-mx-master-3s-2"
 */
export function addSuffixToSlug(slug: string, suffix: number): string {
  return `${slug}-${suffix}`;
}

/**
 * 商品データの配列から一意なスラッグを生成
 * 重複がある場合は自動的にサフィックスを追加
 */
export function generateUniqueSlug(
  product: { name: string; brand?: string | null; asin?: string | null },
  existingSlugs: Set<string>
): string {
  let slug = generateProductSlug(product);
  let suffix = 2;

  // 重複チェック
  while (existingSlugs.has(slug)) {
    slug = addSuffixToSlug(generateProductSlug(product), suffix);
    suffix++;
  }

  existingSlugs.add(slug);
  return slug;
}
