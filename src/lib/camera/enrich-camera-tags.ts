/**
 * Amazon商品情報を使ってCamera用タグ（lensTags, bodyTags, subcategory）を補強する
 *
 * Geminiが字幕/記事テキストから判定したタグに加え、
 * Amazon PA-APIの正確なスペック情報で補完・補正を行う。
 */

import type { ProductInfo } from "@/lib/product-search";
import {
  CAMERA_LENS_TAGS,
  CAMERA_BODY_TAGS,
  CAMERA_TYPE_TAGS,
} from "./constants";

// ========================================
// 型定義
// ========================================

export interface CameraEnrichmentInput {
  category: string;
  subcategory?: string;
  lensTags?: string[];
  bodyTags?: string[];
  amazonInfo: ProductInfo;
}

export interface CameraEnrichmentResult {
  /** 補正後のサブカテゴリ（変更なしならundefined） */
  subcategory?: string;
  /** マージ後のレンズタグ */
  lensTags: string[];
  /** マージ後のカメラ本体タグ */
  bodyTags: string[];
}

// ========================================
// メイン関数
// ========================================

/**
 * Amazon情報を使ってGeminiの判定結果を補強する
 */
export function enrichCameraTags(input: CameraEnrichmentInput): CameraEnrichmentResult {
  const { category, subcategory, lensTags = [], bodyTags = [], amazonInfo } = input;

  // Amazon情報からテキストを構築
  const allText = buildSearchText(amazonInfo);

  // カテゴリ別のタグ補強
  const enrichedLensTags = category === "レンズ"
    ? enrichLensTags(lensTags, allText, amazonInfo)
    : [...lensTags];

  const enrichedBodyTags = category === "カメラ本体"
    ? enrichBodyTags(bodyTags, allText)
    : [...bodyTags];

  // サブカテゴリの補強（Geminiが空の場合のみ）
  const enrichedSubcategory = !subcategory
    ? inferSubcategoryFromAmazon(category, amazonInfo)
    : undefined;

  return {
    subcategory: enrichedSubcategory,
    lensTags: enrichedLensTags,
    bodyTags: enrichedBodyTags,
  };
}

// ========================================
// テキスト構築
// ========================================

function buildSearchText(amazonInfo: ProductInfo): string {
  const parts: string[] = [];

  if (amazonInfo.title) parts.push(amazonInfo.title);
  if (amazonInfo.features) parts.push(amazonInfo.features.join(" "));
  if (amazonInfo.technicalInfo) {
    parts.push(Object.entries(amazonInfo.technicalInfo).map(([k, v]) => `${k} ${v}`).join(" "));
  }
  if (amazonInfo.amazonCategories) parts.push(amazonInfo.amazonCategories.join(" "));

  return parts.join(" ").toLowerCase();
}

// ========================================
// レンズタグ補強
// ========================================

