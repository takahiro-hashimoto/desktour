import { supabase } from "./client";
import { findBrandByName } from "./queries-brands";
import { normalizeProductName } from "../product-normalize";
import { normalizeBrandByList, getBrandAliases } from "../brand-category-utils";
import { fuzzyMatchProduct } from "../fuzzy-product-match";
import { isExcludedBrand } from "../excluded-brands";

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
  // case-insensitive対応: 元の値 + lowercase の両方でクエリ
  const allLower = allNormalized.map(n => n.toLowerCase());
  const queryValues = [...new Set([...allNormalized, ...allLower])];

  const { data } = await supabase
    .from(table)
    .select("normalized_name")
    .in("normalized_name", queryValues);

  // lowercase keyで格納してcase-insensitive照合
  const existingNormalized = new Set(
    (data || []).map(d => d.normalized_name.toLowerCase())
  );

  const result: Record<string, boolean> = {};
  for (const { original, normalized } of normalizedNames) {
    result[original] = existingNormalized.has(normalized.toLowerCase());
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

  // case-insensitive対応: 元の値 + lowercase の両方でクエリ（旧データも新データもヒットさせる）
  const allLower = allNormalized.map(n => n.toLowerCase());
  const queryValues = [...new Set([...allNormalized, ...allLower])];

  const { data } = await supabase
    .from(table)
    .select("id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags")
    .in("normalized_name", queryValues);

  // normalized_name → 商品データのマップ（lowercase keyで格納してcase-insensitive照合）
  const normalizedToProduct = new Map<string, ExistingProductMatch>();
  for (const row of data || []) {
    const key = row.normalized_name.toLowerCase();
    // ASIN付きの商品を優先（複数ある場合）
    const existing = normalizedToProduct.get(key);
    if (!existing || (!existing.asin && row.asin)) {
      normalizedToProduct.set(key, row as ExistingProductMatch);
    }
  }

  // 元の商品名 → 商品データのマップに変換（lowercase keyで照合）
  const result = new Map<string, ExistingProductMatch>();
  const unmatchedNames: Array<{ original: string; normalized: string; category?: string; brand?: string }> = [];

  for (const { original, normalized } of normalizedMap) {
    const match = normalizedToProduct.get(normalized.toLowerCase());
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

  // --- brand+name 結合検索（name単体で不一致だった商品のフォールバック） ---
  // 例: brand="Apple", name="Studio Display" → "Apple Studio Display" で再検索
  if (unmatchedNames.length > 0 && productMeta) {
    for (const item of unmatchedNames) {
      if (result.has(item.original)) continue;
      if (!item.brand) continue;

      const brandPlusName = normalizeProductName(`${item.brand} ${item.original}`);
      const brandPlusNameLower = brandPlusName.toLowerCase();

      // DB側のnormalized_nameが "Brand ProductName" 形式の場合にヒット
      const matchByBrandName = normalizedToProduct.get(brandPlusNameLower);
      if (matchByBrandName) {
        console.log(`[findExistingProducts] Brand+name match: "${item.original}" (brand: ${item.brand}) → "${matchByBrandName.name}"`);
        result.set(item.original, matchByBrandName);
        continue;
      }

      // 逆パターン: DB側がname単体で、入力がbrand+name結合の場合にも対応
      // → normalized_name に brand+name で追加クエリ
      const { data: brandNameMatch } = await supabase
        .from(table)
        .select("id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags")
        .eq("normalized_name", brandPlusName)
        .limit(1)
        .maybeSingle();

      if (brandNameMatch) {
        console.log(`[findExistingProducts] Brand+name DB match: "${item.original}" (brand: ${item.brand}) → "${brandNameMatch.name}"`);
        result.set(item.original, brandNameMatch as ExistingProductMatch);
        continue;
      }

      // DB側が "Apple Studio Display" で入力が "Studio Display" (brand=Apple) の場合
      // → brand + normalized_name で検索
      const { data: brandAndNameMatch } = await supabase
        .from(table)
        .select("id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags")
        .ilike("brand", item.brand)
        .ilike("normalized_name", `%${item.normalized}%`)
        .limit(1)
        .maybeSingle();

      if (brandAndNameMatch) {
        console.log(`[findExistingProducts] Brand+partial name match: "${item.original}" (brand: ${item.brand}) → "${brandAndNameMatch.name}"`);
        result.set(item.original, brandAndNameMatch as ExistingProductMatch);
      }
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

    const selectFields = "id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags";

    for (const [category, items] of byCategory) {
      // カテゴリ不明でもfuzzy matchを試行（全カテゴリから候補取得）
      const query = category === "__unknown__"
        ? supabase.from(table).select(selectFields).limit(200)
        : supabase.from(table).select(selectFields).eq("category", category).limit(200);

      const { data: candidates } = await query;

      if (!candidates || candidates.length === 0) continue;

      for (const item of items) {
        if (result.has(item.original)) continue; // 既にマッチ済みならスキップ

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

  // --- 除外ブランド（PREDUCTS, Grovemade, WAAK等）専用の検索 ---
  // まだマッチしていない除外ブランド商品を、ブランド名でDB検索してファジーマッチ
  if (productMeta) {
    const selectFields = "id, name, normalized_name, brand, category, asin, amazon_url, amazon_image_url, amazon_title, amazon_price, amazon_brand, product_source, tags";
    // ブランド名ごとにグループ化して1回のクエリにまとめる
    const excludedBrandGroups = new Map<string, typeof unmatchedNames>();

    for (const { original, normalized } of normalizedMap) {
      if (result.has(original)) continue; // 既にマッチ済み
      const meta = productMeta?.find(m => m.name === original);
      const excluded = isExcludedBrand(original) ||
        (meta?.brand ? isExcludedBrand(meta.brand) : null);
      if (!excluded) continue;

      if (!excludedBrandGroups.has(excluded.name)) {
        excludedBrandGroups.set(excluded.name, []);
      }
      excludedBrandGroups.get(excluded.name)!.push({
        original,
        normalized,
        category: meta?.category,
        brand: meta?.brand,
      });
    }

    for (const [brandName, items] of excludedBrandGroups) {
      const { data: brandProducts } = await supabase
        .from(table)
        .select(selectFields)
        .ilike("brand", brandName)
        .limit(100);

      if (!brandProducts || brandProducts.length === 0) continue;

      console.log(`[findExistingProducts] Excluded brand "${brandName}": ${brandProducts.length} products in DB, checking ${items.length} candidates`);

      for (const item of items) {
        const fuzzyResult = fuzzyMatchProduct(
          item.normalized,
          brandProducts,
          item.brand
        );

        if (fuzzyResult) {
          const matched = brandProducts[fuzzyResult.index];
          console.log(`[findExistingProducts] Excluded brand match: "${item.original}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
          result.set(item.original, matched as ExistingProductMatch);
        } else {
          // ファジーマッチ失敗時、URL一致で再試行（公式サイト商品用）
          // amazon_url に公式サイトURLが保存されているケースに対応
          for (const bp of brandProducts) {
            const bpMatch = bp as ExistingProductMatch;
            if (bpMatch.amazon_url) {
              // 商品名のキーワードがURLに含まれているかチェック
              const urlLower = bpMatch.amazon_url.toLowerCase();
              const nameWords = item.normalized.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
              const urlWordMatches = nameWords.filter(w => urlLower.includes(w));
              if (urlWordMatches.length >= Math.min(2, nameWords.length) && nameWords.length > 0) {
                console.log(`[findExistingProducts] Excluded brand URL match: "${item.original}" → "${bpMatch.name}" (url: ${bpMatch.amazon_url})`);
                result.set(item.original, bpMatch);
                break;
              }
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * DBに登録済みのユニークブランド名一覧を取得する
 * → Geminiプロンプトに既知ブランドリストとして渡し、初回抽出の精度を向上させる
 */
export async function getExistingBrandNames(
  table: "products_camera" | "products"
): Promise<string[]> {
  const { data } = await supabase
    .from(table)
    .select("brand")
    .not("brand", "is", null);

  const brands = [...new Set((data || []).map(d => d.brand as string).filter(Boolean))];
  // アルファベット・日本語混在をソート
  return brands.sort((a, b) => a.localeCompare(b, "ja"));
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
 * 1. 定数リスト（BRAND_TAGS / CAMERA_BRAND_TAGS）でマッチ（高速）
 * 2. brands マスターテーブルで name / aliases マッチ
 * 3. products テーブルで ilike 検索（fallback）
 * 4. エイリアス経由で products テーブル検索（fallback）
 * 5. いずれもマッチしなければ元の値をそのまま返す（新規ブランド）
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

  // 2. brands マスターテーブルで検索（name / aliases）
  const brandRow = await findBrandByName(trimmed);
  if (brandRow) return brandRow.name;

  // 3. products テーブルで ilike 検索（brands テーブル未登録ブランド用）
  const { data } = await supabase
    .from(table)
    .select("brand")
    .ilike("brand", trimmed)
    .limit(1);

  if (data && data.length > 0 && data[0].brand) {
    return data[0].brand;
  }

  // 4. エイリアス経由で products テーブル検索（例: "ソニー" → DB上の "Sony" を探す）
  const aliases = getBrandAliases(trimmed);
  for (const alias of aliases) {
    if (alias === trimmed.toLowerCase()) continue;
    const { data: aliasData } = await supabase
      .from(table)
      .select("brand")
      .ilike("brand", alias)
      .limit(1);

    if (aliasData && aliasData.length > 0 && aliasData[0].brand) {
      return aliasData[0].brand;
    }
  }

  // 5. 新規ブランド → そのまま返す
  return trimmed;
}
