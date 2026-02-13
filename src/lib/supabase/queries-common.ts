import { supabase } from "./client";
import { normalizeProductName } from "../product-normalize";
import { normalizeBrandByList, getBrandAliases } from "../brand-category-utils";
import { fuzzyMatchProduct } from "../fuzzy-product-match";

/**
 * 商品名リストからDB上に既に存在する商品をバッチチェックする
 *
 * @param productNames - チェックする商品名の配列
 * @param table - テーブル名（"products_camera" or "products"）
 * @returns 商品名 → 既存フラグのマップ
 */
export async function checkExistingProducts(
  productNames: string[],
  table: "products_camera" | "products"
): Promise<Record<string, boolean>> {
  if (productNames.length === 0) return {};

  const normalizedNames = productNames.map(name => ({
    original: name,
    normalized: normalizeProductName(name),
  }));

  const allNormalized = [...new Set(normalizedNames.map(n => n.normalized))];

  const { data } = await supabase
    .from(table)
    .select("normalized_name")
    .in("normalized_name", allNormalized);

  const existingNormalized = new Set(data?.map(d => d.normalized_name) || []);

  const result: Record<string, boolean> = {};
  for (const { original, normalized } of normalizedNames) {
    result[original] = existingNormalized.has(normalized);
  }
  return result;
}

/**
 * 商品名リストからDB上の既存商品をフル情報付きでバッチ取得する
 * normalized_nameで照合し、ASIN/Amazon情報を含む商品データを返す
 * → 過去に登録・マッチ済みの商品情報を「学習データ」として再利用するために使用
 */
export interface ExistingProductMatch {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  category: string;
  asin: string | null;
  amazon_url: string | null;
  amazon_image_url: string | null;
  amazon_title: string | null;
  amazon_price: number | null;
  amazon_brand: string | null;
  product_source: string | null;
  tags: string[] | null;
}

