/**
 * ファジーマッチングによる商品重複検出
 *
 * normalizeProductName() の完全一致で捕捉できない表記揺れを
 * Levenshtein距離・Jaccard類似度・型番比較の3シグナルで照合する。
 */

import { extractModelNumber, normalizeProductName } from "./product-normalize";

// マッチ閾値（0.85 = 高めに設定して偽陽性を防ぐ）
const MATCH_THRESHOLD = 0.85;

// スコア重み
const WEIGHT_MODEL_NUMBER = 0.50;
const WEIGHT_JACCARD = 0.30;
const WEIGHT_LEVENSHTEIN = 0.20;

// ファジーマッチ候補の上限
const MAX_CANDIDATES = 200;

export interface FuzzyMatchResult {
  index: number;
  score: number;
  matchReason: string;
}

export interface FuzzyCandidate {
  name: string;
  normalized_name: string;
  brand?: string | null;
}

/**
 * 入力商品名と候補リストをファジーマッチし、最も類似度の高い候補を返す
 *
 * @param inputName - 入力商品名（正規化済み or 未正規化どちらでも可）
 * @param candidates - DB上の候補商品リスト
 * @param inputBrand - 入力商品のブランド名（あれば）
 * @returns マッチ結果 or null（閾値未満の場合）
 */
export function fuzzyMatchProduct(
  inputName: string,
  candidates: FuzzyCandidate[],
  inputBrand?: string
): FuzzyMatchResult | null {
  if (candidates.length === 0) return null;

  // 入力を正規化
  const normalizedInput = normalizeProductName(inputName);
  const inputLower = normalizedInput.toLowerCase();
  const inputTokens = tokenize(normalizedInput);
  const inputModel = extractModelNumber(normalizedInput);
  const inputBrandLower = inputBrand?.toLowerCase().trim();

  let bestResult: FuzzyMatchResult | null = null;

  const limit = Math.min(candidates.length, MAX_CANDIDATES);

  for (let i = 0; i < limit; i++) {
    const candidate = candidates[i];
    const candidateNormalized = candidate.normalized_name || normalizeProductName(candidate.name);
    const candidateLower = candidateNormalized.toLowerCase();

    // 完全一致は既にチェック済みなのでスキップ
    if (inputLower === candidateLower) continue;

    // --- ブランドガード ---
    // 両方にブランドがあり、異なる場合は即除外
    if (inputBrandLower && candidate.brand) {
      const candidateBrandLower = candidate.brand.toLowerCase().trim();
      if (inputBrandLower !== candidateBrandLower) {
        continue;
      }
    }

    // --- 型番比較 ---
    const candidateModel = extractModelNumber(candidateNormalized);
    const modelComparison = compareModelNumbers(inputModel, candidateModel);

    // 両方に型番があるが異なる → 別商品として即除外
    if (modelComparison === 0.0) {
      continue;
    }

    // --- スコア計算 ---
    const candidateTokens = tokenize(candidateNormalized);
    const jaccard = jaccardSimilarity(inputTokens, candidateTokens);
    const levenshtein = levenshteinSimilarity(inputLower, candidateLower);

    let score: number;
    let reasons: string[] = [];

    if (modelComparison !== null) {
      // 型番が両方にあり一致 → 3シグナル加重平均
      score =
        WEIGHT_MODEL_NUMBER * modelComparison +
        WEIGHT_JACCARD * jaccard +
        WEIGHT_LEVENSHTEIN * levenshtein;
      reasons.push(`model:${modelComparison.toFixed(2)}`);
    } else {
      // 型番なし or 片方のみ → Jaccard + Levenshtein の加重平均（型番分を再配分）
      const adjustedJaccardWeight = WEIGHT_JACCARD + WEIGHT_MODEL_NUMBER * 0.5;
      const adjustedLevenshteinWeight = WEIGHT_LEVENSHTEIN + WEIGHT_MODEL_NUMBER * 0.5;
      score =
        adjustedJaccardWeight * jaccard +
        adjustedLevenshteinWeight * levenshtein;
    }

    reasons.push(`jaccard:${jaccard.toFixed(2)}`);
    reasons.push(`lev:${levenshtein.toFixed(2)}`);

    if (score >= MATCH_THRESHOLD && (!bestResult || score > bestResult.score)) {
      bestResult = {
        index: i,
        score,
        matchReason: reasons.join(", "),
      };
    }
  }

  return bestResult;
}

/**
 * レーベンシュタイン距離を計算（Wagner-Fischer アルゴリズム）
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // メモリ最適化: 2行分のみ保持
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * レーベンシュタイン距離ベースの類似度（0.0〜1.0）
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

/**
 * Jaccard類似度（トークン集合ベース、0.0〜1.0）
 */
function jaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
}

/**
 * 型番比較
 * - 両方あり & 一致 → 1.0
 * - 両方あり & 不一致 → 0.0（即除外用）
 * - 片方 or 両方なし → null（スコアリングから除外）
 */
function compareModelNumbers(model1: string | null, model2: string | null): number | null {
  if (!model1 || !model2) return null;

  const m1 = model1.toLowerCase().replace(/[\s\-]/g, "");
  const m2 = model2.toLowerCase().replace(/[\s\-]/g, "");

  return m1 === m2 ? 1.0 : 0.0;
}

/**
 * 文字列をトークン集合に変換
 * - 小文字化
 * - 全角→半角変換
 * - スペース・ハイフン・スラッシュで分割
 * - 1文字トークンは除外（ただしギリシャ文字等は残す）
 */
function tokenize(text: string): Set<string> {
  // 全角英数字→半角
  let normalized = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 小文字化
  normalized = normalized.toLowerCase();

  // スペース・ハイフン・スラッシュ・アンダースコアで分割
  const tokens = normalized.split(/[\s\-\/\_]+/).filter((t) => {
    // 空文字を除外
    if (t.length === 0) return false;
    // 1文字のASCII英数字を除外（ただし "α" 等は残す）
    if (t.length === 1 && /^[a-z0-9]$/.test(t)) return false;
    return true;
  });

  return new Set(tokens);
}
