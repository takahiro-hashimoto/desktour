import { searchAmazonProduct } from "@/lib/product-search";
import { findBestMatch } from "@/lib/description-links";
import { extractProductTags } from "@/lib/tag-inference";
import type { ProductInfo } from "@/lib/product-search";

// マッチ済み商品の型定義（analyze / analyze-article 共通）
export interface MatchedProduct {
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  lensTags?: string[];
  bodyTags?: string[];
  tags?: string[];
  reason: string;
  confidence: "high" | "medium" | "low";
  amazon?: {
    asin: string;
    title: string;
    url: string;
    imageUrl: string;
    price?: number;
  } | null;
  source?: "amazon" | "rakuten";
  matchScore?: number;
  matchReason?: string;
  isExisting?: boolean;
}

// 候補リスト（ASIN → ProductInfo）
export interface MatchCandidate {
  asin: string;
  title: string;
  product: ProductInfo;
}

// 候補リストを asinProductMap から作成
export function buildCandidates(
  asinProductMap: Map<string, ProductInfo | null>
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  for (const [asin, asinProduct] of asinProductMap.entries()) {
    if (asinProduct) {
      candidates.push({ asin, title: asinProduct.title, product: asinProduct });
    }
  }
  return candidates;
}

// 商品とAmazon/楽天情報のマッチング（共通ロジック）
export async function matchProductWithAmazon(opts: {
  productName: string;
  productBrand?: string;
  productCategory: string;
  candidates: MatchCandidate[];
  usedAsins: Set<string>;
  skipApiSearch?: boolean;
  apiSearchDelay?: number;
}): Promise<{
  amazonInfo: ProductInfo | null;
  matchScore: number;
  matchReason: string;
  productTags: string[] | undefined;
}> {
  const {
    productName,
    productBrand,
    productCategory,
    candidates,
    usedAsins,
    skipApiSearch = false,
    apiSearchDelay = 0,
  } = opts;

  let amazonInfo: ProductInfo | null = null;
  let matchScore = 0;
  let matchReason = "";

  // 候補リストからベストマッチを探す（未使用のもののみ）
  const availableCandidates = candidates.filter((c) => !usedAsins.has(c.asin));

  if (availableCandidates.length > 0) {
    const bestMatch = findBestMatch(productName, productBrand, availableCandidates);

    if (bestMatch) {
      amazonInfo = bestMatch.product as ProductInfo;
      matchScore = bestMatch.score;
      matchReason = bestMatch.reason;
      usedAsins.add(bestMatch.asin);
    }
  }

  // 候補でマッチしなかった場合のみAPI検索（結果もスコア検証する）
  if (!amazonInfo && !skipApiSearch) {
    const searchResult = await searchAmazonProduct(
      productName,
      productBrand || undefined,
      productCategory
    );
    if (searchResult) {
      // API検索結果もスコアで検証（誤マッチ防止）
      const { calculateMatchScore } = await import("@/lib/description-links");
      const { score: apiScore, reason: apiReason } = calculateMatchScore(
        productName,
        productBrand,
        searchResult.title
      );
      // API検索は閾値を緩めに（40点）— 誤マッチ防止のため30→40に引き上げ
      if (apiScore >= 40) {
        amazonInfo = searchResult;
        matchScore = apiScore;
        matchReason = `API Search (${apiReason})`;
      } else {
        console.log(`  ✗ API Search rejected: "${searchResult.title.substring(0, 50)}" score=${apiScore} (${apiReason})`);
        matchReason = `API Search rejected: score ${apiScore}`;
      }
    }
    if (apiSearchDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, apiSearchDelay));
    }
  }

  // タグ抽出（種類タグ + 特徴タグ を統合）
  let productTags: string[] | undefined;
  if (amazonInfo) {
    productTags = extractProductTags({
      category: productCategory,
      title: amazonInfo.title,
      features: amazonInfo.features,
      technicalInfo: amazonInfo.technicalInfo,
      amazonCategories: amazonInfo.amazonCategories,
      brand: amazonInfo.brand,
    });
    if (productTags.length === 0) {
      productTags = undefined;
    }
  }

  return { amazonInfo, matchScore, matchReason, productTags };
}

// amazonInfo → MatchedProduct.amazon の変換
export function toAmazonField(
  amazonInfo: ProductInfo | null
): MatchedProduct["amazon"] {
  if (!amazonInfo) return null;
  return {
    asin: amazonInfo.id,
    title: amazonInfo.title,
    url: amazonInfo.url,
    imageUrl: amazonInfo.imageUrl,
    price: amazonInfo.price,
  };
}

// URLからauthor_idを生成（note.comの場合はユーザーID、それ以外はドメイン+著者名）
export function generateAuthorId(url: string, author: string | null): string {
  try {
    const urlObj = new URL(url);

    // note.comの場合
    if (
      urlObj.hostname.includes("note.com") ||
      urlObj.hostname.includes("note.mu")
    ) {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0 && pathParts[0] !== "n") {
        return `note:${pathParts[0]}`;
      }
    }

    // その他の場合
    if (author) {
      return `${urlObj.hostname}:${author.replace(/\s+/g, "_").toLowerCase()}`;
    }

    return `${urlObj.hostname}:unknown`;
  } catch {
    return `unknown:${Date.now()}`;
  }
}
