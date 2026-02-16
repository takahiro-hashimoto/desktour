import { getBrandAliases, detectCategory } from "./brand-category-utils";

// ========================================
// 環境変数
// ========================================
const amazonPartnerTag = process.env.AMAZON_PARTNER_TAG!;

// Creators API 認証情報
const creatorsCredentialId = process.env.AMAZON_CREATORS_CREDENTIAL_ID!;
const creatorsCredentialSecret = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET!;
const creatorsVersion = process.env.AMAZON_CREATORS_VERSION || "2.3";

const rakutenAppId = process.env.RAKUTEN_APP_ID!;
const rakutenAffiliateId = process.env.RAKUTEN_AFFILIATE_ID;

// スコア閾値（0.5に調整 — 日本語商品名・文字起こしからの検索に対応）
const SCORE_THRESHOLD = 0.5;

// ========================================
// 型定義
// ========================================
export interface ProductInfo {
  id: string;              // ASIN or 楽天itemCode
  title: string;
  url: string;
  imageUrl: string;
  price?: number;
  source: "amazon" | "rakuten";
  // 詳細スペック情報
  manufacturer?: string;
  brand?: string;
  modelNumber?: string;
  color?: string;
  size?: string;
  weight?: string;
  releaseDate?: string;
  features?: string[];
  technicalInfo?: Record<string, string>;
  shopName?: string;       // 楽天用
  // カテゴリ情報（Amazon）
  amazonCategories?: string[];  // カテゴリ階層（例: ["パソコン・周辺機器", "キーボード", "メカニカルキーボード"]）
  productGroup?: string;        // 商品グループ（例: "Personal Computer"）
}

// ========================================
// ノーブランド定義
// ========================================
const NO_BRAND_KEYWORDS = [
  "ノーブランド", "ノーブランド品", "generic", "unbranded", "no brand",
  "汎用", "互換品", "オリジナル"
];

// ========================================
// ユーティリティ関数
// ========================================
function isNoBrandProduct(brand?: string, manufacturer?: string): boolean {
  if (!brand && !manufacturer) return true;
  const checkText = `${brand || ""} ${manufacturer || ""}`.toLowerCase();
  return NO_BRAND_KEYWORDS.some(kw => checkText.includes(kw.toLowerCase()));
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[\s\-_]/g, "");
  const s2 = str2.toLowerCase().replace(/[\s\-_]/g, "");

  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length < s2.length ? s2 : s1;

  if (shorter.length === 0) return 0;
  if (s1 === s2) return 1.5;
  if (longer.includes(shorter)) {
    return shorter.length / longer.length + 0.3;
  }

  const words1 = str1.toLowerCase().split(/[\s\-_\/]+/).filter(w => w.length > 1);
  const words2 = str2.toLowerCase().split(/[\s\-_\/]+/).filter(w => w.length > 1);

  let matchCount = 0;
  for (const word of words1) {
    if (words2.some(w2 => w2.includes(word) || word.includes(w2))) {
      matchCount++;
    }
  }

  return matchCount / Math.max(words1.length, 1);
}

