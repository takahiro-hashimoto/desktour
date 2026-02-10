import type { ProductWithStats } from "@/types";

// カテゴリの優先順序（主要カテゴリから表示）
export const CAMERA_CATEGORY_PRIORITY = [
  "カメラ本体",
  "レンズ",
  "三脚",
  "ジンバル",
  "マイク・音声",
  "照明",
  "ストレージ",
  "カメラ装着アクセサリー",
  "収録・制御機器",
  "バッグ・収納",
  "ドローンカメラ",
] as const;

// カテゴリ名の英語表記マッピング
const CAMERA_CATEGORY_ENGLISH_MAP: Record<string, string> = {
  "カメラ本体": "CAMERAS",
  "レンズ": "LENSES",
  "三脚": "TRIPODS",
  "ジンバル": "GIMBALS",
  "マイク・音声": "MICROPHONES & AUDIO",
  "照明": "LIGHTING",
  "ストレージ": "STORAGE",
  "カメラ装着アクセサリー": "CAMERA ACCESSORIES",
  "収録・制御機器": "RECORDING & CONTROL",
  "バッグ・収納": "BAGS & CASES",
  "ドローンカメラ": "DRONE CAMERAS",
};

// カテゴリ名の英語表記を取得
export function getCameraCategoryEnglish(category: string): string {
  return CAMERA_CATEGORY_ENGLISH_MAP[category] || category.toUpperCase();
}

// 商品をカテゴリ別にグループ化
export function groupByCameraCategory(products: ProductWithStats[]): Record<string, ProductWithStats[]> {
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

// CAMERA_CATEGORY_PRIORITYに従ってカテゴリをソート
export function sortCameraCategories(productsByCategory: Record<string, ProductWithStats[]>): string[] {
  return [
    ...CAMERA_CATEGORY_PRIORITY.filter((cat) => productsByCategory[cat]),
    ...Object.keys(productsByCategory).filter(
      (cat) => !CAMERA_CATEGORY_PRIORITY.includes(cat as typeof CAMERA_CATEGORY_PRIORITY[number])
    ),
  ];
}
