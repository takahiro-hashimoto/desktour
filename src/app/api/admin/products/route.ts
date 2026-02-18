import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import * as mutations from "@/lib/supabase/mutations-unified";
import type { DomainId } from "@/lib/domain";
import { getDomainConfig } from "@/lib/domain";
import { normalizeProductName } from "@/lib/product-normalize";

// 商品一覧取得（検索・フィルタ・ページネーション対応）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = (searchParams.get("domain") || "desktour") as DomainId;
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "30");
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category") || "";
  const offset = (page - 1) * limit;

  const config = getDomainConfig(domain);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase
      .from(config.tables.products)
      .select("*", { count: "exact" }) as any);

    // テキスト検索（名前 or ブランド部分一致）
    if (search) {
      query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    // カテゴリフィルタ
    if (category) {
      query = query.eq("category", category);
    }

    query = query
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/admin/products] Error:", error);
      return NextResponse.json({ error: "商品の取得に失敗しました" }, { status: 500 });
    }

    const products = data || [];
    const productIds = products.map((p: { id: string }) => p.id);

    // mention_count を別途集計
    let mentionCountMap: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: mentions } = await supabase
        .from(config.tables.product_mentions)
        .select("product_id")
        .in("product_id", productIds)
        .neq("confidence", "low");

      if (mentions) {
        mentionCountMap = {};
        for (const m of mentions) {
          const pid = (m as { product_id: string }).product_id;
          mentionCountMap[pid] = (mentionCountMap[pid] || 0) + 1;
        }
      }
    }

    // レスポンス整形
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || null,
      category: p.category,
      tags: p.tags || [],
      asin: p.asin || null,
      amazon_image_url: p.amazon_image_url || null,
      slug: p.slug || null,
      mention_count: mentionCountMap[p.id] || 0,
      amazon_features: p.amazon_features || [],
    }));

    return NextResponse.json({ products: result, total: count || 0 });
  } catch (error) {
    console.error("[GET /api/admin/products] Error:", error);
    return NextResponse.json({ error: "商品の取得に失敗しました" }, { status: 500 });
  }
}

// 商品メタデータ更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, productId, data }: {
      domain?: DomainId;
      productId: string;
      data: { name?: string; brand?: string; category?: string; tags?: string[]; amazon_features?: string[] };
    } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId は必須です" }, { status: 400 });
    }

    const domainId: DomainId = domain || "desktour";
    const config = getDomainConfig(domainId);

    // normalized_name を同時更新（名前変更時）
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.normalized_name = normalizeProductName(data.name);
    }
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.amazon_features !== undefined) updateData.amazon_features = data.amazon_features;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from(config.tables.products)
      .update(updateData)
      .eq("id", productId);

    if (error) {
      console.error("[PUT /api/admin/products] Error:", error);
      return NextResponse.json({ error: "商品の更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/admin/products] Error:", error);
    return NextResponse.json({ error: "更新中にエラーが発生しました" }, { status: 500 });
  }
}
