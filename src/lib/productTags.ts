/**
 * Amazon商品情報から商品タグを自動抽出する
 * 種類タグ（旧サブカテゴリ）と特徴タグを統合して返す
 */

import { inferSubcategory } from "./subcategoryInference";

export interface ProductTagsResult {
  tags: string[];
}

interface ProductInfo {
  category: string;
  title?: string;
  features?: string[];
  technicalInfo?: Record<string, string>;
  amazonCategories?: string[];
  brand?: string;
}

/**
 * 商品情報からタグを自動抽出（種類タグ + 特徴タグ）
 */
export function extractProductTags(data: ProductInfo): string[] {
  const { category, title = "", features = [], technicalInfo = {} } = data;

  const titleLower = title.toLowerCase();
  const featuresText = features.join(" ").toLowerCase();
  const allText = (titleLower + " " + featuresText).toLowerCase();

  const tags: Set<string> = new Set();

  // 種類タグを検出・追加
  const typeTag = inferSubcategory({
    category,
    title,
    features,
    technicalInfo,
  });
  if (typeTag) {
    tags.add(typeTag);
  }

  // 接続方式タグ（特徴的なもののみ）
  if (allText.includes("wireless") || allText.includes("ワイヤレス") || allText.includes("bluetooth")) {
    tags.add("ワイヤレス");
  }
  if (allText.includes("bluetooth") && allText.includes("2.4ghz")) {
    tags.add("Bluetooth/2.4GHz両対応");
  } else if (allText.includes("2.4ghz")) {
    tags.add("2.4GHz");
  }

  // 用途タグ（具体的なもののみ）
  if (allText.includes("gaming") || allText.includes("ゲーミング") || allText.includes("ゲーム")) {
    tags.add("ゲーミング");
  }
  if (allText.includes("streaming") || allText.includes("配信") || allText.includes("ストリーミング")) {
    tags.add("配信向け");
  }
  if (allText.includes("dtm") || allText.includes("音楽制作") || allText.includes("music production")) {
    tags.add("音楽制作");
  }

  // 特徴タグ（差別化要素のあるもののみ）
  if (allText.includes("静音") || allText.includes("silent") || allText.includes("quiet")) {
    tags.add("静音");
  }
  if (allText.includes("rgb") || allText.includes("ライティング")) {
    tags.add("RGB");
  }
  if (allText.includes("ノイズキャンセリング") || allText.includes("noise cancelling") || allText.includes("anc")) {
    tags.add("ノイズキャンセリング");
  }
  if (allText.includes("折りたたみ") || allText.includes("foldable") || allText.includes("折り畳み")) {
    tags.add("折りたたみ");
  }

  // カテゴリー別の特殊タグ
  if (category === "キーボード") {
    if (allText.includes("hot swap") || allText.includes("ホットスワップ")) {
      tags.add("ホットスワップ");
    }
    if (allText.includes("日本語配列") || allText.includes("jis")) {
      tags.add("日本語配列");
    }
    if (allText.includes("英語配列") || allText.includes("us layout") || allText.includes("ansi")) {
      tags.add("英語配列");
    }
    if (allText.includes("mac") && allText.includes("配列")) {
      tags.add("Mac配列");
    }
  }

  if (category === "マウス") {
    if (allText.includes("多ボタン") || allText.includes("multi button") || allText.includes("programmable")) {
      tags.add("多ボタン");
    }
    if (technicalInfo["重量"] && parseFloat(technicalInfo["重量"]) < 80) {
      tags.add("超軽量");
    }
  }

  if (category === "ディスプレイ・モニター") {
    if (allText.includes("ips") || allText.includes("ipsパネル")) {
      tags.add("IPS");
    }
    if (allText.includes("va") || allText.includes("vaパネル")) {
      tags.add("VA");
    }
    if (allText.includes("湾曲") || allText.includes("curved") || allText.includes("曲面")) {
      tags.add("湾曲");
    }
    if (allText.includes("hdr")) {
      tags.add("HDR");
    }
    if (allText.includes("usb-c") || allText.includes("type-c")) {
      tags.add("USB-C");
    }
  }

  if (category === "チェア") {
    if (allText.includes("リクライニング")) {
      tags.add("リクライニング");
    }
    if (allText.includes("ハイバック")) {
      tags.add("ハイバック");
    }
    if (allText.includes("アームレスト") || allText.includes("肘掛け")) {
      tags.add("アームレスト付き");
    }
  }

  if (category === "デスク") {
    if (allText.includes("電動") || allText.includes("electric")) {
      tags.add("電動");
    }
    if (allText.includes("手動")) {
      tags.add("手動");
    }
    if (allText.includes("天板のみ") || allText.includes("天板単品")) {
      tags.add("天板のみ");
    }
    if (allText.includes("脚のみ") || allText.includes("脚単品") || allText.includes("フレームのみ")) {
      tags.add("脚のみ");
    }
    // 天板の色・素材タグ
    if (allText.includes("木目") || allText.includes("ウッド") || allText.includes("wood") || allText.includes("木製")) {
      tags.add("木目天板");
    }
    if (allText.includes("黒天板") || (allText.includes("黒") && allText.includes("天板"))) {
      tags.add("黒天板");
    }
    if (allText.includes("白天板") || (allText.includes("白") && allText.includes("天板"))) {
      tags.add("白天板");
    }
    // サイズタグ
    if (allText.includes("120cm") || allText.includes("120 cm") || allText.includes("幅120")) {
      tags.add("120cm");
    }
    if (allText.includes("140cm") || allText.includes("140 cm") || allText.includes("幅140")) {
      tags.add("140cm");
    }
    if (allText.includes("160cm") || allText.includes("160 cm") || allText.includes("幅160")) {
      tags.add("160cm");
    }
    if (allText.includes("180cm") || allText.includes("180 cm") || allText.includes("幅180")) {
      tags.add("180cm");
    }
  }

  // サイズタグ
  if (category === "ディスプレイ・モニター") {
    const sizeMatch = title.match(/(\d+)インチ|(\d+)"/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1] || sizeMatch[2]);
      if (size <= 24) tags.add("24インチ以下");
      else if (size <= 27) tags.add("27インチ");
      else if (size <= 32) tags.add("32インチ");
      else tags.add("34インチ以上");
    }
  }

  // Amazonカテゴリ階層からの補強タグ検出
  if (data.amazonCategories && data.amazonCategories.length > 0) {
    const categoryText = data.amazonCategories.join(" ").toLowerCase();

    // カテゴリ階層から用途・特徴タグを補強
    if (categoryText.includes("gaming") || categoryText.includes("ゲーミング")) {
      tags.add("ゲーミング");
    }
    if (categoryText.includes("wireless") || categoryText.includes("ワイヤレス")) {
      tags.add("ワイヤレス");
    }
    if (categoryText.includes("bluetooth")) {
      tags.add("ワイヤレス");
    }
    if (categoryText.includes("usb") && categoryText.includes("type-c")) {
      if (category === "ディスプレイ・モニター") {
        tags.add("USB-C");
      }
    }

    // サブカテゴリが未検出の場合、amazonCategoriesからフォールバック推定
    if (!typeTag) {
      const fallbackType = inferSubcategoryFromAmazonCategories(category, categoryText);
      if (fallbackType) {
        tags.add(fallbackType);
      }
    }
  }

  return Array.from(tags);
}

