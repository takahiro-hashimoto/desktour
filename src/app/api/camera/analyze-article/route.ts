import { NextRequest, NextResponse } from "next/server";
import { getArticleInfo, isDeskTourArticle } from "@/lib/article";
import { analyzeArticle } from "@/lib/gemini";
import {
  saveCameraArticle,
  isCameraArticleAnalyzed,
  saveCameraInfluencer,
  saveCameraProduct,
  updateCameraProductWithAmazon,
  type CameraFuzzyCategoryCache,
} from "@/lib/supabase/mutations-camera";
import { getProductsByAsins } from "@/lib/product-search";
import { extractProductsFromDescription, ExtractedProduct } from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import { getPriceRange } from "@/lib/gemini";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import { CAMERA_PRODUCT_CATEGORIES } from "@/lib/camera/constants";
import {
  generateAuthorId,
  buildCandidates,
  matchProductWithAmazon,
  toAmazonField,
  type MatchedProduct,
} from "@/lib/product-matching";
import { enrichCameraTags } from "@/lib/camera/camera-tag-inference";
import { checkExistingProducts, findExistingProducts, buildBrandNormalizationMap, type ExistingProductMatch } from "@/lib/supabase/queries-common";

export async function POST(request: NextRequest) {
  try {
    const { url, saveToDb = false } = await request.json();

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

    // 1. 既に解析済みかチェック（DB保存モードの場合のみ）
    if (saveToDb) {
      const alreadyAnalyzed = await isCameraArticleAnalyzed(url);
      if (alreadyAnalyzed) {
        return NextResponse.json(
          {
            error: "この記事は既に解析済みです",
            alreadyAnalyzed: true,
            url,
          },
          { status: 409 }
        );
      }
    }

    // 2. 記事情報を取得
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

    // 3. 撮影機材関連の記事かチェック（警告のみ）
    const isRelevant = isDeskTourArticle(articleInfo.title, articleInfo.content);
    if (!isRelevant) {
      console.log("Warning: Article may not be camera equipment related");
    }

    // 4. 記事内のEC系リンクからASINを抽出
    console.log("Extracting product links from article...");
    const productLinksText = articleInfo.productLinks.join("\n");
    const articleLinks = await extractProductsFromDescription(productLinksText);
    console.log(`Found ${articleLinks.length} product links in article`);

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
    if (productHints.length > 0) {
      console.log(`Providing ${productHints.length} product hints to Gemini`);
    }

    // 7. Gemini APIで解析（撮影機材用のカテゴリで解析、商品ヒント付き）
    console.log("Analyzing article with Gemini (camera domain)...");
    const analysisResult = await analyzeArticle(articleInfo.content, articleInfo.title, "camera", productHints);
    console.log(`Found ${analysisResult.products.length} products`);
    console.log(`Author occupation: ${analysisResult.influencerOccupation}`);

    // 7. DB既存商品ルックアップ（過去の登録データを「学習データ」として再利用）
    const productNamesForLookup = analysisResult.products
      .filter(p => p.confidence === "high" || p.confidence === "medium")
      .map(p => p.name);
    const existingProductMap = await findExistingProducts(productNamesForLookup, "products_camera");
    console.log(`DB existing product matches: ${existingProductMap.size} / ${productNamesForLookup.length}`);

    // 7.5. ブランド名の正規化（DB既存ブランドを正とし、表記揺れを解消）
    const rawBrands = analysisResult.products
      .map(p => p.brand)
      .filter((b): b is string => !!b);
    const brandNormMap = await buildBrandNormalizationMap(rawBrands, "products_camera");
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

    // ASIN抽出ヘルパー（amazonUrlからASINを取得）
    function extractAsinFromUrl(url: string): string | null {
      const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) return dpMatch[1].toUpperCase();
      const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (gpMatch) return gpMatch[1].toUpperCase();
      const asinMatch = url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/i);
      if (asinMatch) return asinMatch[1].toUpperCase();
      return null;
    }

    const matchedProducts: MatchedProduct[] = [];
    const candidates = buildCandidates(asinProductMap);
    const usedAsins = new Set<string>();

    for (const product of analysisResult.products) {
      console.log(`Processing product: ${product.name} (brand: ${product.brand})`);

      if (product.confidence === "high" || product.confidence === "medium") {
        // ★最優先: DB既存商品マッチ（過去に登録済みの商品を再利用）
        const existingMatch = existingProductMap.get(product.name);
        if (existingMatch && existingMatch.asin) {
          console.log(`  ✓ DB existing match: "${product.name}" → ${existingMatch.asin} (${existingMatch.amazon_title?.substring(0, 50)})`);
          usedAsins.add(existingMatch.asin);
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
              asin: existingMatch.asin,
              title: existingMatch.amazon_title || existingMatch.name,
              url: existingMatch.amazon_url,
              imageUrl: existingMatch.amazon_image_url || "",
              price: existingMatch.amazon_price || undefined,
            } : null,
            source: (existingMatch.product_source as "amazon" | "rakuten") || undefined,
            matchScore: 300,
            matchReason: `DB existing: ${existingMatch.asin}`,
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

        // Amazon情報があればCamera用タグを補強（ダイレクトマッチ・スコアマッチ共通）
        const enrichFromAmazon = (amazonInfo: ProductInfo | null) => {
          let enrichedLensTags = product.lensTags;
          let enrichedBodyTags = product.bodyTags;
          let enrichedSubcategory = product.subcategory;

          if (amazonInfo) {
            const enrichment = enrichCameraTags({
              category: product.category,
              subcategory: product.subcategory,
              lensTags: product.lensTags,
              bodyTags: product.bodyTags,
              amazonInfo,
            });
            if (enrichment.lensTags.length > 0) enrichedLensTags = enrichment.lensTags;
            if (enrichment.bodyTags.length > 0) enrichedBodyTags = enrichment.bodyTags;
            if (enrichment.subcategory) enrichedSubcategory = enrichment.subcategory;
          }

          return { enrichedLensTags, enrichedBodyTags, enrichedSubcategory };
        };

        if (directMatchInfo) {
          // ダイレクトマッチ成功
          const { enrichedLensTags, enrichedBodyTags, enrichedSubcategory } = enrichFromAmazon(directMatchInfo);
          matchedProducts.push({
            name: product.name,
            brand: product.brand,
            category: product.category,
            subcategory: enrichedSubcategory,
            lensTags: enrichedLensTags,
            bodyTags: enrichedBodyTags,
            reason: product.reason,
            confidence: product.confidence,
            tags: undefined,
            amazon: toAmazonField(directMatchInfo),
            source: directMatchInfo.source,
            matchScore: 200,
            matchReason: directMatchReason,
          });
        } else {
          // フォールバック: 従来のスコアベースマッチング
          const result = await matchProductWithAmazon({
            productName: product.name,
            productBrand: product.brand,
            productCategory: product.category,
            candidates,
            usedAsins,
          });

          const { enrichedLensTags, enrichedBodyTags, enrichedSubcategory } = enrichFromAmazon(result.amazonInfo);

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
            amazon: toAmazonField(result.amazonInfo),
            source: result.amazonInfo?.source,
            matchScore: result.matchScore,
            matchReason: result.matchReason,
          });
        }
      } else {
        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
          subcategory: product.subcategory,
          lensTags: product.lensTags,
          bodyTags: product.bodyTags,
          reason: product.reason,
          confidence: product.confidence,
        });
      }
    }

    // 8. DBに保存（オプション）
    if (saveToDb) {
      console.log("Saving to camera database...");

      // 著者をインフルエンサーとして保存
      const authorId = generateAuthorId(url, articleInfo.author);
      await saveCameraInfluencer({
        author_id: authorId,
        author_name: articleInfo.author || undefined,
        source_type: "article",
        thumbnail_url: articleInfo.thumbnailUrl || undefined,
        occupation: analysisResult.influencerOccupation || undefined,
        occupation_tags: analysisResult.influencerOccupationTags,
      });

      // 記事を保存
      await saveCameraArticle({
        url: articleInfo.url,
        title: articleInfo.title,
        author: articleInfo.author,
        author_url: articleInfo.authorUrl,
        site_name: articleInfo.siteName,
        source_type: articleInfo.sourceType,
        thumbnail_url: articleInfo.thumbnailUrl,
        published_at: articleInfo.publishedAt,
        summary: analysisResult.summary,
        tags: analysisResult.tags,
      });

      // 商品を保存（camera用）
      const fuzzyCategoryCache: CameraFuzzyCategoryCache = new Map();
      for (const product of matchedProducts) {
        console.log(
          `[SaveCameraProduct] ${product.name} | tags: ${product.tags?.join(", ") || "none"}`
        );

        const saveResult = await saveCameraProduct({
          name: product.name,
          brand: product.brand || undefined,
          category: product.category,
          subcategory: product.subcategory || undefined,
          lens_tags: product.lensTags,
          body_tags: product.bodyTags,
          reason: product.reason,
          confidence: product.confidence,
          article_id: articleInfo.url,
          source_type: "article",
        }, fuzzyCategoryCache);
        const savedProduct = saveResult.product;

        if (savedProduct && !savedProduct.asin && product.amazon) {
          const priceRange = getPriceRange(product.amazon.price);

          const originalProduct = candidates.find(
            (c) => c.asin === product.amazon?.asin
          )?.product;

          await updateCameraProductWithAmazon(
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
        }
      }
    }

    // 既存商品チェック（プレビュー用）
    const existingMap = await checkExistingProducts(
      matchedProducts.map(p => p.name),
      "products_camera"
    );
    const productsWithExisting = matchedProducts.map(p => ({
      ...p,
      isExisting: !!existingMap[p.name],
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
      savedToDb: saveToDb,
    });
  } catch (error) {
    console.error("Camera article analysis error:", error);
    return NextResponse.json(
      { error: "解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
