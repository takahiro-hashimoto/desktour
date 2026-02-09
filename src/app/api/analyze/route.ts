import { NextRequest, NextResponse } from "next/server";
import {
  extractVideoId,
  getVideoInfo,
  getTranscript,
  isEligibleVideo,
} from "@/lib/youtube";
import { analyzeTranscript, getPriceRange } from "@/lib/gemini";
import {
  saveVideo,
  saveProduct,
  updateProductWithAmazon,
  isVideoAnalyzed,
  saveInfluencer,
} from "@/lib/supabase";
import { getProductsByAsins } from "@/lib/product-search";
import { extractProductsFromDescription, ExtractedProduct } from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import { isExcludedBrand } from "@/lib/excluded-brands";
import {
  buildCandidates,
  matchProductWithAmazon,
  toAmazonField,
  type MatchedProduct,
} from "@/lib/product-matching";
import { isLowQualityFeatures } from "@/lib/featureQuality";

export async function POST(request: NextRequest) {
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
      const alreadyAnalyzed = await isVideoAnalyzed(videoId);
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

    // 4. 視聴回数をチェック
    if (!isEligibleVideo(videoInfo.viewCount)) {
      return NextResponse.json(
        {
          error: `視聴回数が5,000回未満のため対象外です（現在: ${videoInfo.viewCount.toLocaleString()}回）`,
          videoInfo,
        },
        { status: 400 }
      );
    }

    // 5. 文字起こしを取得
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

    // 6. 概要欄からEC系リンクを抽出（並行実行）
    console.log("Extracting product links from description...");
    const descriptionLinksPromise = extractProductsFromDescription(videoInfo.description);

    // 7. Gemini APIで解析（概要欄も含める）
    console.log("Analyzing transcript with Gemini...");
    const analysisResult = await analyzeTranscript(
      transcript,
      videoInfo.title,
      videoInfo.description,
      videoInfo.channelDescription
    );
    console.log(`Found ${analysisResult.products.length} products`);
    console.log(`Influencer occupation: ${analysisResult.influencerOccupation}`);

    // 概要欄リンク抽出の結果を待機
    const descriptionLinks = await descriptionLinksPromise;
    console.log(`Found ${descriptionLinks.length} product links in description`);

    // 8. 概要欄のASINから商品情報を一括取得（API効率化）
    const asinsFromDescription = descriptionLinks
      .filter((link): link is ExtractedProduct & { asin: string } => !!link.asin)
      .map(link => link.asin);

    let asinProductMap = new Map<string, ProductInfo | null>();
    if (asinsFromDescription.length > 0) {
      console.log(`Fetching ${asinsFromDescription.length} products by ASIN...`);
      asinProductMap = await getProductsByAsins(asinsFromDescription);
    }

    // 8.5. 公式サイトリンクから取得した情報を収集
    const officialLinks = descriptionLinks
      .filter((link): link is ExtractedProduct & { officialInfo: NonNullable<ExtractedProduct["officialInfo"]> } =>
        link.source === "official" && !!link.officialInfo
      );
    console.log(`Found ${officialLinks.length} official site links with OGP info`);

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
        console.log(`  [Excluded] Skipping API search for "${product.name}" (${excludedBrand.name}: ${excludedBrand.reason})`);
        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
          matchReason: `Excluded: ${excludedBrand.name} (手動設定が必要)`,
        });
      } else if (product.confidence === "low") {
        console.log(`  [Low Confidence] Skipping API search for "${product.name}" (confidence: low)`);
        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
          matchReason: "Low confidence (手動検索推奨)",
        });
      } else {
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

        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
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
      console.log("Saving to database...");
      console.log("[/api/analyze] Gemini analysis result:", {
        influencerOccupation: analysisResult.influencerOccupation,
        influencerOccupationTags: analysisResult.influencerOccupationTags,
      });

      // インフルエンサーを保存（職種情報を含む）
      const savedInfluencer = await saveInfluencer({
        channel_id: videoInfo.channelId,
        channel_title: videoInfo.channelTitle,
        subscriber_count: videoInfo.subscriberCount,
        thumbnail_url: videoInfo.channelThumbnailUrl,
        source_type: "youtube",
        occupation: analysisResult.influencerOccupation || undefined,
        occupation_tags: analysisResult.influencerOccupationTags,
      });
      console.log("[/api/analyze] saveInfluencer result:", savedInfluencer ? {
        id: savedInfluencer.id,
        channel_id: savedInfluencer.channel_id,
        occupation_tags: savedInfluencer.occupation_tags,
      } : "NULL - FAILED TO SAVE");

      // 動画を保存
      await saveVideo({
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

      // 商品を保存
      for (const product of matchedProducts) {
        console.log(`[SaveProduct] ${product.name} | tags: ${product.tags?.join(', ') || 'none'}`);
        const savedProduct = await saveProduct({
          name: product.name,
          brand: product.brand || undefined,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
          video_id: videoInfo.videoId,
          source_type: "video",
        });

        if (savedProduct && !savedProduct.asin && product.amazon) {
          const priceRange = getPriceRange(product.amazon.price);

          // 元のProductInfoを取得（詳細情報用）
          const originalProduct = candidates.find(c => c.asin === product.amazon?.asin)?.product;

          await updateProductWithAmazon(
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
              amazon_features: originalProduct?.features && !isLowQualityFeatures(originalProduct.features) ? originalProduct.features : undefined,
              amazon_technical_info: originalProduct?.technicalInfo,
            },
            priceRange || undefined
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      videoInfo,
      analysis: {
        ...analysisResult,
        // プレビュー用にマッチング済み商品情報を含める
        products: matchedProducts,
      },
      transcriptLength: transcript.length,
      savedToDb: saveToDb,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
