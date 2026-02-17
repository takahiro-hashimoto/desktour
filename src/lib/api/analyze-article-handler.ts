/**
 * 記事解析 API ハンドラ（デスクツアー・撮影機材DB共通）
 *
 * createAnalyzeArticleHandler() でドメイン固有の設定を注入し、
 * 共通の記事解析フローを実行するファクトリパターン。
 *
 * 差異の吸収:
 *   - domain: getDomainConfig() でテーブル名・定数を解決
 *   - enrichTags: camera用タグ補強（subcategory / lensTags / bodyTags）
 *   - extractTags: desktour用タグ抽出（ダイレクトASINマッチ時）
 */

import { NextRequest, NextResponse } from "next/server";
import { getArticleInfo, isDeskTourArticle } from "@/lib/article";
import { analyzeArticle, analyzeOfficialPage } from "@/lib/gemini";
import { getBrandFromDomain } from "@/lib/ogp";
import { getProductsByAsins } from "@/lib/product-search";
import { extractProductsFromDescription, type ExtractedProduct } from "@/lib/description-links";
import type { ProductInfo } from "@/lib/product-search";
import {
  buildCandidates,
  matchProductWithAmazon,
  toAmazonField,
  type MatchedProduct,
  type MatchCandidate,
} from "@/lib/product-matching";
import { checkExistingProducts, findExistingProducts, buildBrandNormalizationMap, getExistingBrandNames } from "@/lib/supabase/queries-common";
import { getDomainConfig, type DomainId } from "@/lib/domain";

// ============================================================
// 設定型
// ============================================================

export interface AnalyzeArticleHandlerConfig {
  domain: DomainId;

  /** Camera用: Amazon情報からタグを補強する関数 */
  enrichTags?: (input: {
    category: string;
    subcategory?: string;
    lensTags?: string[];
    bodyTags?: string[];
    amazonInfo: ProductInfo;
  }) => {
    subcategory?: string;
    lensTags: string[];
    bodyTags: string[];
  };

  /** Desktour用: ダイレクトASINマッチ時のタグ抽出関数 */
  extractTags?: (input: {
    category: string;
    title: string;
    features?: string[];
    technicalInfo?: Record<string, string>;
    amazonCategories?: string[];
    brand?: string;
  }) => string[];
}

// ============================================================
// ヘルパー
// ============================================================

/** Amazon URLからASINを抽出する */
function extractAsinFromUrl(url: string): string | null {
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch) return dpMatch[1].toUpperCase();
  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch) return gpMatch[1].toUpperCase();
  const asinMatch = url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/i);
  if (asinMatch) return asinMatch[1].toUpperCase();
  return null;
}

// ============================================================
// ファクトリ関数
// ============================================================

