/**
 * アフィリエイトリンク生成ユーティリティ
 */

// Amazon検索URL生成（アフィリエイトタグ付き）
export function generateAmazonSearchUrl(query: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}&tag=takahiro1202-22`;
}

// 楽天検索URL生成（アフィリエイトID付き）
export function generateRakutenSearchUrl(query: string): string {
  return `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/?scid=af_101_0_0`;
}

// 商品情報からリンクを生成
export function getProductLinks(product: {
  amazon_url?: string;
  amazon_model_number?: string;
  name: string;
}): { amazonUrl: string; rakutenUrl: string } {
  // 検索クエリ: 型番があれば優先、なければ商品名
  const searchQuery = product.amazon_model_number || product.name;

  return {
    amazonUrl: product.amazon_url || generateAmazonSearchUrl(searchQuery),
    rakutenUrl: generateRakutenSearchUrl(searchQuery),
  };
}
