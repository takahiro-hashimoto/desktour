/**
 * 代替品・類似商品のスコアリングロジック
 * 同カテゴリ内の商品同士のタグ・スペック一致度を算出する
 */

// 価格帯の順序（隣接判定に使用）
export const DESKTOUR_PRICE_RANGE_ORDER = [
  "under_5000",
  "5000_10000",
  "10000_30000",
  "30000_50000",
  "over_50000",
] as const;

export const CAMERA_PRICE_RANGE_ORDER = [
  "under_5000",
  "5000_10000",
  "10000_30000",
  "30000_50000",
  "50000_100000",
  "100000_300000",
  "over_300000",
] as const;

export interface ScoringInput {
  tags?: string[];
  brand?: string;
  price_range?: string;
  mention_count: number;
  // Camera固有
  subcategory?: string;
  lens_tags?: string[];
  body_tags?: string[];
}

export interface ScoringResult {
  score: number;
  matchedTagCount: number;
}

/**
 * 2つの商品間の類似度スコアを算出
 *
 * スコアリング基準:
 * - タグ一致: +3/個
 * - レンズタグ一致 (camera): +2/個
 * - ボディタグ一致 (camera): +2/個
 * - サブカテゴリ一致 (camera): +3
 * - 価格帯: 同一 +2, 隣接 +1
 * - 同ブランド: -1 (代替品として他ブランドを優先)
 * - 人気度: mention_count >= 3 で +1
 */
export function calculateSimilarityScore(
  source: ScoringInput,
  candidate: ScoringInput,
  priceRangeOrder: readonly string[],
): ScoringResult {
  let score = 0;
  let matchedTagCount = 0;

  // --- タグ一致 (tags[]) ---
  const sourceTags = new Set(source.tags || []);
  for (const tag of candidate.tags || []) {
    if (sourceTags.has(tag)) {
      score += 3;
      matchedTagCount++;
    }
  }

  // --- Camera: サブカテゴリ一致 ---
  if (
    source.subcategory &&
    candidate.subcategory &&
    source.subcategory === candidate.subcategory
  ) {
    score += 3;
  }

  // --- Camera: レンズタグ一致 ---
  if (source.lens_tags && candidate.lens_tags) {
    const sourceLens = new Set(source.lens_tags);
    for (const tag of candidate.lens_tags) {
      if (sourceLens.has(tag)) {
        score += 2;
        matchedTagCount++;
      }
    }
  }

  // --- Camera: ボディタグ一致 ---
  if (source.body_tags && candidate.body_tags) {
    const sourceBody = new Set(source.body_tags);
    for (const tag of candidate.body_tags) {
      if (sourceBody.has(tag)) {
        score += 2;
        matchedTagCount++;
      }
    }
  }

  // --- 価格帯の近さ ---
  if (source.price_range && candidate.price_range) {
    const srcIdx = priceRangeOrder.indexOf(source.price_range);
    const candIdx = priceRangeOrder.indexOf(candidate.price_range);
    if (srcIdx >= 0 && candIdx >= 0) {
      const diff = Math.abs(srcIdx - candIdx);
      if (diff === 0) score += 2;
      else if (diff === 1) score += 1;
    }
  }

  // --- 同ブランドペナルティ（代替品として他ブランドを優先） ---
  if (
    source.brand &&
    candidate.brand &&
    source.brand.toLowerCase() === candidate.brand.toLowerCase()
  ) {
    score -= 1;
  }

  // --- 人気度ボーナス ---
  if (candidate.mention_count >= 3) {
    score += 1;
  }

  return { score, matchedTagCount };
}
