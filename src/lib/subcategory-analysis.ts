import type { ProductWithStats } from "@/types";

interface SubcategoryAnalysisInput {
  subcategory: string;
  products: ProductWithStats[];
  total: number;
}

/**
 * サブカテゴリの人気商品データからブランド分布・価格帯・特徴タグを分析し、
 * SEO向けの解説テキスト（1〜2文）を動的生成する。
 */
export function generateSubcategoryAnalysis({ products, total }: SubcategoryAnalysisInput): string {
  if (products.length === 0) return "";

  const parts: string[] = [];

  // --- ブランド分析 ---
  const brandCounts = new Map<string, number>();
  for (const p of products) {
    if (p.brand) {
      brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    }
  }

  if (brandCounts.size > 0) {
    const sorted = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topBrand = sorted[0];
    const productsWithBrand = products.filter(p => p.brand).length;

    if (productsWithBrand >= 2 && topBrand[1] >= 2 && topBrand[1] / productsWithBrand >= 0.5) {
      // 1ブランドが過半数を占める
      parts.push(`${topBrand[0]}製品が人気の中心で、上位${productsWithBrand}件中${topBrand[1]}件を占めています`);
    } else if (sorted.length >= 2) {
      // 複数ブランドが分散
      const brandNames = sorted.slice(0, 2).map(([name]) => name).join("や");
      parts.push(`${brandNames}など複数ブランドが上位に並んでいます`);
    }
  }

  // --- 価格帯分析 ---
  const prices = products.map(p => p.amazon_price).filter((p): p is number => p != null && p > 0);
  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min !== max) {
      parts.push(`価格帯は${formatPriceShort(min)}〜${formatPriceShort(max)}です`);
    }
  }

  // --- 特徴タグ分析（ブランド+価格で2文に満たない場合のみ）---
  if (parts.length < 2 && products.length >= 2) {
    const tagCounts = new Map<string, number>();
    for (const p of products) {
      for (const tag of p.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    // 60%以上の商品に共通するタグ
    const threshold = Math.ceil(products.length * 0.6);
    const majorityTags = [...tagCounts.entries()]
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1]);

    if (majorityTags.length > 0) {
      parts.push(`「${majorityTags[0][0]}」対応モデルが主流です`);
    }
  }

  if (parts.length === 0) return "";
  return parts.join("。") + "。";
}

/**
 * 価格を簡潔に表示（約N万円 or 約N,000円）
 */
function formatPriceShort(price: number): string {
  if (price >= 10000) {
    const man = Math.round(price / 10000);
    return `約${man}万円`;
  }
  const rounded = Math.round(price / 1000) * 1000;
  return `約${rounded.toLocaleString()}円`;
}
