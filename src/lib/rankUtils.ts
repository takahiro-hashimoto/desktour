/**
 * 商品に順位を付与するユーティリティ関数
 * 登場回数が同じ場合は同順位として扱う
 */

interface ProductWithMentionCount {
  mention_count: number;
  [key: string]: any;
}

export function assignRanks<T extends ProductWithMentionCount>(
  products: T[],
  options: {
    page?: number;
    limit?: number;
    onlyIfSorted?: boolean; // mention_countでソートされている場合のみ順位を付与
  } = {}
): (T & { rank?: number })[] {
  const { page = 1, limit = 20, onlyIfSorted = false } = options;

  // ソートチェック: mention_countで降順ソートされているか確認
  if (onlyIfSorted && products.length > 1) {
    const isSorted = products.every((product, index) => {
      if (index === 0) return true;
      return products[index - 1].mention_count >= product.mention_count;
    });
    if (!isSorted) {
      return products.map(p => ({ ...p, rank: undefined }));
    }
  }

  let currentRank = (page - 1) * limit + 1;
  let previousMentionCount: number | null = null;
  let sameCountStartRank = currentRank;

  return products.map((product, index) => {
    if (previousMentionCount === null || product.mention_count < previousMentionCount) {
      // 新しいmention_count値に遷移した場合、順位を更新
      currentRank = (page - 1) * limit + index + 1;
      sameCountStartRank = currentRank;
    }
    // 同じmention_countの場合は同じ順位を使用

    previousMentionCount = product.mention_count;

    return {
      ...product,
      rank: sameCountStartRank,
    };
  });
}

/**
 * カテゴリ内の順位を計算
 * DBから全商品を取得してその中での順位を計算する必要がある場合に使用
 */
export function calculateCategoryRank(
  targetMentionCount: number,
  allProducts: ProductWithMentionCount[]
): number {
  // mention_countで降順ソート
  const sorted = [...allProducts].sort((a, b) => b.mention_count - a.mention_count);

  let rank = 1;
  let previousCount: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const product = sorted[i];

    if (previousCount !== null && product.mention_count < previousCount) {
      rank = i + 1;
    }

    if (product.mention_count === targetMentionCount) {
      return rank;
    }

    previousCount = product.mention_count;
  }

  return rank;
}
