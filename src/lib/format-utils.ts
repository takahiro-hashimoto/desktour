/**
 * 価格・日付フォーマット共通ユーティリティ
 */

import type { ProductWithStats } from "@/types";

/** 表示用の商品データ型 */
export interface DisplayProduct {
  id: string;
  asin?: string;
  slug?: string;
  name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  amazon_url?: string;
  rakuten_url?: string;
  price?: number;
  price_updated_at?: string;
  mention_count: number;
  user_comment?: string;
  rank?: number;
}

/** ProductWithStats → DisplayProduct に変換するユーティリティ */
export function formatProductForDisplay(product: ProductWithStats): DisplayProduct {
  return {
    id: product.id || "",
    asin: product.asin,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image_url: product.amazon_image_url,
    amazon_url: product.amazon_url,
    rakuten_url: product.rakuten_url,
    price: product.amazon_price,
    price_updated_at: product.updated_at,
    mention_count: product.mention_count,
    user_comment: product.comments?.[0]?.comment,
  };
}

/** 価格をカンマ区切りでフォーマット（¥プレフィックスなし） */
export function formatPrice(price?: number): string | null {
  if (!price) return null;
  return price.toLocaleString("ja-JP");
}

/** 価格を¥付きでフォーマット（価格なしの場合はフォールバックテキスト） */
export function formatPriceWithSymbol(price?: number, fallback = "価格情報なし"): string {
  if (!price) return fallback;
  return `¥${price.toLocaleString("ja-JP")}`;
}

/** 日付を「YYYY/MM/DD時点」形式にフォーマット */
export function formatPriceDate(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}時点`;
}

/** インチ → cm に変換 */
export function convertSize(sizeStr: string): string {
  return sizeStr.replace(/(\d+\.?\d*)インチ/g, (_, num) => {
    const cm = parseFloat(num) * 2.54;
    return `${cm.toFixed(1)}cm`;
  });
}

/** ポンド → kg/g に変換 */
export function convertWeight(weightStr: string): string {
  return weightStr.replace(/(\d+\.?\d*)ポンド/g, (_, num) => {
    const g = parseFloat(num) * 453.592;
    return g >= 1000 ? `${(g / 1000).toFixed(1)}kg` : `${Math.round(g)}g`;
  });
}

/** 日付文字列を「YYYY年M月D日」形式にフォーマット */
export function formatReleaseDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 共通FAQアイテム（カテゴリー詳細ページ共通） */
export const COMMON_FAQ_ITEMS = [
  {
    question: "このデータはどこから収集していますか？",
    answer: "YouTubeのデスクツアー動画およびブログ記事から、実際に使用されている商品情報を収集しています。",
  },
  {
    question: "「使用者数」とは何ですか？",
    answer: "その商品を使用しているデスクツアーの数を示しています。",
  },
  {
    question: "価格情報は正確ですか？",
    answer: "価格情報はAmazon Product Advertising APIから取得しており、実際の販売価格と異なる場合があります。購入の際はリンク先で最新の価格をご確認ください。",
  },
] as const;