/**
 * Amazonカテゴリ階層からサブカテゴリを推定（inferSubcategoryのフォールバック）
 */
function inferSubcategoryFromAmazonCategories(category: string, categoryText: string): string | null {
  // カテゴリ別のAmazonカテゴリ→サブカテゴリのマッピング
  const amazonCategoryRules: Record<string, Array<{ result: string; keywords: string[] }>> = {
    "キーボード": [
      { result: "メカニカルキーボード", keywords: ["メカニカル", "mechanical"] },
      { result: "テンキーレス", keywords: ["テンキーレス", "tenkeyless"] },
    ],
    "マウス": [
      { result: "トラックボール", keywords: ["トラックボール", "trackball"] },
      { result: "ゲーミングマウス", keywords: ["ゲーミングマウス", "gaming mouse"] },
      { result: "エルゴノミクスマウス", keywords: ["エルゴノミクス", "ergonomic"] },
    ],
    "ディスプレイ・モニター": [
      { result: "4Kモニター", keywords: ["4k"] },
      { result: "ウルトラワイドモニター", keywords: ["ウルトラワイド", "ultrawide"] },
      { result: "ゲーミングモニター", keywords: ["ゲーミングモニター", "gaming monitor"] },
    ],
    "ヘッドホン・イヤホン": [
      { result: "ワイヤレスイヤホン", keywords: ["完全ワイヤレス", "true wireless"] },
      { result: "ゲーミングヘッドセット", keywords: ["ゲーミングヘッドセット", "gaming headset"] },
    ],
    "チェア": [
      { result: "ゲーミングチェア", keywords: ["ゲーミングチェア", "gaming chair"] },
      { result: "オフィスチェア", keywords: ["オフィスチェア", "office chair"] },
    ],
    "デスク": [
      { result: "昇降デスク", keywords: ["昇降", "standing", "height adjustable"] },
    ],
    "マイク": [
      { result: "コンデンサーマイク", keywords: ["コンデンサー", "condenser"] },
      { result: "ダイナミックマイク", keywords: ["ダイナミック", "dynamic"] },
      { result: "USBマイク", keywords: ["usb"] },
    ],
    "スピーカー": [
      { result: "Bluetoothスピーカー", keywords: ["bluetooth"] },
      { result: "サウンドバー", keywords: ["サウンドバー", "soundbar"] },
    ],
  };

  const rules = amazonCategoryRules[category];
  if (!rules) return null;

  for (const rule of rules) {
    if (rule.keywords.some(kw => categoryText.includes(kw.toLowerCase()))) {
      return rule.result;
    }
  }

  return null;
}
