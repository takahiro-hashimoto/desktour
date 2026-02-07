// 商品検索結果（一覧ページ用）
export interface ProductWithStats {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string; // サブカテゴリ（メカニカルキーボード、4Kモニター等）
  price_range?: string;
  amazon_url?: string;
  amazon_image_url?: string;
  amazon_price?: number;
  amazon_title?: string;
  mention_count: number;
  comments: ProductComment[];
}

export interface ProductComment {
  reason: string;
  source_type: "video" | "article";
  source_id?: string; // video_id or article_id
  source_title: string;
  occupation_tags?: string[];
  // サムネイル情報
  thumbnail_url?: string;
  channel_title?: string; // 動画の場合
  author?: string; // 記事の場合
}

// ソース詳細（モーダル用）
export interface SourceDetail {
  id: string;
  type: "video" | "article";
  title: string;
  thumbnail_url?: string;
  channel_title?: string; // 動画の場合
  author?: string; // 記事の場合
  published_at?: string;
  summary?: string;
  url?: string; // 記事の場合
  video_id?: string; // 動画の場合（YouTube埋め込み用）
  products: SourceProduct[];
  tags?: string[]; // デスクセットアップタグ（スタイル/用途/環境）
  occupation_tags?: string[]; // 職業タグ
}

export interface SourceProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  amazon_image_url?: string;
  amazon_url?: string;
  amazon_model_number?: string;
  reason: string;
  mention_count?: number;
}

// 商品詳細（詳細ページ用）
export interface ProductDetail {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string; // サブカテゴリ（メカニカルキーボード、4Kモニター等）
  price_range?: string;
  amazon_url?: string;
  amazon_image_url?: string;
  amazon_price?: number;
  amazon_title?: string;
  // Amazon詳細情報
  amazon_manufacturer?: string;
  amazon_brand?: string;
  amazon_model_number?: string;
  amazon_color?: string;
  amazon_size?: string;
  amazon_weight?: string;
  amazon_release_date?: string;
  amazon_features?: string[];
  amazon_technical_info?: Record<string, string>;
  // カテゴリ情報（Amazon）
  amazon_categories?: string[];  // カテゴリ階層（例: ["パソコン・周辺機器 > キーボード > メカニカルキーボード"]）
  amazon_product_group?: string; // 商品グループ（例: "Personal Computer"）
  // 楽天情報
  product_source?: "amazon" | "rakuten";
  rakuten_shop_name?: string;
  asin?: string;
  // 統計情報
  mention_count: number;
  category_rank?: number; // カテゴリ内順位
  total_in_category?: number; // カテゴリ内商品総数
  occupation_breakdown: OccupationStat[];
  co_used_products: CoUsedProduct[];
  all_comments: ProductComment[];
  desk_setup_stats: DeskSetupStat[];
  // 更新日時
  updated_at?: string;
}

export interface OccupationStat {
  occupation_tag: string;
  count: number;
}

export interface CoUsedProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  amazon_image_url?: string;
  co_occurrence_count: number;
}

export interface DeskSetupStat {
  setup_tag: string;
  count: number;
}

// 一覧ページのパラメータ
export interface ListParams {
  type: "occupation" | "category" | "setup" | "co-used" | "all";
  value?: string;
  category?: string;
  productId?: string; // co-used用
}

// 検索パラメータ
export interface SearchParams {
  occupationTag?: string;
  category?: string;
  subcategory?: string;
  setupTag?: string;
  brand?: string;
  priceRange?: string;
  sortBy?: "mention_count" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}

// サイト統計（トップページ用）
export interface SiteStats {
  total_products: number;
  total_mentions: number;
  total_videos: number;
  total_articles: number;
  total_influencers: number;
}

// 価格帯
export const PRICE_RANGES = [
  { value: "under_5000", label: "5,000円未満" },
  { value: "5000_10000", label: "5,000〜10,000円" },
  { value: "10000_30000", label: "10,000〜30,000円" },
  { value: "30000_50000", label: "30,000〜50,000円" },
  { value: "over_50000", label: "50,000円以上" },
] as const;

export function getPriceRangeLabel(value?: string): string {
  if (!value) return "価格不明";
  const range = PRICE_RANGES.find((r) => r.value === value);
  return range?.label || "価格不明";
}
