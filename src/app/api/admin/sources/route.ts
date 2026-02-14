import { NextRequest, NextResponse } from "next/server";
import { getVideos, getArticles, updateSourceMetadata, updateInfluencerOccupationTags, updateProductMetadata, updateMentionReason, deleteSource } from "@/lib/supabase";
import { getCameraVideos, getCameraArticles } from "@/lib/supabase/queries-camera";
import { updateCameraSourceMetadata, updateCameraInfluencerOccupationTags, updateCameraProductMetadata, updateCameraMentionReason, deleteCameraSource } from "@/lib/supabase/mutations-camera";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const domain = searchParams.get("domain"); // "camera" or default (desktour)
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  if (type !== "video" && type !== "article") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const isCamera = domain === "camera";

  if (type === "video") {
    const { videos, total } = isCamera
      ? await getCameraVideos({ page, limit, sortBy: "published_at" })
      : await getVideos({ page, limit, sortBy: "published_at" });
    const items = videos.map((v) => ({
      type: "video" as const,
      title: v.title,
      sourceId: v.video_id,
      channelTitle: v.channel_title,
      publishedAt: v.published_at,
      thumbnailUrl: v.thumbnail_url,
      productCount: (v as any).product_count ?? undefined,
    }));
    return NextResponse.json({ items, total });
  }

  const { articles, total } = isCamera
    ? await getCameraArticles({ page, limit, sortBy: "published_at" })
    : await getArticles({ page, limit, sortBy: "published_at" });
  const items = articles.map((a) => ({
    type: "article" as const,
    title: a.title,
    sourceId: a.url,
    author: a.author,
    publishedAt: a.published_at,
    thumbnailUrl: a.thumbnail_url,
    productCount: (a as any).product_count ?? undefined,
  }));
  return NextResponse.json({ items, total });
}

// 保存済みソースの再編集
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceType,
      sourceId,
      domain,
      summary,
      tags,
      occupationTags,
      products,
    }: {
      sourceType: "video" | "article";
      sourceId: string;
      domain?: "desktour" | "camera";
      summary: string;
      tags: string[];
      occupationTags: string[];
      products?: Array<{
        id: string; name: string; brand?: string; category: string; tags?: string[]; reason?: string;
        asin?: string; amazon_url?: string; amazon_image_url?: string; amazon_price?: number; product_source?: string;
      }>;
    } = body;

    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "sourceType と sourceId は必須です" }, { status: 400 });
    }

    const isCamera = domain === "camera";
    const errors: string[] = [];

    // 1. ソースメタデータ更新（summary + tags）
    const metadataOk = isCamera
      ? await updateCameraSourceMetadata(sourceType, sourceId, { summary, tags })
      : await updateSourceMetadata(sourceType, sourceId, { summary, tags });
    if (!metadataOk) errors.push("ソースメタデータの更新に失敗");

    // 2. インフルエンサー職業タグ更新
    if (occupationTags) {
      const occupationOk = isCamera
        ? await updateCameraInfluencerOccupationTags(sourceType, sourceId, occupationTags)
        : await updateInfluencerOccupationTags(sourceType, sourceId, occupationTags);
      if (!occupationOk) errors.push("職業タグの更新に失敗");
    }

    // 3. 各商品のメタデータ + コメント文更新
    if (products && Array.isArray(products)) {
      for (const p of products) {
        if (!p.id) continue;
        const productOk = isCamera
          ? await updateCameraProductMetadata(p.id, {
              name: p.name, brand: p.brand, category: p.category, tags: p.tags,
              asin: p.asin, amazon_url: p.amazon_url, amazon_image_url: p.amazon_image_url,
              amazon_price: p.amazon_price, product_source: p.product_source,
            })
          : await updateProductMetadata(p.id, {
              name: p.name, brand: p.brand, category: p.category, tags: p.tags,
              asin: p.asin, amazon_url: p.amazon_url, amazon_image_url: p.amazon_image_url,
              amazon_price: p.amazon_price, product_source: p.product_source,
            });
        if (!productOk) errors.push(`商品 ${p.name} の更新に失敗`);

        // コメント文（reason）更新
        if (p.reason !== undefined) {
          const reasonOk = isCamera
            ? await updateCameraMentionReason(p.id, sourceType, sourceId, p.reason)
            : await updateMentionReason(p.id, sourceType, sourceId, p.reason);
          if (!reasonOk) errors.push(`商品 ${p.name} のコメント文更新に失敗`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `一部の更新に失敗しました: ${errors.join("、")}`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update source error:", error);
    return NextResponse.json({ error: "更新中にエラーが発生しました" }, { status: 500 });
  }
}

// ソース削除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, sourceId, domain }: {
      sourceType: "video" | "article";
      sourceId: string;
      domain?: "desktour" | "camera";
    } = body;

    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "sourceType と sourceId は必須です" }, { status: 400 });
    }

    const isCamera = domain === "camera";
    const result = isCamera
      ? await deleteCameraSource(sourceType, sourceId)
      : await deleteSource(sourceType, sourceId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete source error:", error);
    return NextResponse.json({ error: "削除中にエラーが発生しました" }, { status: 500 });
  }
}
