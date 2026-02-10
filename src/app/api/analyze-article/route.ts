import { NextRequest, NextResponse } from "next/server";
import { getArticleInfo, isDeskTourArticle } from "@/lib/article";
import { analyzeArticle } from "@/lib/gemini";
import {
  saveArticle,
  isArticleAnalyzed,
  saveInfluencer,
  saveMatchedProducts,
} from "@/lib/supabase";
import { getProductsByAsins } from "@/lib/product-search";
import { extractProductsFromDescription, ExtractedProduct } from "@/lib/description-links";
import { ProductInfo } from "@/lib/product-search";
import {
  generateAuthorId,
  buildCandidates,
  matchProductWithAmazon,
  toAmazonField,
  type MatchedProduct,
} from "@/lib/product-matching";
import { checkExistingProducts } from "@/lib/supabase/queries-common";

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

    // 7. Gemini APIで解析（商品ヒント付き）
    console.log("Analyzing article with Gemini...");
    const analysisResult = await analyzeArticle(articleInfo.content, articleInfo.title, "desktour", productHints);
    console.log(`Found ${analysisResult.products.length} products`);
    console.log(`Author occupation: ${analysisResult.influencerOccupation}`);

    // 7. 商品のAmazon/楽天マッチング（プレビュー・保存共通）
    console.log("Matching products with Amazon/Rakuten...");

    const matchedProducts: MatchedProduct[] = [];
    const candidates = buildCandidates(asinProductMap);
    const usedAsins = new Set<string>();

    for (const product of analysisResult.products) {
      console.log(`Processing product: ${product.name} (brand: ${product.brand})`);

      if (product.confidence === "high" || product.confidence === "medium") {
        const result = await matchProductWithAmazon({
          productName: product.name,
          productBrand: product.brand,
          productCategory: product.category,
          candidates,
          usedAsins,
        });

        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
          tags: result.productTags,
          amazon: toAmazonField(result.amazonInfo),
          source: result.amazonInfo?.source,
          matchScore: result.matchScore,
          matchReason: result.matchReason,
        });
      } else {
        matchedProducts.push({
          name: product.name,
          brand: product.brand,
          category: product.category,
          reason: product.reason,
          confidence: product.confidence,
        });
      }
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

      // 商品を保存（共通ユーティリティを使用）
      await saveMatchedProducts(
        matchedProducts,
        { article_id: articleInfo.url, source_type: "article" },
        candidates
      );
    }

    // 既存商品チェック（プレビュー用）
    const existingMap = await checkExistingProducts(
      matchedProducts.map(p => p.name),
      "products"
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
    console.error("Article analysis error:", error);
    return NextResponse.json(
      { error: "解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
