/**
 * Amazon/楽天商品検索 API ハンドラ（デスクツアー・撮影機材DB共通）
 */
import { searchAmazonCandidates, getProductByAsin, searchRakutenCandidates } from "@/lib/product-search";
import { extractProductTags } from "@/lib/tag-inference";
import { searchExistingProducts } from "@/lib/supabase/queries-unified";
import type { DomainId } from "@/lib/domain";
import { NextRequest, NextResponse } from "next/server";

// GET: キーワードで候補一覧を取得（Amazon or 楽天）
// DB登録済み商品を優先して返す
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const brand = searchParams.get("brand") || undefined;
  const source = searchParams.get("source") || "amazon";
  const domain = (searchParams.get("domain") || "desktour") as DomainId;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    // DB登録済み商品を検索（優先表示用）
    const dbProducts = await searchExistingProducts(domain, name, 5);
    const dbCandidates = dbProducts
      .filter((p) => p.amazon_url || p.amazon_image_url)
      .map((p) => ({
        id: p.asin || p.id,
        title: p.name,
        url: p.amazon_url || "",
        imageUrl: p.amazon_image_url || "",
        price: p.amazon_price || undefined,
        brand: p.brand || undefined,
        isExisting: true,
        mentionCount: p.mention_count,
      }));

    // API検索
    const apiCandidates = source === "rakuten"
      ? await searchRakutenCandidates(name, brand)
      : await searchAmazonCandidates(name, brand);

    // DB候補のASINセットを作成（API結果から重複を除外）
    const dbAsinSet = new Set(dbProducts.map((p) => p.asin).filter(Boolean));
    const filteredApiCandidates = apiCandidates.filter(
      (c) => !dbAsinSet.has(c.id)
    );

    return NextResponse.json({
      candidates: filteredApiCandidates,
      dbCandidates,
    });
  } catch (error) {
    console.error(`${source} search error:`, error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

// POST: 商品詳細取得 + タグ再生成
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { asin, currentCategory, source, candidateData } = body;

  // 楽天の場合: 候補データからタグだけ再生成
  if (source === "rakuten" && candidateData) {
    const tags = extractProductTags({
      category: currentCategory || "",
      title: candidateData.title || "",
      features: [],
      technicalInfo: {},
    });

    return NextResponse.json({
      product: candidateData,
      tags,
    });
  }

  // Amazon: ASINからフル商品情報を取得
  if (!asin) {
    return NextResponse.json({ error: "asin is required" }, { status: 400 });
  }

  try {
    const product = await getProductByAsin(asin);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // タグ再生成
    const tags = extractProductTags({
      category: currentCategory || "",
      title: product.title,
      features: product.features,
      technicalInfo: product.technicalInfo,
    });

    return NextResponse.json({
      product,
      tags,
    });
  } catch (error) {
    console.error("Amazon product detail error:", error);
    return NextResponse.json({ error: "Failed to get product details" }, { status: 500 });
  }
}
