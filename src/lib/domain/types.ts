/**
 * ドメイン設定の型定義
 * 全ドメイン（desktour, camera, 将来追加するドメイン）の差異をここで吸収する
 */

export type DomainId = "desktour" | "camera";

/** 各ドメインのSupabaseテーブル名 */
export interface DomainTableNames {
  products: string;
  videos: string;
  articles: string;
  product_mentions: string;
  influencers: string;
}

/** ドメイン固有の定数・関数群 */
export interface DomainConstants {
  brandTags: readonly string[];
  productCategories: readonly string[];
  occupationTags: readonly string[];
  priceRangeOrder: readonly string[];
  categoryToSlug: (category: string) => string;
  slugToCategory: (slug: string) => string | undefined;
  occupationToSlug: (occupation: string) => string;
  brandToSlug: (brand: string) => string;
  productUrl: (product: { slug?: string; id: string }) => string;
  getCompatibleCategories: (category: string) => string[];
  selectPrimaryOccupation: (tags: string[]) => string | null;
}

/** ドメイン固有の検索フィルタ拡張 */
export interface DomainSearchExtensions {
  hasSubcategory: boolean;
  hasLensTags: boolean;
  hasBodyTags: boolean;
}

/** ドメイン設定の全体構造 */
export interface DomainConfig {
  id: DomainId;
  tables: DomainTableNames;
  constants: DomainConstants;
  search: DomainSearchExtensions;
  basePath: string;
}
