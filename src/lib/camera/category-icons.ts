/**
 * 撮影機材DB - カテゴリ別 Font Awesome アイコンマッピング
 */

const CAMERA_CATEGORY_ICON_MAP: Record<string, string> = {
  "カメラ": "fa-camera",
  "レンズ": "fa-circle-dot",
  "三脚": "fa-maximize",
  "ジンバル": "fa-rotate",
  "マイク・音声": "fa-microphone",
  "照明": "fa-lightbulb",
  "ストレージ": "fa-sd-card",
  "カメラ装着アクセサリー": "fa-screwdriver-wrench",
  "収録・制御機器": "fa-tv",
  "バッグ・収納": "fa-bag-shopping",
  "ドローンカメラ": "fa-helicopter",
};

export function getCameraCategoryIcon(category: string): string {
  return CAMERA_CATEGORY_ICON_MAP[category] || "fa-cube";
}
