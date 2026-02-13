/**
 * 撮影機材DB 統一タグ推論エンジン
 *
 * camera-tag-definitions.ts の定義データを読み、
 * Amazon商品情報からタグを自動推論する。
 */

import type { ProductInfo } from "@/lib/product-search";
import {
  CAMERA_TYPE_TAG_DEFS,
  CAMERA_LENS_TAG_DEFS,
  CAMERA_BODY_TAG_DEFS,
  type CameraDetectionRule,
  type CameraFeatureDetector,
  type CameraFeatureAxisDef,
} from "./camera-tag-definitions";

// ============================================================
// テキスト構築
// ============================================================

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

function buildTitleAndFeatures(amazonInfo: ProductInfo): string {
  return [
    amazonInfo.title || "",
    ...(amazonInfo.features || []),
  ].join(" ");
}

// ============================================================
// マッチングロジック
// ============================================================

/** CameraDetectionRule のマッチ判定 */
function matchesDetectionRule(text: string, rule: CameraDetectionRule): boolean {
  if (rule.allOf) {
    return rule.allOf.every((kw) => text.includes(kw));
  }
  if (rule.keywords) {
    return rule.keywords.some((kw) => text.includes(kw));
  }
  return false;
}

/** CameraFeatureDetector のマッチ判定 */
function evaluateFeatureDetector(
  detector: CameraFeatureDetector,
  allText: string,
  titleAndFeatures: string,
): string | null {
  switch (detector.type) {
    case "keywords":
      return detector.keywords.some((kw) => allText.includes(kw.toLowerCase()))
        ? "__MATCH__"
        : null;

    case "allOf":
      return detector.keywords.every((kw) => allText.includes(kw.toLowerCase()))
        ? "__MATCH__"
        : null;

    case "regexRange": {
      let minVal: number | null = null;
      for (const patternStr of detector.patterns) {
        const regex = new RegExp(patternStr, "gi");
        let match;
        while ((match = regex.exec(titleAndFeatures)) !== null) {
          const num = parseInt(match[1]);
          if (num >= detector.validRange[0] && num <= detector.validRange[1]) {
            if (minVal === null || num < minVal) {
              minVal = num;
            }
          }
        }
      }
      if (minVal === null) return null;
      for (const range of detector.ranges) {
        if (minVal <= range.max) {
          return range.tag;
        }
      }
      return null;
    }

    case "regexAperture": {
      // 可変F値の検出
      const variableRegex = new RegExp(detector.variablePattern, "g");
      if (variableRegex.exec(titleAndFeatures)) {
        return detector.variableTag;
      }

      // 単一F値の検出
      let minF: number | null = null;
      for (const patternStr of detector.fixedPatterns) {
        const regex = new RegExp(patternStr, "g");
        let match;
        while ((match = regex.exec(titleAndFeatures)) !== null) {
          const fValue = parseFloat(match[1]);
          if (fValue >= detector.validRange[0] && fValue <= detector.validRange[1]) {
            if (minF === null || fValue < minF) {
              minF = fValue;
            }
          }
        }
      }
      if (minF === null) return null;
      for (const range of detector.ranges) {
        if (minF <= range.max) {
          return range.tag;
        }
      }
      return detector.fallbackTag;
    }
  }
}

// ============================================================
// サブカテゴリ推論
// ============================================================

/**
 * Amazon情報からサブカテゴリを推論
 */
export function inferCameraSubcategory(
  category: string,
  amazonInfo: ProductInfo,
): string | undefined {
  const tagDefs = CAMERA_TYPE_TAG_DEFS[category];
  if (!tagDefs || tagDefs.length === 0) return undefined;

  // テキスト構築
  const parts: string[] = [];
  if (amazonInfo.title) parts.push(amazonInfo.title);
  if (amazonInfo.amazonCategories) parts.push(amazonInfo.amazonCategories.join(" "));
  if (amazonInfo.features) parts.push(amazonInfo.features.slice(0, 3).join(" "));
  const text = parts.join(" ").toLowerCase();
  if (!text) return undefined;

  for (const tagDef of tagDefs) {
    if (tagDef.detect.some((rule) => matchesDetectionRule(text, rule))) {
      return tagDef.name;
    }
  }

  return undefined;
}

