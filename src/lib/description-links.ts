// 概要欄からEC系リンクを抽出してASIN/itemCodeを取得する

import { fetchOfficialProductInfo, isExcludedDomain, isShortUrlService, type OfficialProductInfo } from "./ogp";
import { getBrandAliases, detectCategory, isCategoryMismatch } from "./brand-category-utils";

export interface ExtractedProduct {
  asin?: string;
  rakutenItemCode?: string;
  originalUrl: string;
  source: "amazon" | "rakuten" | "official";
  // 公式サイトの場合の追加情報
  officialInfo?: OfficialProductInfo;
}

// Amazon URLからASINを抽出
function extractAsinFromUrl(url: string): string | null {
  // パターン1: /dp/ASIN
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch) return dpMatch[1].toUpperCase();

  // パターン2: /gp/product/ASIN
  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch) return gpMatch[1].toUpperCase();

  // パターン3: /ASIN/
  const asinMatch = url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/i);
  if (asinMatch) return asinMatch[1].toUpperCase();

  return null;
}

// 楽天URLからitemCodeを抽出
function extractRakutenItemCode(url: string): string | null {
  // 楽天の商品URL: item.rakuten.co.jp/shopcode/itemcode/
  const itemMatch = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/\?]+)/);
  if (itemMatch) return `${itemMatch[1]}:${itemMatch[2]}`;

  return null;
}

// 短縮URLを展開
async function expandShortUrl(shortUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト

    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 最終的なURLを返す
    return response.url;
  } catch (error) {
    console.log(`[DescLinks] Failed to expand URL: ${shortUrl}`);
    return null;
  }
}

// Amazon短縮URLかどうか
function isAmazonShortUrl(url: string): boolean {
  return url.includes("amzn.to") || url.includes("amzn.asia");
}

// 楽天短縮URLかどうか
function isRakutenShortUrl(url: string): boolean {
  return url.includes("a.r10.to") || url.includes("hb.afl.rakuten.co.jp");
}

// Amazon直リンクかどうか
function isAmazonDirectUrl(url: string): boolean {
  return url.includes("amazon.co.jp") || url.includes("amazon.com");
}

// 楽天直リンクかどうか
function isRakutenDirectUrl(url: string): boolean {
  return url.includes("rakuten.co.jp") || url.includes("item.rakuten.co.jp");
}

// 概要欄からすべてのURLを抽出
function extractAllUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\])"<>]+/g;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // 重複排除
}

// メイン関数: 概要欄からEC商品情報を抽出
export async function extractProductsFromDescription(
  description: string
): Promise<ExtractedProduct[]> {
  const urls = extractAllUrls(description);
  const products: ExtractedProduct[] = [];
  const processedAsins = new Set<string>();
  const processedRakutenCodes = new Set<string>();

  console.log(`[DescLinks] Found ${urls.length} URLs in description`);

  // 並列処理用のPromise配列
  const processPromises = urls.map(async (url): Promise<ExtractedProduct | null> => {
    // 1. Amazon直リンク
    if (isAmazonDirectUrl(url)) {
      const asin = extractAsinFromUrl(url);
      if (asin && !processedAsins.has(asin)) {
        processedAsins.add(asin);
        console.log(`[DescLinks] Found Amazon ASIN: ${asin}`);
        return { asin, originalUrl: url, source: "amazon" };
      }
    }

    // 2. 楽天直リンク
    if (isRakutenDirectUrl(url)) {
      const itemCode = extractRakutenItemCode(url);
      if (itemCode && !processedRakutenCodes.has(itemCode)) {
        processedRakutenCodes.add(itemCode);
        console.log(`[DescLinks] Found Rakuten itemCode: ${itemCode}`);
        return { rakutenItemCode: itemCode, originalUrl: url, source: "rakuten" };
      }
    }

    // 3. Amazon短縮URL → 展開
    if (isAmazonShortUrl(url)) {
      const expandedUrl = await expandShortUrl(url);
      if (expandedUrl) {
        const asin = extractAsinFromUrl(expandedUrl);
        if (asin && !processedAsins.has(asin)) {
          processedAsins.add(asin);
          console.log(`[DescLinks] Expanded Amazon URL → ASIN: ${asin}`);
          return { asin, originalUrl: url, source: "amazon" };
        }
      }
    }

    // 4. 楽天短縮URL → 展開
    if (isRakutenShortUrl(url)) {
      const expandedUrl = await expandShortUrl(url);
      if (expandedUrl) {
        const itemCode = extractRakutenItemCode(expandedUrl);
        if (itemCode && !processedRakutenCodes.has(itemCode)) {
          processedRakutenCodes.add(itemCode);
          console.log(`[DescLinks] Expanded Rakuten URL → itemCode: ${itemCode}`);
          return { rakutenItemCode: itemCode, originalUrl: url, source: "rakuten" };
        }
        // 楽天アフィリエイトリンクの場合、ASINが含まれる可能性も
        const asin = extractAsinFromUrl(expandedUrl);
        if (asin && !processedAsins.has(asin)) {
          processedAsins.add(asin);
          return { asin, originalUrl: url, source: "amazon" };
        }
      }
    }

    // 5. 短縮URLサービス（bit.ly等）→ 展開してOGP取得
    // ※Amazon/楽天以外の短縮URLはここで処理
    if (isShortUrlService(url)) {
      const officialInfo = await fetchOfficialProductInfo(url);
      if (officialInfo && officialInfo.image) {
        console.log(`[DescLinks] Found official site (via short URL): ${officialInfo.domain} - ${officialInfo.title || 'No title'}`);
        return {
          originalUrl: url,
          source: "official",
          officialInfo,
        };
      }
    }

    // 6. その他のURL（公式サイトなど）→ OGP取得を試みる
    if (!isExcludedDomain(url)) {
      const officialInfo = await fetchOfficialProductInfo(url);
      if (officialInfo && officialInfo.image) {
        console.log(`[DescLinks] Found official site: ${officialInfo.domain} - ${officialInfo.title || 'No title'}`);
        return {
          originalUrl: url,
          source: "official",
          officialInfo,
        };
      }
    }

    return null;
  });

  // 並列実行（最大10件同時）
  const batchSize = 10;
  for (let i = 0; i < processPromises.length; i += batchSize) {
    const batch = processPromises.slice(i, i + batchSize);
    const results = await Promise.all(batch);
    for (const result of results) {
      if (result) {
        products.push(result);
      }
    }
  }

  console.log(`[DescLinks] Extracted ${products.length} products from description`);
  return products;
}

