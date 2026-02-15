/**
 * Unified video analysis handler (factory pattern)
 *
 * Merges the duplicated logic from:
 *   - /api/analyze/route.ts          (desktour)
 *   - /api/camera/analyze/route.ts   (camera)
 *
 * Domain-specific behaviour is controlled by AnalyzeHandlerConfig.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  extractVideoId,
  getVideoInfo,
  getTranscript,
} from "@/lib/youtube";
import { analyzeTranscript } from "@/lib/gemini";
import { getPriceRange } from "@/lib/gemini";
import { getProductsByAsins } from "@/lib/product-search";
import {
  extractProductsFromDescription,
  ExtractedProduct,
} from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import { isExcludedBrand } from "@/lib/excluded-brands";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import {
  buildCandidates,
  matchProductWithAmazon,
  toAmazonField,
  type MatchedProduct,
} from "@/lib/product-matching";
import {
  checkExistingProducts,
  findExistingProducts,
  buildBrandNormalizationMap,
} from "@/lib/supabase/queries-common";
import * as mutations from "@/lib/supabase/mutations-unified";
import { getDomainConfig, type DomainId } from "@/lib/domain";
import type { FuzzyCategoryCache } from "@/lib/supabase/mutations-unified";

// ────────────────────────────────────────────
// Public config type
// ────────────────────────────────────────────

export interface AnalyzeHandlerConfig {
  domain: DomainId;
  /** Optional: camera-specific tag enrichment function */
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
}

// ────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────