function isRelevantProduct(
  searchQuery: string,
  productTitle: string,
  productBrand?: string,
  productManufacturer?: string,
  extractedBrand?: string
): { isRelevant: boolean; score: number; reason: string } {
  const titleLower = productTitle.toLowerCase();

  // 1. ノーブランド品は除外
  if (isNoBrandProduct(productBrand, productManufacturer)) {
    return { isRelevant: false, score: 0, reason: "No-brand product excluded" };
  }

  // 2. カテゴリのミスマッチチェック
  const queryCategory = detectCategory(searchQuery);
  const resultCategory = detectCategory(productTitle);
  if (queryCategory && resultCategory && queryCategory !== resultCategory) {
    return {
      isRelevant: false,
      score: 0,
      reason: `Category mismatch: searching for ${queryCategory}, got ${resultCategory}`
    };
  }

  // 3. ブランド名の一致チェック（日英エイリアス対応、緩和版）
  let brandMatched = false;
  if (extractedBrand) {
    const brandAliases = getBrandAliases(extractedBrand);
    const productBrandLower = (productBrand || "").toLowerCase().replace(/[\s\-_]/g, "");
    const titleNormalized = titleLower.replace(/[\s\-_]/g, "");

    // エイリアスを含めてブランドチェック
    brandMatched = brandAliases.some(alias => {
      const aliasNormalized = alias.replace(/[\s\-_]/g, "");
      return productBrandLower.includes(aliasNormalized) ||
             aliasNormalized.includes(productBrandLower) ||
             titleNormalized.includes(aliasNormalized);
    });

    // ブランドが一致しなくてもスコア計算は続行（ペナルティとして扱う）
    // 完全に除外するのではなく、スコアで判断する
  }

  // 4. 型番やモデル名を抽出
  const modelPattern = /[A-Z0-9]{2,}[-]?[A-Z0-9]*/gi;
  const queryModels = searchQuery.match(modelPattern) || [];
  const titleModels = productTitle.match(modelPattern) || [];

  let modelMatch = false;
  let exactModelMatch = false;
  for (const qModel of queryModels) {
    if (qModel.length >= 2) {
      for (const tModel of titleModels) {
        if (tModel.toLowerCase() === qModel.toLowerCase()) {
          exactModelMatch = true;
          modelMatch = true;
          break;
        }
        if (tModel.toLowerCase().includes(qModel.toLowerCase()) ||
            qModel.toLowerCase().includes(tModel.toLowerCase())) {
          modelMatch = true;
        }
      }
    }
  }

  // 5. タイトルの類似度計算
  const similarity = calculateSimilarity(searchQuery, productTitle);

  // 6. スコア計算
  let score = similarity;

  // 型番一致ボーナス
  if (exactModelMatch) score += 0.6;
  else if (modelMatch) score += 0.3;

  // ブランド一致ボーナス（エイリアス対応済みの結果を使用）
  if (brandMatched) {
    score += 0.3;
  } else if (extractedBrand) {
    // ブランドが指定されているが一致しない場合はペナルティ
    score -= 0.2;
  }

  // 7. 閾値チェック
  if (score >= SCORE_THRESHOLD) {
    return { isRelevant: true, score, reason: `Score: ${score.toFixed(2)} (threshold: ${SCORE_THRESHOLD})${brandMatched ? " [brand matched]" : ""}` };
  }

  return { isRelevant: false, score, reason: `Low similarity score: ${score.toFixed(2)} < ${SCORE_THRESHOLD}` };
}

