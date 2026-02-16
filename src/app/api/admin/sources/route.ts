import { NextRequest, NextResponse } from "next/server";
import * as queries from "@/lib/supabase/queries-unified";
import * as mutations from "@/lib/supabase/mutations-unified";
import type { DomainId } from "@/lib/domain";
import type { FuzzyCategoryCache } from "@/lib/supabase/mutations-unified";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const domain = (searchParams.get("domain") || "desktour") as DomainId;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  if (type !== "video" && type !== "article") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (type === "video") {
    const { videos, total } = await queries.getVideos(domain, { page, limit, sortBy: "published_at" });
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

  const { articles, total } = await queries.getArticles(domain, { page, limit, sortBy: "published_at" });
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
        id?: string; name: string; brand?: string; category: string; tags?: string[]; reason?: string;
        asin?: string; amazon_url?: string; amazon_image_url?: string; amazon_price?: number; product_source?: string;
      }>;
    } = body;

    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "sourceType と sourceId は必須です" }, { status: 400 });
    }

    const domainId: DomainId = domain || "desktour";
    const errors: string[] = [];

    // 1. ソースメタデータ更新（summary + tags）
    const metadataOk = await mutations.updateSourceMetadata(domainId, sourceType, sourceId, { summary, tags });
    if (!metadataOk) errors.push("ソースメタデータの更新に失敗");

    // 2. インフルエンサー職業タグ更新
    if (occupationTags) {
      const occupationOk = await mutations.updateInfluencerOccupationTags(domainId, sourceType, sourceId, occupationTags);
      if (!occupationOk) errors.push("職業タグの更新に失敗");
    }

    // 3. 商品の追加・削除・更新（diffベース）
    if (products && Array.isArray(products)) {
      // 3a. 現在のDB上の商品IDリストを取得
      const sourceDetail = await queries.getSourceDetail(domainId, sourceType, sourceId);
      const existingProductIds = new Set(
        (sourceDetail?.products || []).map((p) => p.id)
      );

      // 3b. ペイロード内の既存商品IDセット
      const incomingProductIds = new Set(
        products.filter((p) => p.id).map((p) => p.id!)
      );

      // 3c. 削除: DBにあるがペイロードにない商品 → mention削除 + 孤児掃除
      const removedProductIds = [...existingProductIds].filter(
        (id) => !incomingProductIds.has(id)
      );
      for (const removedId of removedProductIds) {
        const result = await mutations.deleteMentionAndCleanupOrphan(
          domainId, removedId, sourceType, sourceId
        );
        if (!result.success) {
          errors.push(`商品の言及削除に失敗: ${result.error}`);
        }
      }

      // 3d. 追加: idがない商品 → saveProduct（find-or-create + saveMention）
      const newProducts = products.filter((p) => !p.id);
      if (newProducts.length > 0) {
        const fuzzyCategoryCache: FuzzyCategoryCache = new Map();
        for (const p of newProducts) {
          if (!p.name.trim()) continue; // 空名はスキップ
          const saveResult = await mutations.saveProduct(
            domainId,
            {
              name: p.name,
              brand: p.brand || undefined,
              category: p.category,
              tags: p.tags,
              reason: p.reason || "",
              confidence: "medium",
              video_id: sourceType === "video" ? sourceId : undefined,
              article_id: sourceType === "article" ? sourceId : undefined,
              source_type: sourceType,
            },
            fuzzyCategoryCache
          );
          if (!saveResult.product || !saveResult.product.id) {
            errors.push(`新規商品 ${p.name} の保存に失敗`);
          } else if (p.asin) {
            // Amazon情報がある場合は商品メタデータも更新
            await mutations.updateProductMetadata(domainId, saveResult.product.id, {
              asin: p.asin,
              amazon_url: p.amazon_url,
              amazon_image_url: p.amazon_image_url,
              amazon_price: p.amazon_price,
              product_source: p.product_source,
            });
          }
        }
      }

      // 3e. 更新: 既存商品（idあり）→ 統合チェック + メタデータ + reason更新
      const existingProducts = products.filter((p) => p.id);
      for (const p of existingProducts) {
        // 統合チェック: 変更後の名前/ASINが別の既存商品と一致するか
        const mergeTarget = await mutations.findExistingProductByAsinOrName(domainId, {
          asin: p.asin,
          name: p.name,
          brand: p.brand || undefined,
          excludeId: p.id!,
        });

        if (mergeTarget) {
          // 既存商品が見つかった → mentionを付け替え
          console.log(`[PUT sources] Merging product ${p.id} → ${mergeTarget.id} (${mergeTarget.name})`);
          const reassignResult = await mutations.reassignMention(
            domainId, p.id!, mergeTarget.id, sourceType, sourceId, p.reason
          );
          if (!reassignResult.success) {
            errors.push(`商品 ${p.name} の統合に失敗: ${reassignResult.error}`);
          }
          // 付け替え先のAmazon情報も更新（新しい情報があれば）
          if (p.asin) {
            await mutations.updateProductMetadata(domainId, mergeTarget.id, {
              asin: p.asin, amazon_url: p.amazon_url, amazon_image_url: p.amazon_image_url,
              amazon_price: p.amazon_price, product_source: p.product_source,
            });
          }
        } else {
          // 一致する既存商品なし → 従来通りメタデータ更新
          const productOk = await mutations.updateProductMetadata(domainId, p.id!, {
            name: p.name, brand: p.brand, category: p.category, tags: p.tags,
            asin: p.asin, amazon_url: p.amazon_url, amazon_image_url: p.amazon_image_url,
            amazon_price: p.amazon_price, product_source: p.product_source,
          });
          if (!productOk) errors.push(`商品 ${p.name} の更新に失敗`);

          if (p.reason !== undefined) {
            const reasonOk = await mutations.updateMentionReason(domainId, p.id!, sourceType, sourceId, p.reason);
            if (!reasonOk) errors.push(`商品 ${p.name} のコメント文更新に失敗`);
          }
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

    const domainId: DomainId = domain || "desktour";
    const result = await mutations.deleteSource(domainId, sourceType, sourceId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete source error:", error);
    return NextResponse.json({ error: "削除中にエラーが発生しました" }, { status: 500 });
  }
}
