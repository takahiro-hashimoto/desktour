/**
 * 統一タグ推論エンジン
 *
 * tag-definitions.ts の定義データを読み、Amazon商品情報からタグを自動推論する。
 * 種類タグ（多軸排他）と特徴タグ（複数付与可）の両方を処理する。
 */

import {
  TYPE_TAG_DEFS,
  CATEGORY_FEATURE_TAG_DEFS,
  type DetectionRule,
  type FeatureDetector,
} from "./tag-definitions";

// ============================================================
// 共通型
// ============================================================

interface ProductInfo {
  category: string;
  title?: string;
  features?: string[];
  technicalInfo?: Record<string, string>;
  amazonCategories?: string[];
  brand?: string;
  currentSubcategory?: string | null;
}

// ============================================================
// マッチングロジック
// ============================================================

/** 検索用テキストを構築 */
function buildAllText(data: ProductInfo): string {
  const title = (data.title || "").toLowerCase();
  const features = (data.features || []).join(" ").toLowerCase();
  return (title + " " + features).toLowerCase();
}

/** DetectionRule のマッチ判定（種類タグ用） */
function matchesDetectionRule(text: string, rule: DetectionRule): boolean {
  if (rule.allOf) {
    return rule.allOf.every((kw) => text.includes(kw));
  }
  if (rule.keywords) {
    return rule.keywords.some((kw) => text.includes(kw));
  }
  return false;
}

/** FeatureDetector のマッチ判定（特徴タグ用） */
function evaluateFeatureDetector(
  detector: FeatureDetector,
  data: ProductInfo,
  allText: string,
): string | null {
  switch (detector.type) {
    case "keywords":
      return detector.keywords.some((kw) => allText.includes(kw)) ? "__MATCH__" : null;

    case "allOf":
      return detector.keywords.every((kw) => allText.includes(kw)) ? "__MATCH__" : null;

    case "numeric": {
      const val = data.technicalInfo?.[detector.field];
      if (!val) return null;
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      switch (detector.op) {
        case "<": return num < detector.value ? "__MATCH__" : null;
        case ">": return num > detector.value ? "__MATCH__" : null;
        case "<=": return num <= detector.value ? "__MATCH__" : null;
        case ">=": return num >= detector.value ? "__MATCH__" : null;
      }
      return null;
    }

    case "regexRange": {
      const source = detector.field === "title" ? (data.title || "") : allText;
      const match = source.match(new RegExp(detector.pattern));
      if (!match) return null;
      const num = parseInt(match[1] || match[2]);
      if (isNaN(num)) return null;
      for (const range of detector.ranges) {
        if (num <= range.max) {
          return range.tag; // 該当するレンジのタグ名を返す
        }
      }
      return null;
    }
  }
}

// ============================================================
// 推論エンジン
// ============================================================

/**
 * 種類タグを推論（多軸: 各軸から最大1つ）
 */
export function inferTypeTags(data: ProductInfo): string[] {
  const axes = TYPE_TAG_DEFS[data.category];
  if (!axes) return [];

  const allText = buildAllText(data);
  const results: string[] = [];

  // 1. 商品テキストからの検出
  for (const axis of axes) {
    for (const tagDef of axis.tags) {
      if (tagDef.detect.some((rule) => matchesDetectionRule(allText, rule))) {
        results.push(tagDef.name);
        break; // この軸は1つだけ
      }
    }
  }

  // 2. Amazonカテゴリ階層からのフォールバック（種類タグが1つも見つからなかった場合）
  if (results.length === 0 && data.amazonCategories?.length) {
    const catText = data.amazonCategories.join(" ").toLowerCase();
    for (const axis of axes) {
      for (const tagDef of axis.tags) {
        if (tagDef.amazonDetect?.some((rule) => matchesDetectionRule(catText, rule))) {
          results.push(tagDef.name);
          break;
        }
      }
    }
  }

  return results;
}

/**
 * 特徴タグを推論（複数付与可）
 */
export function inferFeatureTags(data: ProductInfo): string[] {
  const allText = buildAllText(data);
  const tags: Set<string> = new Set();

  // Amazonカテゴリテキスト（補強用）
  const amazonCatText = data.amazonCategories?.length
    ? data.amazonCategories.join(" ").toLowerCase()
    : "";

  // カテゴリ固有の特徴タグ
  const categoryDefs = CATEGORY_FEATURE_TAG_DEFS[data.category];
  if (categoryDefs) {
    for (const tagDef of categoryDefs) {
      for (const detector of tagDef.detect) {
        const result = evaluateFeatureDetector(detector, data, allText);
        if (result) {
          // regexRange は特別: 返された tag 名がこの tagDef の name と異なる場合がある
          if (result !== "__MATCH__") {
            tags.add(result);
          } else {
            tags.add(tagDef.name);
          }
          break;
        }
      }
    }
  }

  // Amazonカテゴリ固有の補強（USB-C for monitors）
  if (amazonCatText && data.category === "ディスプレイ・モニター") {
    if (amazonCatText.includes("usb") && amazonCatText.includes("type-c")) {
      tags.add("USB-C");
    }
  }

  return Array.from(tags);
}

/**
 * 商品情報からタグを自動抽出（種類タグ + 特徴タグ）
 * productTags.ts の extractProductTags() を置き換え
 */
export function extractProductTags(data: ProductInfo): string[] {
  return [...inferTypeTags(data), ...inferFeatureTags(data)];
}

/**
 * 後方互換: 多軸推論（各軸から最大1つ）
 */
export function inferSubcategoryMultiAxis(data: ProductInfo): string[] {
  return inferTypeTags(data);
}

/**
 * 後方互換: 単一サブカテゴリ推論
 */
export function inferSubcategory(data: ProductInfo): string | null {
  if (data.currentSubcategory) return data.currentSubcategory;
  const results = inferTypeTags(data);
  return results.length > 0 ? results[0] : null;
}
