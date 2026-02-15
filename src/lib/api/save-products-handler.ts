/**
 * save-products 共通ハンドラファクトリ
 *
 * desktour / camera 両ドメインの save-products API ルートを統合。
 * `createSaveProductsHandler(config)` が NextRequest → NextResponse ハンドラを返す。
 */

import { NextRequest, NextResponse } from "next/server";
import { searchAmazonProduct, getProductsByAsins } from "@/lib/product-search";
import {
  extractProductsFromDescription,
  ExtractedProduct,
  findBestMatch,
} from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import { getPriceRange, summarizeProductFeaturesBatch } from "@/lib/gemini";
import { generateAuthorId } from "@/lib/product-matching";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import * as mutations from "@/lib/supabase/mutations-unified";
import { getDomainConfig, type DomainId } from "@/lib/domain";
import type { FuzzyCategoryCache } from "@/lib/supabase/mutations-unified";

// ========== インターフェース定義 ==========

interface ProductToSave {
  name: string;
  brand?: string;
  category: string;
  subcategory?: string; // camera-specific
  lensTags?: string[]; // camera-specific
  bodyTags?: string[]; // camera-specific
  reason: string;
  confidence: "high" | "medium" | "low";
  tags?: string[]; // 自動抽出されたタグ
  amazon?: {
    asin: string;
    title: string;
    url: string;
    imageUrl: string;
    price?: number;
  };
  source?: string;
  matchReason?: string;
}

interface ArticleInfo {
  url: string;
  title: string;
  author?: string | null;
  authorUrl?: string | null;
  siteName?: string | null;
  sourceType: "note" | "blog" | "official" | "other";
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  productLinks?: string[];
}

interface VideoInfo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  description?: string;
}

interface AnalysisData {
  summary: string;
  tags: string[];
  influencerOccupation?: string | null;
  influencerOccupationTags?: string[];
}

// ========== ハンドラ設定 ==========