function enrichLensTags(
  existingTags: string[],
  allText: string,
  amazonInfo: ProductInfo
): string[] {
  const tags = new Set(existingTags);
  const validLensTags = CAMERA_LENS_TAGS;

  // タイトルとfeaturesからスペック情報を優先的に抽出
  const titleAndFeatures = [
    amazonInfo.title || "",
    ...(amazonInfo.features || []),
  ].join(" ");

  // --- 焦点距離の検出 ---
  const focalTag = detectFocalLength(titleAndFeatures);
  if (focalTag && validLensTags["焦点距離"].includes(focalTag)) {
    // 同一軸の既存タグを除去してAmazon値で置き換え
    removeAxisTags(tags, validLensTags["焦点距離"]);
    tags.add(focalTag);
  }

  // --- 明るさ（F値）の検出 ---
  const apertureTags = detectAperture(titleAndFeatures);
  if (apertureTags.length > 0) {
    const validApertures = validLensTags["明るさ"];
    // 同一軸の既存タグを除去してAmazon値で置き換え
    removeAxisTags(tags, validApertures);
    for (const tag of apertureTags) {
      if (validApertures.includes(tag)) {
        tags.add(tag);
      }
    }
  }

  // --- 機能タグの検出 ---
  const featureRules: Array<{ tag: string; keywords: string[] }> = [
    { tag: "マクロ対応", keywords: ["マクロ", "macro"] },
    { tag: "等倍マクロ", keywords: ["等倍マクロ", "1:1 macro", "life-size"] },
    { tag: "手ブレ補正", keywords: ["手ブレ補正", "手振れ補正", "image stabilization", " is ", " vr ", " oss ", " ois ", "stabilized"] },
    { tag: "防塵防滴", keywords: ["防塵防滴", "防滴", "weather sealed", "weather-sealed", "dust and moisture", "防塵・防滴"] },
  ];

  for (const rule of featureRules) {
    if (validLensTags["機能"].includes(rule.tag)) {
      if (rule.keywords.some(kw => allText.includes(kw.toLowerCase()))) {
        tags.add(rule.tag);
      }
    }
  }

  // 等倍マクロが付いたらマクロ対応も付ける
  if (tags.has("等倍マクロ")) {
    tags.add("マクロ対応");
  }

  // --- 規格・対応タグの検出 ---
  const specRules: Array<{ tag: string; keywords: string[] }> = [
    { tag: "フルサイズ対応", keywords: ["フルサイズ対応", "フルサイズ", "full frame", "full-frame", "35mmフルサイズ", "35mm full"] },
    { tag: "APS-C専用", keywords: ["aps-c専用", "aps-c only", "apsc専用", "dx format"] },
    { tag: "Eマウント", keywords: ["eマウント", "e-mount", "e mount", "sony e "] },
    { tag: "RFマウント", keywords: ["rfマウント", "rf-mount", "rf mount", "canon rf"] },
    { tag: "Zマウント", keywords: ["zマウント", "z-mount", "z mount", "nikon z"] },
    { tag: "Lマウント", keywords: ["lマウント", "l-mount", "l mount"] },
    { tag: "Xマウント", keywords: ["xマウント", "x-mount", "x mount", "fujifilm x"] },
    { tag: "MFT", keywords: ["マイクロフォーサーズ", "micro four thirds", "micro 4/3", "mft", "m4/3", "m.zuiko"] },
  ];

  for (const rule of specRules) {
    if (validLensTags["規格・対応"].includes(rule.tag)) {
      if (rule.keywords.some(kw => allText.includes(kw.toLowerCase()))) {
        tags.add(rule.tag);
      }
    }
  }

  // フルサイズ対応とAPS-C専用は排他（APS-C専用が明示されていればフルサイズ対応を除去）
  if (tags.has("APS-C専用") && tags.has("フルサイズ対応")) {
    tags.delete("フルサイズ対応");
  }

  return Array.from(tags);
}

// ========================================
// 焦点距離の検出
// ========================================

function detectFocalLength(text: string): string | null {
  // パターン: "24-70mm", "50mm", "14mm", "200-600mm" 等
  // ズームレンズは広角端で判定
  const patterns = [
    /(\d+)(?:\s*-\s*\d+)?\s*mm/gi,       // 24-70mm, 50mm
    /(\d+)(?:\s*-\s*\d+)?\s*ミリ/gi,      // 24ミリ
  ];

  let minFocal: number | null = null;

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const focal = parseInt(match[1]);
      // 妥当な焦点距離の範囲（4mm〜2000mm）
      if (focal >= 4 && focal <= 2000) {
        if (minFocal === null || focal < minFocal) {
          minFocal = focal;
        }
      }
    }
  }

  if (minFocal === null) return null;

  // 焦点距離→タグの変換
  if (minFocal <= 16) return "超広角";
  if (minFocal <= 35) return "広角";
  if (minFocal <= 60) return "標準";
  if (minFocal <= 100) return "中望遠";
  if (minFocal <= 300) return "望遠";
  return "超望遠";
}

// ========================================
// F値の検出
// ========================================

function detectAperture(text: string): string[] {
  const tags: string[] = [];

  // 可変F値のパターン: "F3.5-5.6", "f/3.5-6.3" 等
  const variablePattern = /[fF][\s/]?(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/g;
  let variableMatch = variablePattern.exec(text);
  if (variableMatch) {
    tags.push("可変F値");
    return tags;
  }

  // 単一F値のパターン: "F1.4", "f/2.8", "F2", "1:1.4" 等
  const fixedPatterns = [
    /[fF][\s/]?(\d+\.?\d*)/g,
    /1\s*:\s*(\d+\.?\d*)/g,
  ];

  let minF: number | null = null;
  for (const pattern of fixedPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fValue = parseFloat(match[1]);
      // 妥当なF値の範囲
      if (fValue >= 0.7 && fValue <= 32) {
        if (minF === null || fValue < minF) {
          minF = fValue;
        }
      }
    }
  }

  if (minF === null) return tags;

  // F値→タグの変換
  if (minF <= 1.4) tags.push("F1.2-F1.4");
  else if (minF <= 2) tags.push("F1.8-F2");
  else if (minF <= 2.8) tags.push("F2.8");
  else if (minF <= 4) tags.push("F4");
  else tags.push("可変F値");

  return tags;
}