export async function findExistingProducts(
  productNames: string[],
  table: "products_camera" | "products",
  // ファジーマッチ用のカテゴリ・ブランド情報（渡さなければファジーマッチをスキップ）
  productMeta?: Array<{ name: string; category?: string; brand?: string }>
): Promise<Map<string, ExistingProductMatch>> {
  if (productNames.length === 0) return new Map();

  const normalizedMap = productNames.map(name => ({
    original: name,
    normalized: normalizeProductName(name),
  }));

  const allNormalized = [...new Set(normalizedMap.map(n => n.normalized))];

  const { data } = await supabase
    .from(table)
    .select("id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags")
    .in("normalized_name", allNormalized);

  // normalized_name → 商品データのマップ
  const normalizedToProduct = new Map<string, ExistingProductMatch>();
  for (const row of data || []) {
    // ASIN付きの商品を優先（複数ある場合）
    const existing = normalizedToProduct.get(row.normalized_name);
    if (!existing || (!existing.asin && row.asin)) {
      normalizedToProduct.set(row.normalized_name, row as ExistingProductMatch);
    }
  }

  // 元の商品名 → 商品データのマップに変換
  const result = new Map<string, ExistingProductMatch>();
  const unmatchedNames: Array<{ original: string; normalized: string; category?: string; brand?: string }> = [];

  for (const { original, normalized } of normalizedMap) {
    const match = normalizedToProduct.get(normalized);
    if (match) {
      result.set(original, match);
    } else if (productMeta) {
      // 完全一致しなかった → ファジーマッチ候補として記録
      const meta = productMeta.find(m => m.name === original);
      unmatchedNames.push({
        original,
        normalized,
        category: meta?.category,
        brand: meta?.brand,
      });
    }
  }

  // --- ファジーマッチフォールバック ---
  if (unmatchedNames.length > 0 && productMeta) {
    // カテゴリごとにグループ化
    const byCategory = new Map<string, typeof unmatchedNames>();
    for (const item of unmatchedNames) {
      const cat = item.category || "__unknown__";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(item);
    }

    for (const [category, items] of byCategory) {
      if (category === "__unknown__") continue;

      // 同カテゴリのDB商品を取得
      const { data: candidates } = await supabase
        .from(table)
        .select("id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags")
        .eq("category", category)
        .limit(200);

      if (!candidates || candidates.length === 0) continue;

      for (const item of items) {
        const fuzzyResult = fuzzyMatchProduct(
          item.normalized,
          candidates,
          item.brand
        );

        if (fuzzyResult) {
          const matched = candidates[fuzzyResult.index];
          console.log(`[findExistingProducts] Fuzzy match: "${item.original}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
          result.set(item.original, matched as ExistingProductMatch);
        }
      }
    }
  }

  return result;
}

/**
 * DBに登録済みのブランド名を一括取得し、入力ブランド名を正規化するマップを返す
 * 例: "sony" → "Sony", "SONY" → "Sony", "SONY（ソニー）" → "Sony", "ソニー" → "Sony"
 * → Gemini抽出結果のブランド表記揺れを解消するために使用
 */
export async function buildBrandNormalizationMap(
  brands: string[],
  table: "products_camera" | "products"
): Promise<Map<string, string>> {
  if (brands.length === 0) return new Map();

  const resultMap = new Map<string, string>();
  const uniqueBrands = [...new Set(brands.filter(b => b))];

  // 1. DBから既存ブランド一覧を取得（distinct）
  const { data } = await supabase
    .from(table)
    .select("brand")
    .not("brand", "is", null);

  const dbBrands = [...new Set((data || []).map(d => d.brand as string).filter(Boolean))];

  // 2. 各ブランド名に対して、DB既存ブランドとの照合を行う
  for (const inputBrand of uniqueBrands) {
    const trimmed = inputBrand.trim();
    const inputLower = trimmed.toLowerCase();

    // 括弧内の表記を除去して比較 (例: "SONY（ソニー）" → "SONY")
    const withoutBrackets = trimmed
      .replace(/[（(][^）)]*[）)]/g, "")
      .trim();
    const withoutBracketsLower = withoutBrackets.toLowerCase();

    // エイリアスを取得
    const aliases = getBrandAliases(trimmed);
    const aliasesWithoutBrackets = getBrandAliases(withoutBrackets);
    const allAliases = new Set([...aliases, ...aliasesWithoutBrackets]);

    for (const dbBrand of dbBrands) {
      const dbBrandLower = dbBrand.toLowerCase();

      // 完全一致（大文字小文字無視）
      if (dbBrandLower === inputLower || dbBrandLower === withoutBracketsLower) {
        resultMap.set(inputBrand, dbBrand);
        break;
      }

      // エイリアス経由一致
      if (allAliases.has(dbBrandLower)) {
        resultMap.set(inputBrand, dbBrand);
        break;
      }

      // DB側のエイリアスとも照合
      const dbAliases = getBrandAliases(dbBrand);
      if (dbAliases.some(a => a === inputLower || a === withoutBracketsLower)) {
        resultMap.set(inputBrand, dbBrand);
        break;
      }
    }
  }

  return resultMap;
}

/**
 * ブランド名を正規化する
 * 1. 定数リスト（BRAND_TAGS / CAMERA_BRAND_TAGS）でマッチ
 * 2. エイリアス（日本語名等）でマッチ
 * 3. DBに既存のブランド名をilkeで検索し、最初に登録された表記を正とする
 * 4. いずれもマッチしなければ元の値をそのまま返す（新規ブランド）
 */
export async function normalizeBrand(
  brand: string,
  table: "products_camera" | "products",
  knownBrands: readonly string[]
): Promise<string> {
  if (!brand) return brand;
  const trimmed = brand.trim();

  // 1. 定数リストで解決（高速・確実）
  const listMatch = normalizeBrandByList(trimmed, knownBrands);
  if (listMatch !== trimmed) return listMatch;

  // 2. DBに同名ブランドが既に存在するか検索（大文字小文字無視）
  const { data } = await supabase
    .from(table)
    .select("brand")
    .ilike("brand", trimmed)
    .limit(1);

  if (data && data.length > 0 && data[0].brand) {
    return data[0].brand;
  }

  // 3. エイリアス経由でDB検索（例: "ソニー" → DB上の "Sony" を探す）
  const aliases = getBrandAliases(trimmed);
  for (const alias of aliases) {
    if (alias === trimmed.toLowerCase()) continue; // ilike で既に検索済み
    const { data: aliasData } = await supabase
      .from(table)
      .select("brand")
      .ilike("brand", alias)
      .limit(1);

    if (aliasData && aliasData.length > 0 && aliasData[0].brand) {
      return aliasData[0].brand;
    }
  }

  // 4. 新規ブランド → そのまま返す
  return trimmed;
}
