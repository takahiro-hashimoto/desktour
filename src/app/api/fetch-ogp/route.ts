import { NextRequest, NextResponse } from "next/server";
import {
  fetchOfficialProductInfo,
  getBrandFromDomain,
  extractDomain,
} from "@/lib/ogp";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URLが指定されていません" },
        { status: 400 }
      );
    }

    // URLの形式チェック
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "無効なURL形式です" },
        { status: 400 }
      );
    }

    const info = await fetchOfficialProductInfo(url);

    if (!info) {
      return NextResponse.json(
        { error: "OGP情報を取得できませんでした" },
        { status: 404 }
      );
    }

    const domain = extractDomain(info.url);
    const brand = getBrandFromDomain(domain);

    return NextResponse.json({
      title: info.title || "",
      imageUrl: info.image || "",
      siteName: info.siteName || "",
      url: info.url,
      domain,
      brand: brand || "",
    });
  } catch (error) {
    console.error("[fetch-ogp] Error:", error);
    return NextResponse.json(
      { error: "OGP情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