// ========================================
// 商品名の正規化
// ========================================
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    // 全角→半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // &とandの統一
    .replace(/\s*&\s*/g, " and ")
    .replace(/&/g, " and ")
    // Type-C系の統一
    .replace(/type[\-\s]?c/gi, "usbc")
    .replace(/usb[\-\s]?c/gi, "usbc")
    .replace(/usb[\-\s]?type[\-\s]?c/gi, "usbc")
    // ハイフン、アンダースコアをスペースに
    .replace(/[\-_]/g, " ")
    // 複数スペースを1つに
    .replace(/\s+/g, " ")
    .trim();
}

// ========================================
// 型番処理
// ========================================

// 型番として扱わない一般的な単語（ブランド名、一般用語）
const NON_MODEL_WORDS = new Set([
  // ブランド名
  "asus", "benq", "dell", "sony", "apple", "anker", "ugreen", "mcdodo",
  "logicool", "logitech", "satechi", "belkin", "samsung", "elecom",
  "buffalo", "sanwa", "caldigit", "earthworks", "master", "dynamic",
  "topperfun", "ohitec", "cio", "time", "timer", "keychron", "hhkb",
  "razer", "corsair", "steelseries", "zowie", "filco", "ducky", "topre",
  // 一般的な単語
  "usb", "mac", "mini", "pro", "max", "plus", "air", "lite",
  "micro", "type", "hdmi", "led", "lcd", "rgb", "ios", "android",
  "bluetooth", "wifi", "wireless", "cable", "adapter", "hub",
  "keyboard", "mouse", "monitor", "stand", "dock", "charger",
  "black", "white", "silver", "gray", "grey", "gold", "red", "blue",
]);

// 型番パターン（英字+数字の混在を必須にする）
// 例: M575S, KX700, PA27JCV, CB-CT5 など
const MODEL_PATTERN = /[A-Z]+[0-9]+[A-Z0-9]*|[0-9]+[A-Z]+[A-Z0-9]*/gi;

// 型番として有効かチェック
function isValidModelNumber(model: string): boolean {
  const lowerModel = model.toLowerCase();
  // 除外リストに含まれていないか
  if (NON_MODEL_WORDS.has(lowerModel)) return false;
  // 最低3文字以上
  if (model.length < 3) return false;
  // 数字を含んでいるか（英字のみの場合は型番ではない可能性が高い）
  if (!/\d/.test(model)) return false;
  return true;
}

