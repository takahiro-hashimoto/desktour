/**
 * Amazon/楽天商品検索 API ハンドラ（デスクツアー・撮影機材DB共通）
 */
import { searchAmazonCandidates, getProductByAsin, searchRakutenCandidates } from "@/lib/product-search";
import { extractProductTags } from "@/lib/tag-inference";
import { NextRequest, NextResponse } from "next/server";

// GET: キーワードで候補一覧を取得（Amazon or 楽天）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const brand = searchParams.get("brand") || undefined;
  const source = searchParams.get("source") || "amazon";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const candidates = source === "rakuten"
      ? await searchRakutenCandidates(name, brand)
      : await searchAmazonCandidates(name, brand);
    return NextResponse.json({ candidates });
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