export interface SaveProductsHandlerConfig {
  domain: DomainId;
  /** Optional: camera-specific tag enrichment applied after Amazon info is fetched */
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

// ========== ファクトリ関数 ==========

export function createSaveProductsHandler(config: SaveProductsHandlerConfig) {
  const { domain, enrichTags } = config;
  const domainConfig = getDomainConfig(domain);

  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      const body = await request.json();
      const {
        sourceType,
        articleInfo,
        videoInfo,
        analysisData,
        selectedProducts,
      }: {
        sourceType: "article" | "video";
        articleInfo?: ArticleInfo;
        videoInfo?: VideoInfo;
        analysisData: AnalysisData;
        selectedProducts: ProductToSave[];
      } = body;

      if (!selectedProducts || selectedProducts.length === 0) {
        return NextResponse.json(
          { error: "保存する商品が選択されていません" },
          { status: 400 }
        );
      }

      const sourceUrl =
        sourceType === "article"
          ? articleInfo?.url
          : `https://www.youtube.com/watch?v=${videoInfo?.videoId}`;

      if (!sourceUrl) {
        return NextResponse.json(
          { error: "ソースURLが不明です" },
          { status: 400 }
        );
      }

      // 既に解析済みかチェック
      const alreadyAnalyzed = await mutations.isArticleAnalyzed(
        domain,
        sourceUrl
      );
      if (alreadyAnalyzed) {
        return NextResponse.json(
          {
            error: "このコンテンツは既に登録済みです",
            alreadyAnalyzed: true,
          },
          { status: 409 }
        );
      }

      console.log(
        `Saving ${selectedProducts.length} ${domain} products from ${sourceType}...`
      );

      // 記事内のEC系リンクからASINを抽出（記事の場合のみ）
      let asinProductMap = new Map<string, ProductInfo | null>();
      if (sourceType === "article" && articleInfo?.productLinks) {
        const productLinksText = articleInfo.productLinks.join("\n");
        const articleLinks =
          await extractProductsFromDescription(productLinksText);
        const asinsFromArticle = articleLinks
          .filter(
            (link): link is ExtractedProduct & { asin: string } => !!link.asin
          )
          .map((link) => link.asin);

        if (asinsFromArticle.length > 0) {
          console.log(
            `Fetching ${asinsFromArticle.length} products by ASIN...`
          );
          asinProductMap = await getProductsByAsins(asinsFromArticle);
        }
      }

      // 著者をインフルエンサーとして保存
      if (sourceType === "article" && articleInfo) {
        const authorId = generateAuthorId(
          articleInfo.url,
          articleInfo.author || null
        );
        await mutations.saveInfluencer(domain, {
          author_id: authorId,
          author_name: articleInfo.author || undefined,
          source_type: "article",
          thumbnail_url: articleInfo.thumbnailUrl || undefined,
          occupation: analysisData.influencerOccupation || undefined,
          occupation_tags: analysisData.influencerOccupationTags,
        });

        // 記事を保存
        const articleResult = await mutations.saveArticle(domain, {
          url: articleInfo.url,
          title: articleInfo.title,
          author: articleInfo.author || null,
          author_url: articleInfo.authorUrl || null,
          site_name: articleInfo.siteName || null,
          source_type: articleInfo.sourceType,
          thumbnail_url: articleInfo.thumbnailUrl || null,
          published_at: articleInfo.publishedAt || null,
          summary: analysisData.summary,
          tags: analysisData.tags,
        });

        if (!articleResult.data) {
          return NextResponse.json(
            { error: "記事の保存に失敗しました。source_typeがDBの制約に合わない可能性があります。" },
            { status: 500 }
          );
        }
      } else if (sourceType === "video" && videoInfo) {
        // チャンネルをインフルエンサーとして保存
        await mutations.saveInfluencer(domain, {
          channel_id: videoInfo.channelId,
          channel_title: videoInfo.channelTitle,
          source_type: "youtube",
          thumbnail_url: videoInfo.thumbnailUrl || undefined,
          occupation: analysisData.influencerOccupation || undefined,
          occupation_tags: analysisData.influencerOccupationTags,
        });

        // 動画を保存
        await mutations.saveVideo(domain, {
          video_id: videoInfo.videoId,
          title: videoInfo.title,
          channel_id: videoInfo.channelId,
          channel_title: videoInfo.channelTitle,
          thumbnail_url: videoInfo.thumbnailUrl || "",
          published_at: videoInfo.publishedAt || new Date().toISOString(),
          subscriber_count: 0, // 後で更新可能
          summary: analysisData.summary,
          tags: analysisData.tags,
        });
      }

      // 選択された商品を保存
      const savedProducts: Array<{
        name: string;
        brand?: string;
        amazon?: {
          asin: string;
          title: string;
          url: string;
          imageUrl: string;
          price?: number;
        } | null;
        source?: "amazon" | "rakuten";
      }> = [];

      // ===== Step 1: 商品の保存とAmazon情報の収集 =====
      interface ProductWithAmazonInfo {
        product: ProductToSave;
        savedProductId: string;
        amazonInfo: ProductInfo; // nullではない（Amazon情報取得成功時のみ追加）
        priceRange: string | null;
      }
      const productsWithAmazonInfo: ProductWithAmazonInfo[] = [];

      // ファジーマッチ用カテゴリキャッシュ（ループ内で使い回してDBクエリ削減）
      const fuzzyCategoryCache: FuzzyCategoryCache = new Map();

      for (const product of selectedProducts) {
        console.log(
          `Processing ${domain} product: ${product.name} (brand: ${product.brand})`
        );

        const saveResult = await mutations.saveProduct(
          domain,
          {
            name: product.name,
            brand: product.brand || undefined,
            category: product.category,
            ...(domainConfig.search.hasSubcategory && product.subcategory ? { subcategory: product.subcategory } : {}),
            ...(domainConfig.search.hasLensTags && product.lensTags ? { lens_tags: product.lensTags } : {}),
            ...(domainConfig.search.hasBodyTags && product.bodyTags ? { body_tags: product.bodyTags } : {}),
            tags: product.tags,
            reason: product.reason,
            confidence: product.confidence,
            article_id: sourceType === "article" ? sourceUrl : undefined,
            video_id: sourceType === "video" ? videoInfo?.videoId : undefined,
            source_type: sourceType,
            ...(product.amazon
              ? {
                  asin: product.amazon.asin || undefined,
                  amazon_url: product.amazon.url,
                  amazon_image_url: product.amazon.imageUrl,
                  amazon_price: product.amazon.price,
                  product_source: (product.source || "amazon") as
                    | "amazon"
                    | "rakuten",
                }
              : {}),
          },
          fuzzyCategoryCache
        );
        const savedProduct = saveResult.product;

        // 公式サイト疑似ASIN（official-*）の場合はAmazon検索不要
        if (savedProduct?.asin?.startsWith("official-")) {
          savedProducts.push({
            name: product.name,
            brand: product.brand,
            amazon: {
              asin: savedProduct.asin,
              title: product.amazon?.title || product.name,
              url: product.amazon?.url || "",
              imageUrl: product.amazon?.imageUrl || "",
              price: product.amazon?.price,
            },
          });
        } else if (savedProduct && !savedProduct.asin) {
          if (
            product.confidence === "high" ||
            product.confidence === "medium"
          ) {
            let amazonInfo: ProductInfo | null = null;

            // 記事内から取得した全商品の候補リストを作成
            const candidates: Array<{
              asin: string;
              title: string;
              product: ProductInfo;
            }> = [];
            for (const [asin, asinProduct] of asinProductMap.entries()) {
              if (asinProduct) {
                candidates.push({
                  asin,
                  title: asinProduct.title,
                  product: asinProduct,
                });
              }
            }

            // ベストマッチを探す
            if (candidates.length > 0) {
              console.log(
                `  [Matching] Evaluating ${candidates.length} candidates for "${product.name}"...`
              );
              const bestMatch = findBestMatch(
                product.name,
                product.brand,
                candidates
              );

              if (bestMatch) {
                console.log(
                  `  [Best Match] ${bestMatch.title} (score: ${bestMatch.score}, ${bestMatch.reason})`
                );
                amazonInfo = bestMatch.product as ProductInfo;
                asinProductMap.delete(bestMatch.asin);
              }
            }

            // 記事内でマッチしなかった場合のみAPI検索
            if (!amazonInfo) {
              console.log(
                `  [Search] Not found in article, searching API...`
              );
              amazonInfo = await searchAmazonProduct(
                product.name,
                product.brand || undefined,
                product.category
              );
            }

            if (amazonInfo) {
              const priceRange = getPriceRange(amazonInfo.price);

              productsWithAmazonInfo.push({
                product,
                savedProductId: savedProduct.id!,
                amazonInfo,
                priceRange: priceRange || null,
              });
            } else {
              savedProducts.push({
                name: product.name,
                brand: product.brand,
                amazon: null,
              });
            }
          } else {
            savedProducts.push({
              name: product.name,
              brand: product.brand,
              amazon: null,
            });
          }
        } else if (savedProduct) {
          savedProducts.push({
            name: product.name,
            brand: product.brand,
            amazon: savedProduct.asin
              ? {
                  asin: savedProduct.asin,
                  title: savedProduct.amazon_title || product.name,
                  url: savedProduct.amazon_url || "",
                  imageUrl: savedProduct.amazon_image_url || "",
                  price: savedProduct.amazon_price,
                }
              : null,
          });
        } else {
          // saveProduct が null を返した場合（DB保存失敗）
          console.error(
            `[SaveProducts] Failed to save product: "${product.name}" — saveProduct returned null`
          );
          savedProducts.push({
            name: product.name,
            brand: product.brand,
            amazon: product.amazon
              ? {
                  asin: product.amazon.asin,
                  title: product.amazon.title,
                  url: product.amazon.url,
                  imageUrl: product.amazon.imageUrl,
                  price: product.amazon.price,
                }
              : null,
          });
        }
      }

      // ===== Step 2: 特徴を持つ商品をバッチで要約 =====
      // 低品質な特徴はスキップ（保証対象外の繰り返し等）
      const skippedProducts = new Set<string>();
      const productsToSummarize = productsWithAmazonInfo
        .filter((p) => {
          if (!p.amazonInfo?.features || p.amazonInfo.features.length <= 3)
            return false;
          if (isLowQualityFeatures(p.amazonInfo.features)) {
            console.log(
              `[Features] Skipping "${p.product.name}" - 特徴情報が不十分なため処理をスキップ`
            );
            skippedProducts.add(p.product.name);
            return false;
          }
          return true;
        })
        .map((p) => ({
          productName: p.product.name,
          features: p.amazonInfo!.features!,
        }));

      let summaryMap = new Map<string, string[]>();
      if (productsToSummarize.length > 0) {
        console.log(
          `[Features Batch] Summarizing ${productsToSummarize.length} ${domain} products...`
        );
        try {
          summaryMap =
            await summarizeProductFeaturesBatch(productsToSummarize);
        } catch (error) {
          console.error(
            "[Features Batch] Failed, using original features:",
            error
          );
        }
      }

      // ===== Step 3: Amazon情報と要約結果を使って更新 =====
      for (const {
        product,
        savedProductId,
        amazonInfo,
        priceRange,
      } of productsWithAmazonInfo) {
        // 要約結果を取得（低品質な場合はundefined）
        const isSkipped = skippedProducts.has(product.name);
        const summarizedFeatures = isSkipped
          ? undefined
          : summaryMap.get(product.name) || amazonInfo.features;
        const originalFeatures = amazonInfo.features; // 原文を保持（低品質でも記録）

        // enrichTags が設定されている場合（camera）、Amazon情報でタグを補強
        if (enrichTags) {
          const enrichment = enrichTags({
            category: product.category,
            subcategory: product.subcategory,
            lensTags: product.lensTags,
            bodyTags: product.bodyTags,
            amazonInfo,
          });

          // enrichTags 結果を先に適用してからAmazon情報を更新
          const enrichedUpdate: Record<string, unknown> = {};
          if (enrichment.lensTags.length > 0)
            enrichedUpdate.lens_tags = enrichment.lensTags;
          if (enrichment.bodyTags.length > 0)
            enrichedUpdate.body_tags = enrichment.bodyTags;
          if (enrichment.subcategory)
            enrichedUpdate.subcategory = enrichment.subcategory;

          if (Object.keys(enrichedUpdate).length > 0) {
            await mutations.updateProductEnrichedTags(
              domain,
              savedProductId,
              enrichedUpdate
            );
          }
        }

        await mutations.updateProductWithAmazon(
          domain,
          savedProductId,
          {
            asin: amazonInfo.id,
            amazon_url: amazonInfo.url,
            amazon_image_url: amazonInfo.imageUrl,
            amazon_price: amazonInfo.price,
            amazon_title: amazonInfo.title,
            product_source: amazonInfo.source,
            rakuten_shop_name: amazonInfo.shopName,
            amazon_manufacturer: amazonInfo.manufacturer,
            amazon_brand: amazonInfo.brand,
            amazon_model_number: amazonInfo.modelNumber,
            amazon_color: amazonInfo.color,
            amazon_size: amazonInfo.size,
            amazon_weight: amazonInfo.weight,
            amazon_release_date: amazonInfo.releaseDate,
            amazon_features: summarizedFeatures, // 要約版
            amazon_features_raw: originalFeatures, // 原文
            amazon_technical_info: amazonInfo.technicalInfo,
            amazon_categories: amazonInfo.amazonCategories, // カテゴリ階層
            amazon_product_group: amazonInfo.productGroup, // 商品グループ
          },
          priceRange || undefined
        );

        savedProducts.push({
          name: product.name,
          brand: product.brand,
          amazon: {
            asin: amazonInfo.id,
            title: amazonInfo.title,
            url: amazonInfo.url,
            imageUrl: amazonInfo.imageUrl,
            price: amazonInfo.price,
          },
          source: amazonInfo.source,
        });
      }

      return NextResponse.json({
        success: true,
        savedCount: savedProducts.length,
        savedProducts,
      });
    } catch (error) {
      console.error(`Save ${domain} products error:`, error);
      return NextResponse.json(
        { error: "保存中にエラーが発生しました" },
        { status: 500 }
      );
    }
  };
}
