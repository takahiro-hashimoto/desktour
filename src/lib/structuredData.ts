/**
 * 構造化データ生成ユーティリティ
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

/**
 * パンくずリストの構造化データ（BreadcrumbList schema）を生成
 */
export function generateBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      ...(item.url && { "item": `${BASE_URL}${item.url}` }),
    })),
  };
}

/**
 * 商品の構造化データ（Product schema）を生成
 */
export function generateProductStructuredData(product: {
  name: string;
  brand?: string | null;
  image_url?: string | null;
  description?: string;
  amazon_url?: string | null;
  price?: number | null;
  mention_count?: number;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    ...(product.brand && { "brand": { "@type": "Brand", "name": product.brand } }),
    ...(product.image_url && { "image": product.image_url }),
    ...(product.description && { "description": product.description }),
    ...(product.amazon_url && { "url": product.amazon_url }),
    ...(product.category && { "category": product.category }),
    ...(product.price && {
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "JPY",
        "availability": "https://schema.org/InStock",
      },
    }),
    ...(product.mention_count && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.5",
        "reviewCount": product.mention_count,
        "bestRating": "5",
        "worstRating": "1",
      },
    }),
  };
}

