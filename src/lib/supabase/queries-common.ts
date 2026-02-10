import { supabase } from "./client";
import { normalizeProductName } from "../product-normalize";
import { normalizeBrandByList, getBrandAliases } from "../brand-category-utils";

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