// ============================================================
// レンズタグ推論
// ============================================================

/**
 * Amazon情報からレンズタグを推論・補強
 */
export function inferLensTags(
  existingTags: string[],
  amazonInfo: ProductInfo,
): string[] {
  const tags = new Set(existingTags);
  const allText = buildSearchText(amazonInfo);
  const titleAndFeatures = buildTitleAndFeatures(amazonInfo);

  for (const axisDef of CAMERA_LENS_TAG_DEFS) {
    const axisTagNames = axisDef.tags.map((t) => t.name);

    for (const tagDef of axisDef.tags) {
      for (const detector of tagDef.detect) {
        const result = evaluateFeatureDetector(detector, allText, titleAndFeatures);
        if (result) {
          if (axisDef.exclusive) {
            // 排他軸: 既存タグを除去して新タグで置き換え
            for (const t of axisTagNames) tags.delete(t);
          }
          const resolvedTag = result !== "__MATCH__" ? result : tagDef.name;
          tags.add(resolvedTag);
          if (axisDef.exclusive) break; // 排他軸は1つだけ
        }
      }
    }
  }

  // 等倍マクロが付いたらマクロ対応も付ける
  if (tags.has("等倍マクロ")) {
    tags.add("マクロ対応");
  }

  // フルサイズ対応とAPS-C専用は排他
  if (tags.has("APS-C専用") && tags.has("フルサイズ対応")) {
    tags.delete("フルサイズ対応");
  }

  return Array.from(tags);
}

// ============================================================
// カメラタグ推論
// ============================================================

/**
 * Amazon情報からカメラタグを推論・補強
 */
export function inferBodyTags(
  existingTags: string[],
  amazonInfo: ProductInfo,
): string[] {
  const tags = new Set(existingTags);
  const allText = buildSearchText(amazonInfo);
  const titleAndFeatures = buildTitleAndFeatures(amazonInfo);

  for (const axisDef of CAMERA_BODY_TAG_DEFS) {
    const axisTagNames = axisDef.tags.map((t) => t.name);

    // 排他軸で既にタグがある場合はスキップ
    if (axisDef.exclusive && existingTags.some((t) => axisTagNames.includes(t))) {
      continue;
    }

    for (const tagDef of axisDef.tags) {
      for (const detector of tagDef.detect) {
        const result = evaluateFeatureDetector(detector, allText, titleAndFeatures);
        if (result) {
          const resolvedTag = result !== "__MATCH__" ? result : tagDef.name;
          tags.add(resolvedTag);
          if (axisDef.exclusive) break;
        }
      }
      // 排他軸で見つかったら軸ごとbreak
      if (axisDef.exclusive && tags.size > existingTags.length) break;
    }
  }

  return Array.from(tags);
}

// ============================================================
// 統合エンリッチ関数
// ============================================================

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
  /** マージ後のカメラタグ */
  bodyTags: string[];
}

/**
 * Amazon情報を使ってGeminiの判定結果を補強する
 * enrich-camera-tags.ts の enrichCameraTags() を置き換え
 */
export function enrichCameraTags(input: CameraEnrichmentInput): CameraEnrichmentResult {
  const { category, subcategory, lensTags = [], bodyTags = [], amazonInfo } = input;

  // レンズタグ補強
  const enrichedLensTags = category === "レンズ"
    ? inferLensTags(lensTags, amazonInfo)
    : [...lensTags];

  // カメラタグ補強
  const enrichedBodyTags = category === "カメラ"
    ? inferBodyTags(bodyTags, amazonInfo)
    : [...bodyTags];

  // サブカテゴリの補強（Geminiが空の場合のみ）
  const enrichedSubcategory = !subcategory
    ? inferCameraSubcategory(category, amazonInfo)
    : undefined;

  return {
    subcategory: enrichedSubcategory,
    lensTags: enrichedLensTags,
    bodyTags: enrichedBodyTags,
  };
}