export function createAnalyzeArticleHandler(handlerConfig: AnalyzeArticleHandlerConfig) {
  const { domain, enrichTags, extractTags } = handlerConfig;

  return async function POST(request: NextRequest) {
    try {
      const config = getDomainConfig(domain);
      const productsTable = config.tables.products as "products" | "products_camera";

      const { url } = await request.json();

      if (!url) {
        return NextResponse.json(
          { error: "URLを入力してください" },
          { status: 400 }
        );
      }

      // URLの形式チェック
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "無効なURLです" },
          { status: 400 }
        );
      }

      // 1. 記事情報を取得
      console.log(`Fetching article: ${url}`);
      const articleInfo = await getArticleInfo(url);
      if (!articleInfo) {
        return NextResponse.json(
          { error: "記事の取得に失敗しました。URLが正しいか確認してください。" },
          { status: 404 }
        );
      }

      console.log(`Article title: ${articleInfo.title}`);
      console.log(`Article content length: ${articleInfo.content.length}`);

      // 3. 関連性チェック（公式サイトはスキップ、ブログ記事のみ警告）
      const isOfficial = articleInfo.sourceType === "official";
      const isRelevant = isOfficial || isDeskTourArticle(articleInfo.title, articleInfo.content);
      if (!isRelevant) {
        console.log(`Warning: Article may not be ${domain} related`);
      }

      // 4. 記事内のEC系リンクからASINを抽出
      console.log("Extracting product links from article...");
      const productLinksText = articleInfo.productLinks.join("\n");
      const articleLinks = await extractProductsFromDescription(productLinksText);
      console.log(`Found ${articleLinks.length} product links in article`);

      // 4.5. 公式サイトリンクから取得した情報を収集
      const officialLinks = articleLinks
        .filter((link): link is ExtractedProduct & { officialInfo: NonNullable<ExtractedProduct["officialInfo"]> } =>
          link.source === "official" && !!link.officialInfo
        );
      console.log(`Found ${officialLinks.length} official site links with OGP info`);

      // 5. 記事内のASINから商品情報を一括取得（Geminiへのヒント用 + マッチング用）
      const asinsFromArticle = articleLinks
        .filter((link): link is ExtractedProduct & { asin: string } => !!link.asin)
        .map(link => link.asin);

      let asinProductMap = new Map<string, ProductInfo | null>();
      if (asinsFromArticle.length > 0) {
        console.log(`Fetching ${asinsFromArticle.length} products by ASIN...`);
        asinProductMap = await getProductsByAsins(asinsFromArticle);
      }

      // 6. Amazon商品タイトルリストをGeminiへのヒントとして作成
      const productHints: string[] = [];
      for (const [, productInfo] of asinProductMap) {
        if (productInfo?.title) {
          productHints.push(productInfo.title);
        }
      }
      // 公式サイトの商品タイトルもヒントに追加
      for (const official of officialLinks) {
        if (official.officialInfo.title) {
          productHints.push(official.officialInfo.title);
        }
      }
      if (productHints.length > 0) {
        console.log(`Providing ${productHints.length} product hints to Gemini`);
      }

      // 6.9. DB登録済みブランド名を取得（Geminiプロンプトで表記揺れ防止に使用）
      console.log("Fetching existing brand names for Gemini prompt...");
      const knownBrands = await getExistingBrandNames(productsTable);
      console.log(`Known brands: ${knownBrands.length} brands`);

      // 7. Gemini APIで解析（公式サイトは専用関数、それ以外は通常解析）
      console.log(`Analyzing ${isOfficial ? "official page" : "article"} with Gemini (${domain} domain)...`);
      let analysisResult;
      if (isOfficial) {
        const brandName = getBrandFromDomain(new URL(url).hostname.replace(/^www\./, "")) || articleInfo.siteName || "";
        analysisResult = await analyzeOfficialPage(articleInfo.content, articleInfo.title, brandName, domain, knownBrands);
      } else {
        analysisResult = await analyzeArticle(articleInfo.content, articleInfo.title, domain, productHints, knownBrands);
      }
      console.log(`Found ${analysisResult.products.length} products`);
      console.log(`Author occupation: ${analysisResult.influencerOccupation}`);

      // 7. DB既存商品ルックアップ（過去の登録データを「学習データ」として再利用）
      const productsForLookup = analysisResult.products
        .filter(p => p.name && (p.confidence === "high" || p.confidence === "medium"));
      const productNamesForLookup = productsForLookup.map(p => p.name);
      const productMetaForLookup = productsForLookup.map(p => ({ name: p.name, category: p.category, brand: p.brand }));
      const existingProductMap = await findExistingProducts(productNamesForLookup, productsTable, productMetaForLookup);
      console.log(`DB existing product matches: ${existingProductMap.size} / ${productNamesForLookup.length}`);

      // 7.5. ブランド名の正規化（DB既存ブランドを正とし、表記揺れを解消）
      const rawBrands = analysisResult.products
        .map(p => p.brand)
        .filter((b): b is string => !!b);
      const brandNormMap = await buildBrandNormalizationMap(rawBrands, productsTable);
      if (brandNormMap.size > 0) {
        console.log(`Brand normalization: ${brandNormMap.size} brands mapped`);
        for (const product of analysisResult.products) {
          if (product.brand && brandNormMap.has(product.brand)) {
            const normalized = brandNormMap.get(product.brand)!;
            if (normalized !== product.brand) {
              console.log(`  Brand: "${product.brand}" → "${normalized}"`);
              product.brand = normalized;
            }
          }
        }
      }

      // 8. 商品のAmazon/楽天マッチング（プレビュー・保存共通）
      console.log("Matching products with Amazon/Rakuten...");

      const matchedProducts: MatchedProduct[] = [];
      const candidates = buildCandidates(asinProductMap);
      const usedAsins = new Set<string>();

      for (const product of analysisResult.products) {
        console.log(`Processing product: ${product.name} (brand: ${product.brand})`);

        if (product.confidence === "high" || product.confidence === "medium") {
          // ★最優先: DB既存商品マッチ（過去に登録済みの商品を再利用）
          const existingMatch = existingProductMap.get(product.name);
          if (existingMatch && (existingMatch.asin || existingMatch.amazon_url)) {
            console.log(`  ✓ DB existing match: "${product.name}" → ${existingMatch.asin || existingMatch.amazon_url} (${existingMatch.amazon_title?.substring(0, 50) || existingMatch.name})`);
            if (existingMatch.asin) usedAsins.add(existingMatch.asin);
            matchedProducts.push({
              name: product.name,
              brand: product.brand || existingMatch.brand || undefined,
              category: product.category,
              ...(config.search.hasSubcategory && { subcategory: product.subcategory }),
              ...(config.search.hasLensTags && { lensTags: product.lensTags }),
              ...(config.search.hasBodyTags && { bodyTags: product.bodyTags }),
              reason: product.reason,
              confidence: product.confidence,
              tags: existingMatch.tags || undefined,
              amazon: existingMatch.amazon_url ? {
                asin: existingMatch.asin || "",
                title: existingMatch.amazon_title || existingMatch.name,
                url: existingMatch.amazon_url,
                imageUrl: existingMatch.amazon_image_url || "",
                price: existingMatch.amazon_price || undefined,
              } : null,
              source: (existingMatch.product_source as "amazon" | "rakuten") || undefined,
              matchScore: 300,
              matchReason: `DB existing: ${existingMatch.asin || existingMatch.amazon_url}`,
              isExisting: true,
            });
            continue;
          }

          // 2番目: GeminiがamazonUrlを返している場合はASINダイレクトマッチを試みる
          let directMatchInfo: ProductInfo | null = null;
          let directMatchReason = "";
          if (product.amazonUrl) {
            const directAsin = extractAsinFromUrl(product.amazonUrl);
            if (directAsin && asinProductMap.has(directAsin) && !usedAsins.has(directAsin)) {
              directMatchInfo = asinProductMap.get(directAsin) || null;
              if (directMatchInfo) {
                usedAsins.add(directAsin);
                directMatchReason = `Direct ASIN: ${directAsin}`;
                console.log(`  ✓ Direct ASIN match: ${directAsin} → ${directMatchInfo.title.substring(0, 50)}`);
              }
            }
          }

          if (directMatchInfo) {
            // ダイレクトマッチ成功
            if (enrichTags) {
              // Camera: Amazon情報からタグを補強
              const enrichment = enrichTags({
                category: product.category,
                subcategory: product.subcategory,
                lensTags: product.lensTags,
                bodyTags: product.bodyTags,
                amazonInfo: directMatchInfo,
              });
              matchedProducts.push({
                name: product.name,
                brand: product.brand,
                category: product.category,
                subcategory: enrichment.subcategory || product.subcategory,
                lensTags: enrichment.lensTags.length > 0 ? enrichment.lensTags : product.lensTags,
                bodyTags: enrichment.bodyTags.length > 0 ? enrichment.bodyTags : product.bodyTags,
                reason: product.reason,
                confidence: product.confidence,
                tags: undefined,
                amazon: toAmazonField(directMatchInfo),
                source: directMatchInfo.source,
                matchScore: 200,
                matchReason: directMatchReason,
              });
            } else {
              // Desktour: タグ抽出してそのまま使用
              let productTags: string[] | undefined;
              if (extractTags) {
                productTags = extractTags({
                  category: product.category,
                  title: directMatchInfo.title,
                  features: directMatchInfo.features,
                  technicalInfo: directMatchInfo.technicalInfo,
                  amazonCategories: directMatchInfo.amazonCategories,
                  brand: directMatchInfo.brand,
                });
                if (productTags.length === 0) productTags = undefined;
              }
              matchedProducts.push({
                name: product.name,
                brand: product.brand,
                category: product.category,
                reason: product.reason,
                confidence: product.confidence,
                tags: productTags,
                amazon: toAmazonField(directMatchInfo),
                source: directMatchInfo.source,
                matchScore: 200,
                matchReason: directMatchReason,
              });
            }
          } else {
            // フォールバック: 従来のスコアベースマッチング
            const result = await matchProductWithAmazon({
              productName: product.name,
              productBrand: product.brand,
              productCategory: product.category,
              candidates,
              usedAsins,
            });

            let { amazonInfo, matchReason } = result;

            // API検索でも見つからない場合のみ公式サイトを使用（フォールバック）
            if (!amazonInfo && officialLinks.length > 0) {
              const normalizedProductName = product.name.toLowerCase();
              for (const official of officialLinks) {
                const officialTitle = (official.officialInfo.title || "").toLowerCase();
                const productWords = normalizedProductName.split(/\s+/).filter(w => w.length > 2);
                const matchedWords = productWords.filter(w => officialTitle.includes(w));
                if (matchedWords.length >= Math.min(2, productWords.length)) {
                  console.log(`  [Official Fallback] ${official.officialInfo.domain}: ${official.officialInfo.title}`);
                  amazonInfo = {
                    id: `official-${official.officialInfo.domain}`,
                    title: official.officialInfo.title || product.name,
                    url: official.officialInfo.url,
                    imageUrl: official.officialInfo.image || "",
                    source: "amazon" as const,
                  };
                  matchReason = `Official (fallback): ${official.officialInfo.domain}`;
                  break;
                }
              }
            }

            // Camera tag enrichment (enrichTags が設定されている場合 + Amazon情報がある場合)
            let enrichedSubcategory = product.subcategory;
            let enrichedLensTags = product.lensTags;
            let enrichedBodyTags = product.bodyTags;

            if (enrichTags && result.amazonInfo) {
              const enrichment = enrichTags({
                category: product.category,
                subcategory: product.subcategory,
                lensTags: product.lensTags,
                bodyTags: product.bodyTags,
                amazonInfo: result.amazonInfo,
              });
              if (enrichment.lensTags.length > 0) enrichedLensTags = enrichment.lensTags;
              if (enrichment.bodyTags.length > 0) enrichedBodyTags = enrichment.bodyTags;
              if (enrichment.subcategory) enrichedSubcategory = enrichment.subcategory;
            }

            matchedProducts.push({
              name: product.name,
              brand: product.brand,
              category: product.category,
              ...(config.search.hasSubcategory && { subcategory: enrichedSubcategory }),
              ...(config.search.hasLensTags && { lensTags: enrichedLensTags }),
              ...(config.search.hasBodyTags && { bodyTags: enrichedBodyTags }),
              reason: product.reason,
              confidence: product.confidence,
              tags: result.productTags,
              amazon: toAmazonField(amazonInfo),
              source: amazonInfo?.source,
              matchScore: result.matchScore,
              matchReason,
            });
          }
        } else {
          // low confidence — マッチングなし
          matchedProducts.push({
            name: product.name,
            brand: product.brand,
            category: product.category,
            ...(config.search.hasSubcategory && { subcategory: product.subcategory }),
            ...(config.search.hasLensTags && { lensTags: product.lensTags }),
            ...(config.search.hasBodyTags && { bodyTags: product.bodyTags }),
            reason: product.reason,
            confidence: product.confidence,
          });
        }
      }

      // 既存商品チェック（プレビュー用）
      // マッチング中にファジーマッチ等で isExisting: true が付いた商品はそのまま維持
      const existingMap = await checkExistingProducts(
        matchedProducts.filter(p => !p.isExisting).map(p => p.name),
        productsTable
      );
      const productsWithExisting = matchedProducts.map(p => ({
        ...p,
        isExisting: p.isExisting || !!existingMap[p.name],
      }));

      return NextResponse.json({
        success: true,
        articleInfo: {
          url: articleInfo.url,
          title: articleInfo.title,
          author: articleInfo.author,
          authorUrl: articleInfo.authorUrl,
          sourceType: articleInfo.sourceType,
          siteName: articleInfo.siteName,
          thumbnailUrl: articleInfo.thumbnailUrl,
          publishedAt: articleInfo.publishedAt,
          contentLength: articleInfo.content.length,
          productLinks: articleInfo.productLinks,
        },
        analysis: {
          ...analysisResult,
          // プレビュー用にマッチング済み商品情報を含める
          products: productsWithExisting,
        },
        isRelevant,
      });
    } catch (error) {
      console.error(`${domain} article analysis error:`, error);
      return NextResponse.json(
        { error: "解析中にエラーが発生しました" },
        { status: 500 }
      );
    }
  };
}