export function createAnalyzeHandler(handlerConfig: AnalyzeHandlerConfig) {
  const { domain, enrichTags } = handlerConfig;
  const domainConfig = getDomainConfig(domain);
  const productsTable = domainConfig.tables.products as "products" | "products_camera";

  return async function POST(request: NextRequest) {
    try {
      const { url, saveToDb = false } = await request.json();

      if (!url) {
        return NextResponse.json(
          { error: "YouTube URLを入力してください" },
          { status: 400 }
        );
      }

      // 1. 動画IDを抽出
      const videoId = extractVideoId(url);
      if (!videoId) {
        return NextResponse.json(
          { error: "無効なYouTube URLです" },
          { status: 400 }
        );
      }

      // 2. 既に解析済みかチェック（DB保存モードの場合のみ）
      if (saveToDb) {
        const alreadyAnalyzed = await mutations.isVideoAnalyzed(domain, videoId);
        if (alreadyAnalyzed) {
          return NextResponse.json(
            {
              error: "この動画は既に解析済みです",
              alreadyAnalyzed: true,
              videoId,
            },
            { status: 409 }
          );
        }
      }

      // 3. 動画情報を取得
      const videoInfo = await getVideoInfo(videoId);
      if (!videoInfo) {
        return NextResponse.json(
          { error: "動画情報の取得に失敗しました" },
          { status: 404 }
        );
      }

      // 4. 文字起こしを取得
      console.log(`Fetching transcript for videoId: ${videoId}`);
      const transcript = await getTranscript(videoId);
      console.log(
        `Transcript result: ${transcript ? `${transcript.length} chars` : "null"}`
      );

      if (!transcript) {
        return NextResponse.json(
          {
            error:
              "字幕を取得できませんでした。この動画には字幕がない可能性があります。",
            videoInfo,
          },
          { status: 400 }
        );
      }

      // 6. 概要欄からEC系リンクを抽出（Geminiに商品ヒントとして渡すため先に実行）
      console.log("Extracting product links from description...");
      const descriptionLinks = await extractProductsFromDescription(videoInfo.description);
      console.log(`Found ${descriptionLinks.length} product links in description`);

      // 6.5. 概要欄のASINから商品情報を一括取得（商品ヒント構築のため先に実行）
      const asinsFromDescription = descriptionLinks
        .filter((link): link is ExtractedProduct & { asin: string } => !!link.asin)
        .map(link => link.asin);

      let asinProductMap = new Map<string, ProductInfo | null>();
      if (asinsFromDescription.length > 0) {
        console.log(`Fetching ${asinsFromDescription.length} products by ASIN...`);
        asinProductMap = await getProductsByAsins(asinsFromDescription);
      }

      // 6.7. 商品ヒントを構築（Amazon商品タイトルをGeminiに渡す）
      const productHints: string[] = [];
      for (const [, productInfo] of asinProductMap) {
        if (productInfo?.title) {
          productHints.push(productInfo.title);
        }
      }
      if (productHints.length > 0) {
        console.log(`Product hints for Gemini: ${productHints.length} items`);
      }

      // 7. Gemini APIで解析（概要欄 + サムネイル画像 + 商品ヒントも含める）
      console.log(`Analyzing transcript with Gemini (${domain} domain)...`);
      const analysisResult = await analyzeTranscript(
        transcript,
        videoInfo.title,
        videoInfo.description,
        videoInfo.channelDescription,
        videoInfo.thumbnailUrl,
        domain,
        videoInfo.channelTitle,
        productHints
      );
      console.log(`Found ${analysisResult.products.length} products`);
      console.log(`Influencer occupation: ${analysisResult.influencerOccupation}`);

      // 8. 概要欄のASIN商品情報は6.5で取得済み — 以降はマッチングに使用

      // 8.5. 公式サイトリンクから取得した情報を収集
      const officialLinks = descriptionLinks
        .filter((link): link is ExtractedProduct & { officialInfo: NonNullable<ExtractedProduct["officialInfo"]> } =>
          link.source === "official" && !!link.officialInfo
        );
      console.log(`Found ${officialLinks.length} official site links with OGP info`);

      // 8.7. DB既存商品ルックアップ（過去の登録データを「学習データ」として再利用）
      const productsForLookup = analysisResult.products
        .filter(p => p.name && (p.confidence === "high" || p.confidence === "medium"));
      const productNamesForLookup = productsForLookup.map(p => p.name);
      const productMetaForLookup = productsForLookup.map(p => ({ name: p.name, category: p.category, brand: p.brand }));
      const existingProductMap = await findExistingProducts(productNamesForLookup, productsTable, productMetaForLookup);
      console.log(`DB existing product matches: ${existingProductMap.size} / ${productNamesForLookup.length}`);

      // 8.8. ブランド名の正規化（DB既存ブランドを正とし、表記揺れを解消）
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

      // 9. 商品のAmazon/楽天マッチング（プレビュー・保存共通）
      console.log(`Matching ${analysisResult.products.length} products with Amazon/Rakuten...`);

      const matchedProducts: MatchedProduct[] = [];
      const candidates = buildCandidates(asinProductMap);
      const usedAsins = new Set<string>();

      for (let i = 0; i < analysisResult.products.length; i++) {
        const product = analysisResult.products[i];
        console.log(`[${i + 1}/${analysisResult.products.length}] Processing: ${product.name} (brand: ${product.brand}, confidence: ${product.confidence})`);

        // 除外ブランドチェック
        const excludedBrand = isExcludedBrand(product.name) ||
          (product.brand ? isExcludedBrand(product.brand) : null);

        if (excludedBrand) {
          console.log(`  [Excluded] ${excludedBrand.name}: "${product.name}" — checking DB for existing match...`);
          // 除外ブランドでもDB既存商品マッチを試行（公式サイトURLや画像を再利用）
          const existingMatch = existingProductMap.get(product.name);
          if (existingMatch && (existingMatch.asin || existingMatch.amazon_url)) {
            console.log(`  ✓ DB existing match for excluded brand: "${product.name}" → ${existingMatch.amazon_url || existingMatch.asin}`);
            if (existingMatch.asin) usedAsins.add(existingMatch.asin);
            matchedProducts.push({
              name: product.name,
              brand: product.brand || existingMatch.brand || undefined,
              category: product.category,
              subcategory: product.subcategory,
              lensTags: product.lensTags,
              bodyTags: product.bodyTags,
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
              matchReason: `DB existing (${excludedBrand.name}): ${existingMatch.amazon_url || existingMatch.name}`,
              isExisting: true,
            });
          } else {
            console.log(`  [Excluded] No DB match found for "${product.name}" — manual setup required`);
            matchedProducts.push({
              name: product.name,
              brand: product.brand,
              category: product.category,
              subcategory: product.subcategory,
              lensTags: product.lensTags,
              bodyTags: product.bodyTags,
              reason: product.reason,
              confidence: product.confidence,
              matchReason: `Excluded: ${excludedBrand.name} (手動設定が必要)`,
            });
          }
        } else if (product.confidence === "low") {
          console.log(`  [Low Confidence] Skipping API search for "${product.name}" (confidence: low)`);
          matchedProducts.push({
            name: product.name,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
            lensTags: product.lensTags,
            bodyTags: product.bodyTags,
            reason: product.reason,
            confidence: product.confidence,
            matchReason: "Low confidence (手動検索推奨)",
          });
        } else {
          // ★最優先: DB既存商品マッチ（過去に登録済みの商品を再利用）
          const existingMatch = existingProductMap.get(product.name);
          if (existingMatch && (existingMatch.asin || existingMatch.amazon_url)) {
            console.log(`  ✓ DB existing match: "${product.name}" → ${existingMatch.asin || existingMatch.amazon_url} (${existingMatch.amazon_title?.substring(0, 50) || existingMatch.name})`);
            if (existingMatch.asin) usedAsins.add(existingMatch.asin);
            matchedProducts.push({
              name: product.name,
              brand: product.brand || existingMatch.brand || undefined,
              category: product.category,
              subcategory: product.subcategory,
              lensTags: product.lensTags,
              bodyTags: product.bodyTags,
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

          // 高・中確度の商品のみ検索
          const result = await matchProductWithAmazon({
            productName: product.name,
            productBrand: product.brand,
            productCategory: product.category,
            candidates,
            usedAsins,
            apiSearchDelay: 1000, // レート制限対策
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

          // Camera tag enrichment (only when enrichTags is provided and Amazon info exists)
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
            subcategory: enrichedSubcategory,
            lensTags: enrichedLensTags,
            bodyTags: enrichedBodyTags,
            reason: product.reason,
            confidence: product.confidence,
            tags: result.productTags,
            amazon: toAmazonField(amazonInfo),
            source: amazonInfo?.source,
            matchScore: result.matchScore,
            matchReason,
          });
        }
      }

      // 10. DBに保存（オプション）
      if (saveToDb) {
        console.log(`Saving to ${domain} database...`);
        console.log(`[/api/${domain}/analyze] Gemini analysis result:`, {
          influencerOccupation: analysisResult.influencerOccupation,
          influencerOccupationTags: analysisResult.influencerOccupationTags,
        });

        // インフルエンサーを保存（職種情報を含む）
        const savedInfluencer = await mutations.saveInfluencer(domain, {
          channel_id: videoInfo.channelId,
          channel_title: videoInfo.channelTitle,
          subscriber_count: videoInfo.subscriberCount,
          thumbnail_url: videoInfo.channelThumbnailUrl,
          source_type: "youtube",
          occupation: analysisResult.influencerOccupation || undefined,
          occupation_tags: analysisResult.influencerOccupationTags,
        });
        console.log(`[/api/${domain}/analyze] saveInfluencer result:`, savedInfluencer ? {
          id: savedInfluencer.id,
          channel_id: savedInfluencer.channel_id,
          occupation_tags: savedInfluencer.occupation_tags,
        } : "NULL - FAILED TO SAVE");

        // 動画を保存
        const videoResult = await mutations.saveVideo(domain, {
          video_id: videoInfo.videoId,
          title: videoInfo.title,
          channel_title: videoInfo.channelTitle,
          channel_id: videoInfo.channelId,
          subscriber_count: videoInfo.subscriberCount,
          thumbnail_url: videoInfo.thumbnailUrl,
          published_at: videoInfo.publishedAt,
          summary: analysisResult.summary,
          tags: analysisResult.tags,
        });

        if (!videoResult.data) {
          console.error(`[/api/${domain}/analyze] saveVideo failed for video_id: ${videoInfo.videoId}`);
          return NextResponse.json(
            { error: "動画の保存に失敗しました。DBの制約に合わない可能性があります。" },
            { status: 500 }
          );
        }

        // 商品を保存（unified loop — both domains use mutations-unified）
        const fuzzyCategoryCache: FuzzyCategoryCache = new Map();
        for (const product of matchedProducts) {
          console.log(
            `[SaveProduct] ${product.name} | tags: ${product.tags?.join(", ") || "none"}`
          );

          // 段階1で既にマッチ済みの商品IDがあれば渡す（DB検索スキップ）
          const preMatchedId = existingProductMap.get(product.name)?.id;

          const saveResult = await mutations.saveProduct(domain, {
            name: product.name,
            brand: product.brand || undefined,
            category: product.category,
            ...(domainConfig.search.hasSubcategory && product.subcategory ? { subcategory: product.subcategory } : {}),
            ...(domainConfig.search.hasLensTags && product.lensTags ? { lens_tags: product.lensTags } : {}),
            ...(domainConfig.search.hasBodyTags && product.bodyTags ? { body_tags: product.bodyTags } : {}),
            reason: product.reason,
            confidence: product.confidence,
            video_id: videoInfo.videoId,
            source_type: "video",
          }, fuzzyCategoryCache, preMatchedId);
          const savedProduct = saveResult.product;

          if (!savedProduct) {
            console.error(`[SaveProduct] FAILED to save: "${product.name}" — saveProduct returned null`);
            continue;
          }

          if (savedProduct && !savedProduct.asin && product.amazon) {
            const priceRange = getPriceRange(product.amazon.price);

            // Look up the full ProductInfo from candidates for detailed spec fields
            const originalProduct = candidates.find(
              (c) => c.asin === product.amazon?.asin
            )?.product;

            await mutations.updateProductWithAmazon(
              domain,
              savedProduct.id!,
              {
                asin: product.amazon.asin,
                amazon_url: product.amazon.url,
                amazon_image_url: product.amazon.imageUrl,
                amazon_price: product.amazon.price,
                amazon_title: product.amazon.title,
                product_source: product.source,
                rakuten_shop_name: originalProduct?.shopName,
                amazon_manufacturer: originalProduct?.manufacturer,
                amazon_brand: originalProduct?.brand,
                amazon_model_number: originalProduct?.modelNumber,
                amazon_color: originalProduct?.color,
                amazon_size: originalProduct?.size,
                amazon_weight: originalProduct?.weight,
                amazon_release_date: originalProduct?.releaseDate,
                amazon_features:
                  originalProduct?.features &&
                  !isLowQualityFeatures(originalProduct.features)
                    ? originalProduct.features
                    : undefined,
                amazon_technical_info: originalProduct?.technicalInfo,
              },
              priceRange || undefined
            );

            // Camera enriched tags update (subcategory, lens_tags, body_tags from enrichment)
            if (enrichTags && savedProduct.id) {
              const enrichedUpdates: Record<string, unknown> = {};
              if (product.subcategory) {
                enrichedUpdates.subcategory = product.subcategory;
              }
              if (product.lensTags && product.lensTags.length > 0) {
                enrichedUpdates.lens_tags = product.lensTags;
              }
              if (product.bodyTags && product.bodyTags.length > 0) {
                enrichedUpdates.body_tags = product.bodyTags;
              }
              if (Object.keys(enrichedUpdates).length > 0) {
                await mutations.updateProductEnrichedTags(domain, savedProduct.id, enrichedUpdates);
              }
            }
          }
        }
      }

      // 既存商品チェック（プレビュー用）
      const existingMap = await checkExistingProducts(
        matchedProducts.map(p => p.name),
        productsTable
      );
      const productsWithExisting = matchedProducts.map(p => ({
        ...p,
        isExisting: !!existingMap[p.name],
      }));

      return NextResponse.json({
        success: true,
        videoInfo,
        analysis: {
          ...analysisResult,
          // プレビュー用にマッチング済み商品情報を含める
          products: productsWithExisting,
        },
        transcriptLength: transcript.length,
        savedToDb: saveToDb,
      });
    } catch (error) {
      console.error(`${domain} analysis error:`, error);
      return NextResponse.json(
        { error: "解析中にエラーが発生しました" },
        { status: 500 }
      );
    }
  };
}