// ========================================
// Amazon Creators API 認証
// ========================================
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  // キャッシュが有効なら再利用
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  console.log("[Creators API] Fetching new access token...");

  const response = await fetch(
    "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${creatorsCredentialId}&client_secret=${creatorsCredentialSecret}&scope=creatorsapi/default`,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Creators API] Token fetch failed:", response.status, errorText);
    throw new Error(`Token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  // 有効期限の1分前に更新するようにする
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  console.log("[Creators API] Access token obtained successfully");
  return cachedAccessToken!;
}

async function callCreatorsApi(endpoint: string, payload: object): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(`https://creatorsapi.amazon${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}, Version ${creatorsVersion}`,
      "Content-Type": "application/json",
      "x-marketplace": "www.amazon.co.jp",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Creators API] Error: ${response.status}`, errorText);
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// ========================================
// Amazon Creators API - SearchItems
// ========================================
async function searchAmazonOnly(
  productName: string,
  brand?: string,
  category?: string
): Promise<{ product: ProductInfo | null; bestScore: number }> {
  if (!creatorsCredentialId || !creatorsCredentialSecret || !amazonPartnerTag) {
    console.error("Amazon Creators API credentials not configured");
    return { product: null, bestScore: -1 };
  }

  try {
    console.log(`[Amazon] Searching for: ${productName}${brand ? ` (brand: ${brand})` : ""}`);

    const searchKeywords = brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;

    const payload = {
      keywords: searchKeywords,
      partnerTag: amazonPartnerTag,
      marketplace: "www.amazon.co.jp",
      searchIndex: "All",
      itemCount: 5,
      resources: [
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "itemInfo.manufactureInfo",
        "itemInfo.productInfo",
        "itemInfo.technicalInfo",
        "itemInfo.features",
        "itemInfo.contentInfo",
        "itemInfo.classifications",
        "browseNodeInfo.browseNodes",
        "browseNodeInfo.browseNodes.ancestor",
        "offersV2.listings.price",
        "images.primary.large",
      ],
    };

    const data = await callCreatorsApi("/catalog/v1/searchItems", payload);

    if (!data.searchResult?.items?.length) {
      console.log(`[Amazon] No results for: ${productName}`);
      return { product: null, bestScore: -1 };
    }

    let bestItem = null;
    let bestScore = -1;
    let bestReason = "";

    for (const candidate of data.searchResult.items) {
      const candidateTitle = candidate.itemInfo?.title?.displayValue || "";
      const candidateBrand = candidate.itemInfo?.byLineInfo?.brand?.displayValue;
      const candidateManufacturer = candidate.itemInfo?.byLineInfo?.manufacturer?.displayValue;

      const { isRelevant, score, reason } = isRelevantProduct(
        productName,
        candidateTitle,
        candidateBrand,
        candidateManufacturer,
        brand
      );

      console.log(`  [Amazon] Candidate: "${candidateTitle.slice(0, 50)}..." - Score: ${score.toFixed(2)}, Relevant: ${isRelevant}`);

      if (score > bestScore) {
        bestScore = score;
        if (isRelevant) {
          bestItem = candidate;
          bestReason = reason;
        }
      }
    }

    if (!bestItem) {
      console.log(`[Amazon] No relevant product found (best score: ${bestScore.toFixed(2)})`);
      return { product: null, bestScore };
    }

    console.log(`[Amazon] Selected: ${bestReason}`);

    const item = bestItem;
    const itemInfo = item.itemInfo;

    const technicalInfo: Record<string, string> = {};
    if (itemInfo?.technicalInfo?.technicalDetails) {
      for (const detail of itemInfo.technicalInfo.technicalDetails) {
        if (detail.name && detail.value) {
          technicalInfo[detail.name] = detail.value;
        }
      }
    }

    const features: string[] = [];
    if (itemInfo?.features?.displayValues) {
      features.push(...itemInfo.features.displayValues);
    }

    let size: string | undefined;
    const productInfo = itemInfo?.productInfo;
    if (productInfo?.itemDimensions) {
      const dims = productInfo.itemDimensions;
      const parts: string[] = [];
      if (dims.width?.displayValue) parts.push(`W${dims.width.displayValue}${dims.width.unit || ''}`);
      if (dims.height?.displayValue) parts.push(`H${dims.height.displayValue}${dims.height.unit || ''}`);
      if (dims.length?.displayValue) parts.push(`D${dims.length.displayValue}${dims.length.unit || ''}`);
      if (parts.length > 0) size = parts.join(' x ');
    }

    let weight: string | undefined;
    if (productInfo?.itemDimensions?.weight?.displayValue) {
      weight = `${productInfo.itemDimensions.weight.displayValue}${productInfo.itemDimensions.weight.unit || ''}`;
    }

    // カテゴリ階層を取得
    const amazonCategories: string[] = [];
    if (item.browseNodeInfo?.browseNodes) {
      for (const node of item.browseNodeInfo.browseNodes) {
        // 祖先ノードを辿ってカテゴリ階層を構築
        const categoryPath: string[] = [];
        if (node.displayName) {
          categoryPath.push(node.displayName);
        }
        let ancestor = node.ancestor;
        while (ancestor) {
          if (ancestor.displayName) {
            categoryPath.unshift(ancestor.displayName);
          }
          ancestor = ancestor.ancestor;
        }
        if (categoryPath.length > 0) {
          amazonCategories.push(categoryPath.join(" > "));
        }
      }
    }

    // 商品グループ（Classifications）を取得
    const productGroup = itemInfo?.classifications?.productGroup?.displayValue;

    const result: ProductInfo = {
      id: item.asin,
      title: itemInfo?.title?.displayValue || productName,
      url: item.detailPageURL,
      imageUrl: item.images?.primary?.large?.url || "",
      price: item.offersV2?.listings?.[0]?.price?.money?.amount,
      source: "amazon",
      manufacturer: itemInfo?.byLineInfo?.manufacturer?.displayValue,
      brand: itemInfo?.byLineInfo?.brand?.displayValue,
      modelNumber: itemInfo?.manufactureInfo?.model?.displayValue,
      color: productInfo?.color?.displayValue,
      size,
      weight,
      releaseDate: itemInfo?.contentInfo?.publicationDate?.displayValue
        || itemInfo?.productInfo?.releaseDate?.displayValue,
      features: features.length > 0 ? features : undefined,
      technicalInfo: Object.keys(technicalInfo).length > 0 ? technicalInfo : undefined,
      amazonCategories: amazonCategories.length > 0 ? amazonCategories : undefined,
      productGroup,
    };

    console.log(`[Amazon] Found: ${result.title} (${result.id})${result.price ? ` ¥${result.price}` : ""}${amazonCategories.length > 0 ? ` [categories: ${amazonCategories[0]}]` : ""}`);
    return { product: result, bestScore };

  } catch (error) {
    console.error("[Amazon] Error:", error);
    return { product: null, bestScore: -1 };
  }
}

// ========================================
// 楽天 API
// ========================================
async function searchRakutenOnly(
  productName: string,
  brand?: string,
  category?: string
): Promise<{ product: ProductInfo | null; bestScore: number }> {
  if (!rakutenAppId) {
    console.error("Rakuten API credentials not configured");
    return { product: null, bestScore: -1 };
  }

  try {
    console.log(`[Rakuten] Searching for: ${productName}${brand ? ` (brand: ${brand})` : ""}`);

    const searchKeywords = brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;

    const params = new URLSearchParams({
      applicationId: rakutenAppId,
      keyword: searchKeywords,
      hits: "10",
      formatVersion: "2",
      imageFlag: "1",
    });

    if (rakutenAffiliateId) {
      params.append("affiliateId", rakutenAffiliateId);
    }

    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Rakuten] API error: ${response.status}`, errorText);
      return { product: null, bestScore: -1 };
    }

    const data = await response.json();

    if (!data.Items?.length) {
      console.log(`[Rakuten] No results for: ${productName}`);
      return { product: null, bestScore: -1 };
    }

    let bestItem = null;
    let bestScore = -1;

    for (const item of data.Items) {
      const itemTitle = item.itemName || "";
      // 楽天はブランド情報が薄いので、ショップ名をブランドとして扱う場合もある
      const itemBrand = item.shopName;

      const { isRelevant, score, reason } = isRelevantProduct(
        productName,
        itemTitle,
        itemBrand,
        undefined,
        brand
      );

      console.log(`  [Rakuten] Candidate: "${itemTitle.slice(0, 50)}..." - Score: ${score.toFixed(2)}, Relevant: ${isRelevant}`);

      if (score > bestScore) {
        bestScore = score;
        if (isRelevant) {
          bestItem = item;
        }
      }
    }

    if (!bestItem) {
      console.log(`[Rakuten] No relevant product found (best score: ${bestScore.toFixed(2)})`);
      return { product: null, bestScore };
    }

    const result: ProductInfo = {
      id: bestItem.itemCode,
      title: bestItem.itemName,
      url: bestItem.affiliateUrl || bestItem.itemUrl,
      imageUrl: bestItem.mediumImageUrls?.[0] || "",
      price: bestItem.itemPrice,
      source: "rakuten",
      shopName: bestItem.shopName,
    };

    console.log(`[Rakuten] Found: ${result.title}`);
    return { product: result, bestScore };

  } catch (error) {
    console.error("[Rakuten] Error:", error);
    return { product: null, bestScore: -1 };
  }
}

