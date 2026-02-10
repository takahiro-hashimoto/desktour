// 撮影機材DB用 Supabase型定義
// テーブル名は *_camera だが、TypeScript型は同じ構造を共有

export interface CameraVideo {
  id?: string;
  video_id: string;
  title: string;
  channel_title: string;
  channel_id: string;
  subscriber_count: number;
  thumbnail_url: string;
  published_at: string;
  analyzed_at?: string;
  summary: string;
  tags?: string[];
}

export interface CameraArticle {
  id?: string;
  url: string;
  title: string;
  author: string | null;
  author_url: string | null;
  site_name: string | null;
  source_type: "note" | "blog" | "other";
  thumbnail_url: string | null;
  published_at: string | null;
  analyzed_at?: string;
  summary: string;
  tags?: string[];
}

export interface CameraProduct {
  id?: string;
  name: string;
  normalized_name?: string;
  brand?: string;
  category: string;
  subcategory?: string;
  lens_tags?: string[];
  body_tags?: string[];
  tags?: string[];
  reason: string;
  confidence: "high" | "medium" | "low";
  video_id?: string;
  article_id?: string;
  source_type: "video" | "article";
  price_range?: string;
  product_source?: "amazon" | "rakuten";
  asin?: string;
  amazon_url?: string;
  amazon_image_url?: string;
  amazon_price?: number;
  amazon_title?: string;
  amazon_manufacturer?: string;
  amazon_brand?: string;
  amazon_model_number?: string;
  amazon_color?: string;
  amazon_size?: string;
  amazon_weight?: string;
  amazon_release_date?: string;
  amazon_features?: string[];
  amazon_features_raw?: string[];
  amazon_technical_info?: Record<string, string>;
  amazon_categories?: string[];
  amazon_product_group?: string;
  rakuten_shop_name?: string;
}

export interface CameraProductMention {
  id?: string;
  product_id: string;
  video_id?: string;
  article_id?: string;
  source_type: "video" | "article";
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface CameraInfluencer {
  id?: string;
  channel_id?: string;
  author_id?: string;
  channel_title?: string;
  author_name?: string;
  subscriber_count?: number;
  thumbnail_url?: string;
  video_count?: number;
  article_count?: number;
  source_type: "youtube" | "article";
  occupation?: string;
  occupation_tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// 拡張型（商品数含む）
export type CameraVideoWithProductCount = CameraVideo & { product_count?: number; occupation_tags?: string[] };
export type CameraArticleWithProductCount = CameraArticle & { product_count?: number };
