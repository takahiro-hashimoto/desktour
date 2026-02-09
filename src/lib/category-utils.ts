import type { ProductWithStats } from "@/types";

// カテゴリの優先順序（主要カテゴリから表示）
export const CATEGORY_PRIORITY = [
  "キーボード",
  "マウス",
  "ディスプレイ/モニター",
  "デスク",
  "チェア",
  "マイク/オーディオ",
  "ヘッドホン/イヤホン",
  "Webカメラ",
  "スピーカー",
  "照明",
  "PCスタンド/アーム",
  "ケーブル/ハブ",
  "デスクアクセサリー",
  "その他",
] as const;

// カテゴリ名の英語表記マッピング
const CATEGORY_ENGLISH_MAP: Record<string, string> = {
  "キーボード": "KEYBOARDS",
  "マウス": "MICE",
  "ディスプレイ/モニター": "MONITORS",
  "デスク": "DESKS",
  "チェア": "CHAIRS",
  "マイク/オーディオ": "AUDIO",
  "照明": "LIGHTING",
  "PCスタンド/アーム": "STANDS",
  "ケーブル/ハブ": "CABLES",
  "デスクアクセサリー": "ACCESSORIES",
  "ヘッドホン/イヤホン": "HEADPHONES",
  "Webカメラ": "WEBCAMS",
  "スピーカー": "SPEAKERS",
  "その他": "OTHERS",
};

// カテゴリ名の英語表記を取得
export function getCategoryEnglish(category: string): string {
  return CATEGORY_ENGLISH_MAP[category] || category.toUpperCase();
}

// 商品をカテゴリ別にグループ化
export function groupByCategory(products: ProductWithStats[]): Record<string, ProductWithStats[]> {
  const grouped: Record<string, ProductWithStats[]> = {};

  for (const product of products) {
    const category = product.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(product);
  }

  return grouped;
}

// CATEGORY_PRIORITYに従ってカテゴリをソート（存在するカテゴリのみ + 定義外は末尾）
export function sortCategories(productsByCategory: Record<string, ProductWithStats[]>): string[] {
  return [
    ...CATEGORY_PRIORITY.filter((cat) => productsByCategory[cat]),
    ...Object.keys(productsByCategory).filter(
      (cat) => !CATEGORY_PRIORITY.includes(cat as typeof CATEGORY_PRIORITY[number])
    ),
  ];
}