// ========================================
// メイン検索関数（Amazon → 楽天フォールバック）
// ========================================
export async function searchAmazonProduct(
  productName: string,
  brand?: string,
  category?: string
): Promise<ProductInfo | null> {
  // 1. まずAmazonで検索
  const amazonResult = await searchAmazonOnly(productName, brand, category);

  if (amazonResult.product) {
    return amazonResult.product;
  }

  // 2. Amazonで見つからない or スコアが低い場合、楽天で検索
  console.log(`[Fallback] Trying Rakuten (Amazon best score: ${amazonResult.bestScore.toFixed(2)})`);

  // レート制限対策
  await new Promise(resolve => setTimeout(resolve, 500));

  const rakutenResult = await searchRakutenOnly(productName, brand, category);

  if (rakutenResult.product) {
    return rakutenResult.product;
  }

  // 3. どちらでも見つからない場合
  console.log(`[Search] No product found for: ${productName}`);
  return null;
}

// Amazon候補一覧を返す（モーダル用）
export async function searchAmazonCandidates(
  productName: string,
  brand?: string,
): Promise<ProductInfo[]> {
  if (!creatorsCredentialId || !creatorsCredentialSecret || !amazonPartnerTag) {
    return [];
  }

  try {
    const searchKeywords = brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;

    const payload = {
      keywords: searchKeywords,
      partnerTag: amazonPartnerTag,
      marketplace: "www.amazon.co.jp",
      searchIndex: "All",
      itemCount: 10,
      resources: [
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "itemInfo.manufactureInfo",
        "offersV2.listings.price",
        "images.primary.large",
      ],
    };

    const data = await callCreatorsApi("/catalog/v1/searchItems", payload);

    if (!data.searchResult?.items?.length) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.searchResult.items.map((item: any) => {
      const itemInfo = item.itemInfo;
      return {
        id: item.asin as string,
        title: (itemInfo?.title?.displayValue as string) || productName,
        url: item.detailPageURL as string,
        imageUrl: item.images?.primary?.large?.url || "",
        price: item.offersV2?.listings?.[0]?.price?.money?.amount as number | undefined,
        source: "amazon" as const,
        brand: itemInfo?.byLineInfo?.brand?.displayValue as string | undefined,
        manufacturer: itemInfo?.byLineInfo?.manufacturer?.displayValue as string | undefined,
        modelNumber: itemInfo?.manufactureInfo?.model?.displayValue as string | undefined,
      };
    });
  } catch (error) {
    console.error("[Amazon] Candidates search error:", error);
    return [];
  }
}