// ========================================
// カメラ本体タグ補強
// ========================================

function enrichBodyTags(existingTags: string[], allText: string): string[] {
  const tags = new Set(existingTags);
  const validBodyTags = CAMERA_BODY_TAGS["撮像サイズ"];

  const sensorRules: Array<{ tag: string; keywords: string[] }> = [
    { tag: "フルサイズ", keywords: ["フルサイズ", "full frame", "full-frame", "35mmフルサイズ", "35mm full frame"] },
    { tag: "APS-C", keywords: ["aps-c", "apsc", "dx format", "aps-cサイズ"] },
    { tag: "マイクロフォーサーズ", keywords: ["マイクロフォーサーズ", "micro four thirds", "micro 4/3", "mft", "m4/3"] },
    { tag: "1インチ", keywords: ["1インチ", "1-inch", "1型", "1.0型", "1 inch sensor"] },
    { tag: "小型センサー", keywords: ["1/2.3", "1/1.7", "1/1.3", "2/3型"] },
  ];

  for (const rule of sensorRules) {
    if (validBodyTags.includes(rule.tag)) {
      if (rule.keywords.some(kw => allText.includes(kw.toLowerCase()))) {
        // 撮像サイズは排他的（最初にマッチしたもの優先、既存が空の場合のみ）
        if (!existingTags.some(t => validBodyTags.includes(t))) {
          tags.add(rule.tag);
          break; // 1つだけ
        }
      }
    }
  }

  return Array.from(tags);
}

// ========================================
// サブカテゴリの推定
// ========================================

function inferSubcategoryFromAmazon(
  category: string,
  amazonInfo: ProductInfo
): string | undefined {
  const subcategories = CAMERA_TYPE_TAGS[category];
  if (!subcategories || subcategories.length === 0) return undefined;

  // Amazon情報からテキスト構築
  const parts: string[] = [];
  if (amazonInfo.title) parts.push(amazonInfo.title);
  if (amazonInfo.amazonCategories) parts.push(amazonInfo.amazonCategories.join(" "));
  if (amazonInfo.features) parts.push(amazonInfo.features.slice(0, 3).join(" "));
  const text = parts.join(" ").toLowerCase();

  if (!text) return undefined;

  // サブカテゴリごとのキーワードマッチルール
  const rules = getSubcategoryRules(category);

  for (const rule of rules) {
    if (subcategories.includes(rule.result)) {
      if (rule.keywords.some(kw => text.includes(kw.toLowerCase()))) {
        return rule.result;
      }
    }
  }

  return undefined;
}

// ========================================
// サブカテゴリ推定ルール
// ========================================

interface SubcategoryRule {
  result: string;
  keywords: string[];
}