// マッチングスコアを計算（高いほど良いマッチ）
export function calculateMatchScore(
  productName: string,
  productBrand: string | undefined,
  asinTitle: string
): { score: number; reason: string } {
  // 正規化
  const normalizedProduct = normalizeProductName(productName);
  const normalizedAsin = normalizeProductName(asinTitle);
  const brandLower = (productBrand || "").toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  // 0. カテゴリミスマッチチェック（致命的なミスマッチは即座に除外）
  const productCategory = detectCategory(productName);
  const asinCategory = detectCategory(asinTitle);
  if (isCategoryMismatch(productCategory, asinCategory)) {
    return {
      score: -1000, // 大きなペナルティ
      reason: `Category mismatch: ${productCategory} vs ${asinCategory}`
    };
  }

  // 1. 型番を抽出（英数字混在のみ）
  const productModels = (productName.match(MODEL_PATTERN) || []).filter(isValidModelNumber);
  const asinModels = (asinTitle.match(MODEL_PATTERN) || []).filter(isValidModelNumber);

  // 2. 型番一致チェック
  let modelMatched = false;
  let partialModelMatch = false;
  for (const pModel of productModels) {
    for (const aModel of asinModels) {
      const pLower = pModel.toLowerCase();
      const aLower = aModel.toLowerCase();

      // 完全一致（+100）
      if (aLower === pLower) {
        score += 100;
        reasons.push(`Model: ${pModel}`);
        modelMatched = true;
        break;
      }
      // 部分一致: M575 ⊂ M575SP や MX900 ⊂ MX900S など（+50）
      // 短い方が長い方に含まれている場合
      if (!partialModelMatch && pLower.length >= 3 && aLower.length >= 3) {
        if (aLower.startsWith(pLower) || pLower.startsWith(aLower)) {
          score += 50;
          reasons.push(`PartialModel: ${pModel}~${aModel}`);
          partialModelMatch = true;
        }
      }
    }
    if (modelMatched) break;
  }

  // 3. ブランド一致チェック（エイリアス対応、+20）
  let brandMatched = false;
  if (brandLower) {
    const brandAliases = getBrandAliases(brandLower);
    for (const alias of brandAliases) {
      if (normalizedAsin.includes(alias)) {
        score += 20;
        reasons.push(`Brand: ${productBrand}`);
        brandMatched = true;
        break;
      }
    }
  }

  // 4. 単語一致数をカウント（各単語 +10）— ワード境界マッチ
  const productWords = normalizedProduct
    .replace(/[（）()]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !getBrandAliases(brandLower).includes(w));

  // ASIN側もワード分割して Set 化（境界マッチ用）
  const asinWords = new Set(
    normalizedAsin
      .replace(/[（）()]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 1)
  );

  let matchedWords = 0;
  for (const word of productWords) {
    if (word.length >= 2) {
      // 完全ワード一致（境界ベース）を優先
      if (asinWords.has(word)) {
        matchedWords++;
      }
      // 3文字以下の短い単語は完全ワード一致のみ（"pro"→"protect" 誤マッチ防止）
      // 4文字以上の場合は部分文字列マッチもフォールバック（"ergonomic" を "エルゴノミック" と一致等）
      else if (word.length >= 4 && normalizedAsin.includes(word)) {
        matchedWords++;
      }
    }
  }
  score += matchedWords * 10;
  if (matchedWords > 0) {
    reasons.push(`Words: ${matchedWords}`);
  }

  // 5. カテゴリ一致ボーナス（同じカテゴリなら+10）
  if (productCategory && productCategory === asinCategory) {
    score += 10;
    reasons.push(`Category: ${productCategory}`);
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join(", ") : "No match"
  };
}

// マッチしたとみなす最小スコア
// brand(20)+3words(30)=50, model(100), brand(20)+partial_model(50)=70 etc.
const MIN_MATCH_SCORE = 50;

// Gemini抽出商品とASIN商品のマッチングを行う（後方互換性のため残す）
export function matchProductWithAsin(
  productName: string,
  productBrand: string | undefined,
  asinTitle: string
): { matched: boolean; reason: string } {
  const { score, reason } = calculateMatchScore(productName, productBrand, asinTitle);
  return {
    matched: score >= MIN_MATCH_SCORE,
    reason: score >= MIN_MATCH_SCORE ? reason : `Score ${score} < ${MIN_MATCH_SCORE}`
  };
}

// 複数のASIN商品から最もマッチするものを選択
export function findBestMatch(
  productName: string,
  productBrand: string | undefined,
  candidates: Array<{ asin: string; title: string; product: unknown }>
): { asin: string; title: string; product: unknown; score: number; reason: string } | null {
  let bestMatch: { asin: string; title: string; product: unknown; score: number; reason: string } | null = null;

  for (const candidate of candidates) {
    const { score, reason } = calculateMatchScore(productName, productBrand, candidate.title);

    console.log(`    [Score] ${candidate.title.substring(0, 50)}... → ${score} (${reason})`);

    if (score >= MIN_MATCH_SCORE && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        asin: candidate.asin,
        title: candidate.title,
        product: candidate.product,
        score,
        reason,
      };
    }
  }

  return bestMatch;
}
