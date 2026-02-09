/**
 * Amazon商品特徴(features)の品質を判定する
 * 低品質な特徴はGemini要約をスキップし、表示も抑制する
 */

// 商品の特徴として無価値なフレーズ（部分一致）
const LOW_VALUE_PHRASES = [
  "保証対象外",
  "返品不可",
  "返品について",
  "返金について",
  "キャンセルについて",
  "お届けについて",
  "配送について",
  "ご注意ください",
  "ご了承ください",
  "予めご了承",
  "あらかじめご了承",
  "お問い合わせ",
  "カスタマーサービス",
  "サポートセンター",
  "正規品",
  "並行輸入品",
  "海外輸入品",
  "この商品について",
];

/**
 * 1つの特徴が無価値かどうかを判定
 */
function isLowValueFeature(feature: string): boolean {
  const trimmed = feature.trim();
  // 空文字
  if (trimmed.length === 0) return true;
  // 短すぎる（実質情報なし）
  if (trimmed.length <= 5) return true;
  // 無価値フレーズに該当
  return LOW_VALUE_PHRASES.some((phrase) => trimmed.includes(phrase));
}

/**
 * features配列が低品質かどうかを判定する
 *
 * 低品質と判定される条件:
 * - features が空 or 1個のみ
 * - ユニークな特徴が2個以下（同じ文言の繰り返し）
 * - 有価値な特徴が1個以下
 * - 全ての特徴が短すぎる（平均15文字以下）
 */
export function isLowQualityFeatures(features: string[]): boolean {
  // 空 or 1個のみ
  if (!features || features.length <= 1) return true;

  // ユニークな特徴数をチェック（同じ文言の繰り返し対策）
  const uniqueFeatures = new Set(features.map((f) => f.trim()));
  if (uniqueFeatures.size <= 1) return true;

  // 有価値な特徴をフィルタ
  const valuableFeatures = features.filter((f) => !isLowValueFeature(f));
  if (valuableFeatures.length <= 1) return true;

  // 有価値な特徴の平均文字数が短すぎる
  const avgLength =
    valuableFeatures.reduce((sum, f) => sum + f.trim().length, 0) /
    valuableFeatures.length;
  if (avgLength <= 15) return true;

  return false;
}
