import { NextRequest, NextResponse } from "next/server";
import { getArticleInfo, isDeskTourArticle } from "@/lib/article";
import { analyzeArticle, getPriceRange } from "@/lib/gemini";
import {
  saveArticle,
  saveProduct,
  updateProductWithAmazon,
  isArticleAnalyzed,
  saveInfluencer,
} from "@/lib/supabase";
import { searchAmazonProduct, getProductsByAsins } from "@/lib/product-search";
import { extractProductsFromDescription, ExtractedProduct, findBestMatch } from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import { inferSubcategory } from "@/lib/subcategoryInference";
import { extractProductTags } from "@/lib/productTags";

// URLからauthor_idを生成（note.comの場合はユーザーID、それ以外はドメイン+著者名）
function generateAuthorId(url: string, author: string | null): string {
  try {
    const urlObj = new URL(url);

    // note.comの場合
    if (urlObj.hostname.includes("note.com") || urlObj.hostname.includes("note.mu")) {
      // URLからユーザーIDを抽出 (例: note.com/username/n/...)
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0 && pathParts[0] !== "n") {
        return `note:${pathParts[0]}`;
      }
    }

    // その他の場合
    if (author) {
      return `${urlObj.hostname}:${author.replace(/\s+/g, "_").toLowerCase()}`;
    }

    return `${urlObj.hostname}:unknown`;
  } catch {
    return `unknown:${Date.now()}`;
  }
}

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
      const alreadyAnalyzed = await isArticleAnalyzed(url);
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

    // 3. デスクツアー関連の記事かチェック（警告のみ）
    const isRelevant = isDeskTourArticle(articleInfo.title, articleInfo.content);
    if (!isRelevant) {
      console.log("Warning: Article may not be desk tour related");
    }

    // 4. 記事内のEC系リンクからASINを抽出（並行実行）
    console.log("Extracting product links from article...");
    const productLinksText = articleInfo.productLinks.join("\n");
    const articleLinksPromise = extractProductsFromDescription(productLinksText);

    // 5. Gemini APIで解析
    console.log("Analyzing article with Gemini...");
    const analysisResult = await analyzeArticle(articleInfo.content, articleInfo.title);
    console.log(`Found ${analysisResult.products.length} products`);
    console.log(`Author occupation: ${analysisResult.influencerOccupation}`);

    // 記事内リンク抽出の結果を待機
    const articleLinks = await articleLinksPromise;
    console.log(`Found ${articleLinks.length} product links in article`);

    // 6. 記事内のASINから商品情報を一括取得（API効率化）
    const asinsFromArticle = articleLinks
      .filter((link): link is ExtractedProduct & { asin: string } => !!link.asin)
      .map(link => link.asin);

    let asinProductMap = new Map<string, ProductInfo | null>();
    if (asinsFromArticle.length > 0) {
      console.log(`Fetching ${asinsFromArticle.length} products by ASIN...`);
      asinProductMap = await getProductsByAsins(asinsFromArticle);
    }

    // 7. 商品のAmazon/楽天マッチング（プレビュー・保存共通）
    console.log("Matching products with Amazon/Rakuten...");

    const matchedProducts: Array<{
      name: string;
      brand?: string;
      category: string;
      subcategory?: string | null;
      reason: string;
      confidence: "high" | "medium" | "low";
      amazon?: {
        asin: string;
        title: string;
        url: string;
        imageUrl: string;
        price?: number;
      } | null;
      source?: "amazon" | "rakuten";
      matchScore?: number;
      matchReason?: string;
    }> = [];

    // 候補リストを作成（記事内から取得したASIN商品）
    const candidates: Array<{ asin: string; title: string; product: ProductInfo }> = [];
    for (const [asin, asinProduct] of asinProductMap.entries()) {
      if (asinProduct) {
        candidates.push({ asin, title: asinProduct.title, product: asinProduct });
      }
    }

    // 使用済みASINを追跡（重複マッチ防止）
    const usedAsins = new Set<string>();

    for (const product of analysisResult.products) {
      console.log(`Processing product: ${product.name} (brand: ${product.brand})`);

      let amazonInfo: ProductInfo | null = null;
      let matchScore = 0;
      let matchReason = "";

      // 高確度の商品のみ検索
      if (product.confidence === "high" || product.confidence === "medium") {
        // まず記事内のASIN情報とマッチングを試みる（未使用のもののみ）
        const availableCandidates = candidates.filter(c => !usedAsins.has(c.asin));

        if (availableCandidates.length > 0) {
          console.log(`  [Matching] Evaluating ${availableCandidates.length} candidates for "${product.name}"...`);
          const bestMatch = findBestMatch(product.name, product.brand, availableCandidates);

          if (bestMatch) {
            console.log(`  [Best Match] ${bestMatch.title} (score: ${bestMatch.score}, ${bestMatch.reason})`);
            amazonInfo = bestMatch.product as ProductInfo;
            matchScore = bestMatch.score;
            matchReason = bestMatch.reason;
            // 使用済みとしてマーク
            usedAsins.add(bestMatch.asin);
          }
        }

        // 記事内でマッチしなかった場合のみAPI検索
        if (!amazonInfo) {
          console.log(`  [Search] Not found in article, searching API...`);
          amazonInfo = await searchAmazonProduct(product.name, product.brand || undefined, product.category);
          if (amazonInfo) {
            matchReason = "API Search";
          }
        }
      }

      // サブカテゴリ: Geminiの結果を優先、なければAmazon検索結果から
      let finalSubcategory = product.subcategory || amazonInfo?.subcategory || null;

      // Amazon情報があればサブカテゴリを推論（動画解析と同じロジック）
      if (!finalSubcategory && amazonInfo) {
        finalSubcategory = inferSubcategory({
          category: product.category,
          title: amazonInfo.title,
          features: amazonInfo.features,
          technicalInfo: amazonInfo.technicalInfo,
        });
        if (finalSubcategory) {
          console.log(`  [SubcategoryInferred] ${product.name} → ${finalSubcategory}`);
        }
      }

      // タグを抽出（Amazon情報があれば）
      let productTags: string[] | undefined;
      if (amazonInfo) {
        productTags = extractProductTags({
          category: product.category,
          subcategory: finalSubcategory,
          title: amazonInfo.title,
          features: amazonInfo.features,
          technicalInfo: amazonInfo.technicalInfo,
        });
        if (productTags.length > 0) {
          console.log(`  [TagsExtracted] ${product.name} → [${productTags.join(", ")}]`);
        }
      }

      matchedProducts.push({
        name: product.name,
        brand: product.brand,
        category: product.category,
        subcategory: finalSubcategory,
        reason: product.reason,
        confidence: product.confidence,
        tags: productTags,
        amazon: amazonInfo ? {
          asin: amazonInfo.id,
          title: amazonInfo.title,
          url: amazonInfo.url,
          imageUrl: amazonInfo.imageUrl,
          price: amazonInfo.price,
        } : null,
        source: amazonInfo?.source,
        matchScore,
        matchReason,
      });
    }

    // 8. DBに保存（オプション）
    if (saveToDb) {
      console.log("Saving to database...");

      // 著者をインフルエンサーとして保存
      const authorId = generateAuthorId(url, articleInfo.author);
      await saveInfluencer({
        author_id: authorId,
        author_name: articleInfo.author || undefined,
        source_type: "article",
        thumbnail_url: articleInfo.thumbnailUrl || undefined,
        occupation: analysisResult.influencerOccupation || undefined,
        occupation_tags: analysisResult.influencerOccupationTags,
      });

      // 記事を保存
      await saveArticle({
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

      // 商品を保存
      for (const product of matchedProducts) {
        const savedProduct = await saveProduct({
          name: product.name,
          brand: product.brand || undefined,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
          article_id: articleInfo.url,
          source_type: "article",
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
              amazon_features: originalProduct?.features,
              amazon_technical_info: originalProduct?.technicalInfo,
            },
            priceRange || undefined
          );
        }
      }
    }

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
        products: matchedProducts,
      },
      isRelevant,
      savedToDb: saveToDb,
    });
  } catch (error) {
    console.error("Article analysis error:", error);
    return NextResponse.json(
      { error: "解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
