/**
 * brands マスターテーブル専用クエリモジュール
 *
 * brands テーブルは desktour / camera 共通。
 * ブランド名(name) と URL用スラッグ(slug) を分離管理する。
 */
import { supabase } from "./client";
import type { DomainId } from "@/lib/domain";

// ========================================
// 型定義
// ========================================

export interface Brand {
  id: string;
  name: string;
  slug: string;
  name_aliases: string[];
  domains: string[];
  icon: string | null;
  description_desktour: string | null;
  description_camera: string | null;
  is_featured: boolean;
  display_order: number;
}

// ========================================
// クエリ関数
// ========================================

/**
 * ドメイン別ブランド一覧を取得
 * @param domain - "desktour" | "camera"
 * @param opts.featuredOnly - true の場合、is_featured=true のみ
 */
export async function getBrands(
  domain: DomainId,
  opts?: { featuredOnly?: boolean },
): Promise<Brand[]> {
  let query = supabase
    .from("brands")
    .select("*")
    .contains("domains", [domain]);

  if (opts?.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data } = await query.order("display_order", { ascending: true });
  return (data || []) as Brand[];
}

/**
 * slug でブランドを1件取得（ブランドページの入口）
 */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return (data as Brand) || null;
}

/**
 * ブランド名またはエイリアスで検索（正規化用）
 * 1. name 完全一致（大文字小文字無視）
 * 2. name_aliases 配列に含まれるか
 * 3. 括弧除去して再検索
 */
export async function findBrandByName(brandName: string): Promise<Brand | null> {
  if (!brandName) return null;

  // 1. name 完全一致（case-insensitive）
  const { data: exactMatch } = await supabase
    .from("brands")
    .select("*")
    .ilike("name", brandName)
    .limit(1)
    .maybeSingle();

  if (exactMatch) return exactMatch as Brand;

  // 2. name_aliases に含まれるか
  const lower = brandName.toLowerCase();
  const { data: aliasMatch } = await supabase
    .from("brands")
    .select("*")
    .contains("name_aliases", [lower])
    .limit(1)
    .maybeSingle();

  if (aliasMatch) return aliasMatch as Brand;

  // 3. 括弧付きサフィックスを除去して再検索
  const withoutBrackets = brandName.replace(/[（(][^）)]*[）)]/g, "").trim();
  if (withoutBrackets !== brandName && withoutBrackets.length > 0) {
    const { data: bracketMatch } = await supabase
      .from("brands")
      .select("*")
      .ilike("name", withoutBrackets)
      .limit(1)
      .maybeSingle();

    if (bracketMatch) return bracketMatch as Brand;
  }

  return null;
}

/**
 * name / aliases → slug のマップを取得
 * ページ内で複数ブランドの slug 変換が必要な場合にまとめて取得する
 */
export async function getBrandSlugMap(): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("brands")
    .select("name, slug, name_aliases");

  const map = new Map<string, string>();
  for (const row of (data || []) as { name: string; slug: string; name_aliases: string[] }[]) {
    map.set(row.name.toLowerCase(), row.slug);
    for (const alias of row.name_aliases || []) {
      map.set(alias.toLowerCase(), row.slug);
    }
  }
  return map;
}