// 楽天候補一覧を返す（モーダル用）
export async function searchRakutenCandidates(
  productName: string,
  brand?: string,
): Promise<ProductInfo[]> {
  if (!rakutenAppId) {
    console.error("Rakuten API credentials not configured");
    return [];
  }

  try {
    const searchKeywords = brand && !productName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName;

    const params = new URLSearchParams({
      applicationId: rakutenAppId,
      keyword: searchKeywords,
      hits: "10",
      formatVersion: "2",
      imageFlag: "1",
    });

    if (rakutenAffiliateId) {
      params.append("affiliateId", rakutenAffiliateId);
    }

    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Rakuten] Candidates API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.Items?.length) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.Items.map((item: any) => ({
      id: item.itemCode as string,
      title: item.itemName as string,
      url: item.itemUrl as string,
      imageUrl: (item.mediumImageUrls?.[0] || "") as string,
      price: item.itemPrice as number | undefined,
      source: "rakuten" as const,
      shopName: item.shopName as string | undefined,
      brand: item.shopName as string | undefined,
    }));
  } catch (error) {
    console.error("[Rakuten] Candidates search error:", error);
    return [];
  }
}

// 複数商品を一括検索（レート制限対策で間隔を空ける）
export async function searchAmazonProducts(
  productNames: string[]
): Promise<Map<string, ProductInfo | null>> {
  const results = new Map<string, ProductInfo | null>();

  for (const name of productNames) {
    const result = await searchAmazonProduct(name);
    results.set(name, result);

    // レート制限対策: 1秒間隔
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

// ========================================
// ASINから直接商品情報を取得（GetItems API）
// ========================================
export async function getProductByAsin(asin: string): Promise<ProductInfo | null> {
  if (!creatorsCredentialId || !creatorsCredentialSecret || !amazonPartnerTag) {
    console.error("[GetItems] Amazon Creators API credentials not configured");
    return null;
  }

  try {
    console.log(`[GetItems] Fetching product by ASIN: ${asin}`);

    const payload = {
      itemIds: [asin],
      itemIdType: "ASIN",
      partnerTag: amazonPartnerTag,
      marketplace: "www.amazon.co.jp",
      resources: [
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "itemInfo.manufactureInfo",
        "itemInfo.productInfo",
        "itemInfo.features",
        "offersV2.listings.price",
        "images.primary.large",
      ],
    };

    const data = await callCreatorsApi("/catalog/v1/getItems", payload);

    if (!data.itemsResult?.items?.length) {
      console.log(`[GetItems] No item found for ASIN: ${asin}`);
      return null;
    }

    const item = data.itemsResult.items[0];
    const itemInfo = item.itemInfo;
    const productInfo = itemInfo?.productInfo;

    // サイズ情報
    let size: string | undefined;
    if (productInfo?.itemDimensions) {
      const dims = productInfo.itemDimensions;
      const parts: string[] = [];
      if (dims.width?.displayValue) parts.push(`W${dims.width.displayValue}${dims.width.unit || ""}`);
      if (dims.height?.displayValue) parts.push(`H${dims.height.displayValue}${dims.height.unit || ""}`);
      if (dims.length?.displayValue) parts.push(`D${dims.length.displayValue}${dims.length.unit || ""}`);
      if (parts.length > 0) size = parts.join(" x ");
    }

    // 重量情報
    let weight: string | undefined;
    if (productInfo?.itemDimensions?.weight?.displayValue) {
      weight = `${productInfo.itemDimensions.weight.displayValue}${productInfo.itemDimensions.weight.unit || ""}`;
    }

    // 特徴リスト
    const features: string[] = [];
    if (itemInfo?.features?.displayValues) {
      features.push(...itemInfo.features.displayValues);
    }

    const result: ProductInfo = {
      id: item.asin,
      title: itemInfo?.title?.displayValue || asin,
      url: item.detailPageURL,
      imageUrl: item.images?.primary?.large?.url || "",
      price: item.offersV2?.listings?.[0]?.price?.money?.amount,
      source: "amazon",
      manufacturer: itemInfo?.byLineInfo?.manufacturer?.displayValue,
      brand: itemInfo?.byLineInfo?.brand?.displayValue,
      modelNumber: itemInfo?.manufactureInfo?.model?.displayValue,
      color: productInfo?.color?.displayValue,
      size,
      weight,
      features: features.length > 0 ? features : undefined,
    };

    console.log(`[GetItems] Found: ${result.title}${result.price ? ` ¥${result.price}` : ""}`);
    return result;

  } catch (error) {
    console.error("[GetItems] Error:", error);
    return null;
  }
}

// 複数ASINを一括取得（最大10件まで）
export async function getProductsByAsins(asins: string[]): Promise<Map<string, ProductInfo | null>> {
  const results = new Map<string, ProductInfo | null>();

  if (!creatorsCredentialId || !creatorsCredentialSecret || !amazonPartnerTag) {
    console.error("[GetItems] Amazon Creators API credentials not configured");
    return results;
  }

  // Creators APIは1リクエストで最大10件まで
  const batchSize = 10;
  for (let i = 0; i < asins.length; i += batchSize) {
    const batch = asins.slice(i, i + batchSize);

    try {
      console.log(`[GetItems] Fetching batch of ${batch.length} ASINs`);

      const payload = {
        itemIds: batch,
        itemIdType: "ASIN",
        partnerTag: amazonPartnerTag,
        marketplace: "www.amazon.co.jp",
        resources: [
          "itemInfo.title",
          "itemInfo.byLineInfo",
          "itemInfo.manufactureInfo",
          "itemInfo.productInfo",
          "itemInfo.technicalInfo",
          "itemInfo.features",
          "itemInfo.contentInfo",
          "itemInfo.classifications",
          "browseNodeInfo.browseNodes",
          "browseNodeInfo.browseNodes.ancestor",
          "offersV2.listings.price",
          "images.primary.large",
        ],
      };

      const data = await callCreatorsApi("/catalog/v1/getItems", payload);

      // 結果をマッピング
      const itemsMap = new Map<string, typeof data.itemsResult.items[0]>();
      if (data.itemsResult?.items) {
        for (const item of data.itemsResult.items) {
          itemsMap.set(item.asin, item);
        }
      }

      for (const asin of batch) {
        const item = itemsMap.get(asin);
        if (!item) {
          results.set(asin, null);
          continue;
        }

        const itemInfo = item.itemInfo;
        const productInfo = itemInfo?.productInfo;

        // 特徴リスト
        const features: string[] = [];
        if (itemInfo?.features?.displayValues) {
          features.push(...itemInfo.features.displayValues);
        }

        // 技術仕様
        const technicalInfo: Record<string, string> = {};
        if (itemInfo?.technicalInfo?.technicalDetails) {
          for (const detail of itemInfo.technicalInfo.technicalDetails) {
            if (detail.name && detail.value) {
              technicalInfo[detail.name] = detail.value;
            }
          }
        }

        // サイズ情報
        let size: string | undefined;
        if (productInfo?.itemDimensions) {
          const dims = productInfo.itemDimensions;
          const parts: string[] = [];
          if (dims.width?.displayValue) parts.push(`W${dims.width.displayValue}${dims.width.unit || ""}`);
          if (dims.height?.displayValue) parts.push(`H${dims.height.displayValue}${dims.height.unit || ""}`);
          if (dims.length?.displayValue) parts.push(`D${dims.length.displayValue}${dims.length.unit || ""}`);
          if (parts.length > 0) size = parts.join(" x ");
        }

        // 重量情報
        let weight: string | undefined;
        if (productInfo?.itemDimensions?.weight?.displayValue) {
          weight = `${productInfo.itemDimensions.weight.displayValue}${productInfo.itemDimensions.weight.unit || ""}`;
        }

        // カテゴリ階層を取得
        const amazonCategories: string[] = [];
        if (item.browseNodeInfo?.browseNodes) {
          for (const node of item.browseNodeInfo.browseNodes) {
            const categoryPath: string[] = [];
            if (node.displayName) {
              categoryPath.push(node.displayName);
            }
            let ancestor = node.ancestor;
            while (ancestor) {
              if (ancestor.displayName) {
                categoryPath.unshift(ancestor.displayName);
              }
              ancestor = ancestor.ancestor;
            }
            if (categoryPath.length > 0) {
              amazonCategories.push(categoryPath.join(" > "));
            }
          }
        }

        // 商品グループ（Classifications）を取得
        const productGroup = itemInfo?.classifications?.productGroup?.displayValue;

        results.set(asin, {
          id: item.asin,
          title: itemInfo?.title?.displayValue || asin,
          url: item.detailPageURL,
          imageUrl: item.images?.primary?.large?.url || "",
          price: item.offersV2?.listings?.[0]?.price?.money?.amount,
          source: "amazon",
          manufacturer: itemInfo?.byLineInfo?.manufacturer?.displayValue,
          brand: itemInfo?.byLineInfo?.brand?.displayValue,
          modelNumber: itemInfo?.manufactureInfo?.model?.displayValue,
          color: productInfo?.color?.displayValue,
          size,
          weight,
          releaseDate: itemInfo?.contentInfo?.publicationDate?.displayValue
            || productInfo?.releaseDate?.displayValue,
          features: features.length > 0 ? features : undefined,
          technicalInfo: Object.keys(technicalInfo).length > 0 ? technicalInfo : undefined,
          amazonCategories: amazonCategories.length > 0 ? amazonCategories : undefined,
          productGroup,
        });
      }

      // レート制限対策
      if (i + batchSize < asins.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error("[GetItems] Batch error:", error);
      batch.forEach(asin => results.set(asin, null));
    }
  }

  return results;
}
