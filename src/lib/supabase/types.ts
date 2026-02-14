export interface Video {
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

export interface Article {
  id?: string;
  url: string;
  title: string;
  author: string | null;
  author_url: string | null;
  site_name: string | null;
  source_type: "note" | "blog" | "official" | "other";
  thumbnail_url: string | null;
  published_at: string | null;
  analyzed_at?: string;
  summary: string;
  tags?: string[];
}

export interface Product {
  id?: string;
  name: string;
  normalized_name?: string;
  brand?: string;
  category: string;
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

export interface ProductMention {
  id?: string;
  product_id: string;
  video_id?: string;
  article_id?: string;
  source_type: "video" | "article";
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface Influencer {
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

// 拡張Video型（商品数含む）
export type VideoWithProductCount = Video & { product_count?: number; occupation_tags?: string[] };

// 拡張Article型（商品数含む）
export type ArticleWithProductCount = Article & { product_count?: number };