function getSubcategoryRules(category: string): SubcategoryRule[] {
  const rules: Record<string, SubcategoryRule[]> = {
    "カメラ本体": [
      { result: "ミラーレス一眼", keywords: ["ミラーレス", "mirrorless"] },
      { result: "一眼レフ", keywords: ["一眼レフ", "デジタル一眼レフ", "dslr"] },
      { result: "コンパクトデジタルカメラ", keywords: ["コンパクト", "コンデジ", "compact camera", "point and shoot"] },
      { result: "シネマカメラ", keywords: ["シネマカメラ", "cinema camera", "シネカメ"] },
      { result: "アクションカメラ", keywords: ["アクションカメラ", "action camera", "gopro", "ウェアラブル"] },
    ],
    "レンズ": [
      { result: "単焦点レンズ", keywords: ["単焦点", "prime lens"] },
      { result: "ズームレンズ", keywords: ["ズームレンズ", "zoom lens", "ズーム"] },
      { result: "シネマレンズ", keywords: ["シネマレンズ", "cine lens", "cinema lens"] },
    ],
    "三脚": [
      { result: "三脚", keywords: ["三脚", "tripod"] },
      { result: "一脚", keywords: ["一脚", "monopod"] },
      { result: "ミニ三脚", keywords: ["ミニ三脚", "卓上三脚", "mini tripod", "tabletop"] },
      { result: "トラベル三脚", keywords: ["トラベル", "travel tripod", "旅行"] },
      { result: "ビデオ三脚", keywords: ["ビデオ三脚", "video tripod", "フルードヘッド"] },
      { result: "雲台", keywords: ["雲台", "自由雲台", "ボールヘッド", "ball head", "ビデオヘッド"] },
    ],
    "ジンバル": [
      { result: "カメラ用ジンバル", keywords: ["カメラ用", "camera gimbal", "一眼", "ミラーレス"] },
      { result: "スマホ用ジンバル", keywords: ["スマホ", "スマートフォン", "smartphone", "phone gimbal"] },
      { result: "メカニカルスタビライザー", keywords: ["メカニカル", "mechanical stabilizer"] },
    ],
    "マイク・音声": [
      { result: "マイク", keywords: ["マイク", "microphone", "mic"] },
      { result: "レコーダー", keywords: ["レコーダー", "recorder", "pcm"] },
      { result: "オーディオインターフェース", keywords: ["オーディオインターフェース", "audio interface"] },
    ],
    "照明": [
      { result: "定常光ライト", keywords: ["ledライト", "led light", "定常光", "パネルライト", "ビデオライト"] },
      { result: "ストロボ", keywords: ["ストロボ", "strobe", "flash", "スピードライト", "speedlight"] },
      { result: "照明アクセサリー", keywords: ["ソフトボックス", "ディフューザー", "リフレクター", "ライトスタンド"] },
    ],
    "ストレージ": [
      { result: "メモリーカード", keywords: ["sdカード", "cfexpress", "メモリーカード", "memory card", "sd card", "microsd"] },
      { result: "外部ストレージ", keywords: ["外付け", "ポータブルssd", "external", "portable ssd", "hdd"] },
      { result: "カードリーダー", keywords: ["カードリーダー", "card reader"] },
    ],
    "カメラ装着アクセサリー": [
      { result: "外部モニター", keywords: ["外部モニター", "モニター", "monitor", "フィールドモニター"] },
      { result: "ケージ・リグ", keywords: ["ケージ", "リグ", "cage", "rig"] },
      { result: "フォローフォーカス", keywords: ["フォローフォーカス", "follow focus"] },
      { result: "レンズフィルター", keywords: ["フィルター", "filter", "nd", "cpl", "プロテクター"] },
      { result: "電子マウントアダプター", keywords: ["マウントアダプター", "mount adapter"] },
      { result: "バッテリー", keywords: ["バッテリー", "battery", "充電池"] },
      { result: "充電器", keywords: ["充電器", "charger"] },
      { result: "カメラストラップ", keywords: ["ストラップ", "strap"] },
    ],
    "収録・制御機器": [
      { result: "キャプチャーデバイス", keywords: ["キャプチャー", "capture"] },
      { result: "外部レコーダー", keywords: ["外部レコーダー", "external recorder", "atomos"] },
      { result: "制御アクセサリー", keywords: ["リモコン", "remote", "ワイヤレストランスミッター"] },
      { result: "キャリブレーションツール", keywords: ["キャリブレーション", "calibration", "カラーチェッカー"] },
    ],
    "バッグ・収納": [
      { result: "カメラバッグ", keywords: ["カメラバッグ", "camera bag", "ショルダーバッグ"] },
      { result: "バックパック", keywords: ["バックパック", "リュック", "backpack"] },
      { result: "スリングバッグ", keywords: ["スリング", "sling"] },
      { result: "ハードケース", keywords: ["ハードケース", "hard case", "pelican", "ペリカン"] },
      { result: "インナーケース", keywords: ["インナー", "inner case", "仕切り"] },
    ],
  };

  return rules[category] || [];
}

// ========================================
// ユーティリティ
// ========================================

/** 指定軸のタグをすべて除去する */
function removeAxisTags(tags: Set<string>, axisTags: string[]): void {
  for (const t of axisTags) {
    tags.delete(t);
  }
}
