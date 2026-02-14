import { supabase } from "./client";
import type { Video, Article, Product, ProductMention, Influencer } from "./types";
import { normalizeProductName } from "../product-normalize";
import { generateProductSlug } from "../productSlug";
import { extractProductTags } from "../tag-inference";
import { normalizeBrand } from "./queries-common";
import { BRAND_TAGS } from "../constants";
import { fuzzyMatchProduct } from "../fuzzy-product-match";

// 動画が既に解析済みかチェック
export async function isVideoAnalyzed(videoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("videos")
    .select("id")
    .eq("video_id", videoId)
    .single();

  return !!data;
}

// 記事が既に解析済みかチェック
export async function isArticleAnalyzed(url: string): Promise<boolean> {
  const { data } = await supabase
    .from("articles")
    .select("id")
    .eq("url", url)
    .single();

  return !!data;
}

// 記事を保存
export async function saveArticle(article: Article): Promise<{ data: Article | null; isNew: boolean }> {
  // 既存チェック
  const { data: existing } = await supabase
    .from("articles")
    .select("*")
    .eq("url", article.url)
    .single();

  if (existing) {
    return { data: existing as Article, isNew: false };
  }

  const { data, error } = await supabase
    .from("articles")
    .insert([article])
    .select()
    .single();

  if (error) {
    console.error("Error saving article:", error);
    return { data: null, isNew: false };
  }

  return { data: data as Article, isNew: true };
}

// 動画を保存
export async function saveVideo(video: Video): Promise<{ data: Video | null; isNew: boolean }> {
  // 既存チェック
  const { data: existing } = await supabase
    .from("videos")
    .select("*")
    .eq("video_id", video.video_id)
    .single();

  if (existing) {
    return { data: existing as Video, isNew: false };
  }

  const { data, error } = await supabase
    .from("videos")
    .insert([video])
    .select()
    .single();

  if (error) {
    console.error("Error saving video:", error);
    return { data: null, isNew: false };
  }

  return { data: data as Video, isNew: true };
}

// 商品を保存（正規化名で重複チェック - 色違い・サイズ違いを統合）
export interface SaveProductResult<T> {
  product: T | null;
  isExisting: boolean;
}

// ファジーマッチ用カテゴリキャッシュ型（ループ内で使い回してSupabaseクエリを削減）
export type FuzzyCategoryCache = Map<string, Array<{ id: string; name: string; normalized_name: string; brand: string | null }>>;

export async function saveProduct(
  product: Omit<Product, "id">,
  fuzzyCategoryCache?: FuzzyCategoryCache
): Promise<SaveProductResult<Product>> {
  // ブランド名を正規化
  if (product.brand) {
    const originalBrand = product.brand;
    const normalized = await normalizeBrand(product.brand, "products", BRAND_TAGS);
    if (originalBrand !== normalized) {
      console.log(`[saveProduct] Brand normalized: "${originalBrand}" → "${normalized}"`);
      product = { ...product, brand: normalized };
    }
  }

  // 正規化名を生成（色・サイズ表記を除去）
  const normalizedName = normalizeProductName(product.name);
  console.log(`[saveProduct] Original: "${product.name}" → Normalized: "${normalizedName}"`);

  // 【最適化】正規化名と通常名を1回のクエリでチェック
  const { data: existingProducts } = await supabase
    .from("products")
    .select("*")
    .or(`normalized_name.eq.${normalizedName},name.eq.${product.name}`)
    .limit(2);

  let existing = null;
  if (existingProducts && existingProducts.length > 0) {
    // 正規化名でのマッチを優先
    existing = existingProducts.find(p => p.normalized_name === normalizedName)
      || existingProducts[0];
    console.log(`[saveProduct] Found existing: "${existing.name}" (matched by ${existing.normalized_name === normalizedName ? 'normalized_name' : 'name'})`);
  }

  // --- ファジーマッチフォールバック ---
  if (!existing && product.category) {
    // キャッシュがあればカテゴリ単位で再利用（同カテゴリの商品を何度もDBから取得しない）
    let sameCategoryProducts = fuzzyCategoryCache?.get(product.category);

    if (!sameCategoryProducts) {
      const { data } = await supabase
        .from("products")
        .select("id, name, normalized_name, brand")
        .eq("category", product.category)
        .limit(200);
      sameCategoryProducts = (data || []) as Array<{ id: string; name: string; normalized_name: string; brand: string | null }>;
      fuzzyCategoryCache?.set(product.category, sameCategoryProducts);
    }

    if (sameCategoryProducts.length > 0) {
      const fuzzyResult = fuzzyMatchProduct(
        normalizedName,
        sameCategoryProducts,
        product.brand
      );
      if (fuzzyResult) {
        const matched = sameCategoryProducts[fuzzyResult.index];
        console.log(`[saveProduct] Fuzzy match: "${product.name}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
        // 既存商品のフルデータを取得
        const { data: fullProduct } = await supabase
          .from("products")
          .select("*")
          .eq("id", matched.id)
          .single();
        if (fullProduct) existing = fullProduct;
      }
    }
  }

  if (existing) {
    // 既存商品のフィールドをアップデート（変更があるもののみ）
    const updateData: Record<string, unknown> = {};

    if (product.brand !== undefined && product.brand !== existing.brand) {
      updateData.brand = product.brand;
    }
    if (product.category && product.category !== existing.category) {
      updateData.category = product.category;
    }
    if (product.tags && product.tags.length > 0) {
      updateData.tags = product.tags;
    }

    // Amazon/楽天情報の更新（手動選択・公式サイト登録時に渡される）
    if (product.asin && !existing.asin) {
      updateData.asin = product.asin;
      if (product.amazon_url) updateData.amazon_url = product.amazon_url;
      if (product.amazon_image_url) updateData.amazon_image_url = product.amazon_image_url;
      if (product.amazon_price) updateData.amazon_price = product.amazon_price;
      if (product.product_source) updateData.product_source = product.product_source;
    }

    if (Object.keys(updateData).length > 0) {
      console.log(`[saveProduct] Updating existing "${existing.name}":`, Object.keys(updateData));
      const { data: updated, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      if (!error && updated) existing = updated;
    }

    // 既存の商品に新しいソースからの言及を追加
    await saveMention({
      product_id: existing.id,
      video_id: product.video_id,
      article_id: product.article_id,
      source_type: product.source_type,
      reason: product.reason,
      confidence: product.confidence,
    });
    return { product: existing as Product, isExisting: true };
  }

  // 新規商品を保存（正規化名とslugも一緒に保存）
  const slug = generateProductSlug({
    name: product.name,
    brand: product.brand,
    asin: product.asin,
  });

  const productWithNormalized = {
    ...product,
    normalized_name: normalizedName,
    slug,
  };

  const { data, error } = await supabase
    .from("products")
    .insert([productWithNormalized])
    .select()
    .single();

  if (error) {
    console.error("Error saving product:", error);
    return { product: null, isExisting: false };
  }

  // 言及も保存
  await saveMention({
    product_id: data.id,
    video_id: product.video_id,
    article_id: product.article_id,
    source_type: product.source_type,
    reason: product.reason,
    confidence: product.confidence,
  });

  console.log(`[saveProduct] Created new product: "${data.name}" (normalized: "${normalizedName}", slug: "${slug}")`);
  return { product: data as Product, isExisting: false };
}

// 言及を保存
// 【最適化】UPSERTを使用してSELECT+INSERTの2回のクエリを1回に削減
export async function saveMention(mention: Omit<ProductMention, "id">): Promise<ProductMention | null> {
  // UPSERTで重複時は何もしない（onConflictで一意制約を指定）
  // 注: product_mentionsテーブルに (product_id, video_id) と (product_id, article_id) の
  //     複合一意制約がある前提。なければ従来のSELECT+INSERT方式にフォールバック
  try {
    const { data, error } = await supabase
      .from("product_mentions")
      .upsert([mention], {
        onConflict: mention.video_id ? "product_id,video_id" : "product_id,article_id",
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (error) {
      // 一意制約がない場合は従来方式にフォールバック
      if (error.code === "42P10" || error.message?.includes("constraint")) {
        return await saveMentionLegacy(mention);
      }
      console.error("Error saving mention:", error);
      return null;
    }

    return data as ProductMention;
  } catch {
    // エラー時は従来方式にフォールバック
    return await saveMentionLegacy(mention);
  }
}

// 従来のSELECT+INSERT方式（フォールバック用）
async function saveMentionLegacy(mention: Omit<ProductMention, "id">): Promise<ProductMention | null> {
  let query = supabase
    .from("product_mentions")
    .select("*")
    .eq("product_id", mention.product_id);

  if (mention.source_type === "video" && mention.video_id) {
    query = query.eq("video_id", mention.video_id);
  } else if (mention.source_type === "article" && mention.article_id) {
    query = query.eq("article_id", mention.article_id);
  }

  const { data: existing } = await query.single();

  if (existing) {
    return existing as ProductMention;
  }

  const { data, error } = await supabase
    .from("product_mentions")
    .insert([mention])
    .select()
    .single();

  if (error) {
    console.error("Error saving mention (legacy):", error);
    return null;
  }

  return data as ProductMention;
}

// 商品をAmazon/楽天情報で更新
// 【最適化】既にASINがある商品はスキップ（skipIfHasAsin: trueの場合）
export async function updateProductWithAmazon(
  productId: string,
  productInfo: {
    asin: string;                  // 楽天の場合はitemCode
    amazon_url: string;            // 楽天の場合はaffiliateUrl
    amazon_image_url: string;      // 楽天の場合はmediumImageUrls
    amazon_price?: number;         // 楽天の場合はitemPrice
    amazon_title: string;          // 楽天の場合はitemName
    product_source?: "amazon" | "rakuten";
    rakuten_shop_name?: string;
    // Amazon詳細スペック（楽天では取得不可）
    amazon_manufacturer?: string;
    amazon_brand?: string;
    amazon_model_number?: string;
    amazon_color?: string;
    amazon_size?: string;
    amazon_weight?: string;
    amazon_release_date?: string;
    amazon_features?: string[];     // 要約後の特徴（表示用）
    amazon_features_raw?: string[]; // 原文の特徴（将来の再利用用）
    amazon_technical_info?: Record<string, string>;
    // カテゴリ情報（Amazon）
    amazon_categories?: string[];   // カテゴリ階層
    amazon_product_group?: string;  // 商品グループ
  },
  priceRange?: string,
  skipIfHasAsin: boolean = false
): Promise<boolean> {
  // 【最適化】既にASINがある場合はスキップ（オプション）
  if (skipIfHasAsin) {
    const { data: existing } = await supabase
      .from("products")
      .select("asin")
      .eq("id", productId)
      .single();

    if (existing?.asin) {
      console.log(`[updateProductWithAmazon] Skipping ${productId} - already has ASIN: ${existing.asin}`);
      return true;
    }
  }

  // 【重複検知】同じASINを持つ別の商品が既に存在するかチェック
  if (productInfo.asin) {
    const { data: duplicateProduct } = await supabase
      .from("products")
      .select("id, name")
      .eq("asin", productInfo.asin)
      .neq("id", productId)
      .maybeSingle();

    if (duplicateProduct) {
      console.log(`[updateProductWithAmazon] ASIN重複検出: "${productInfo.asin}" は既に "${duplicateProduct.name}" (${duplicateProduct.id}) に割り当て済み`);
      // 重複商品のmentionsを既存商品に移行して、新規商品を削除
      const { error: migrateError } = await supabase
        .from("product_mentions")
        .update({ product_id: duplicateProduct.id })
        .eq("product_id", productId);

      if (!migrateError) {
        await supabase.from("products").delete().eq("id", productId);
        console.log(`[updateProductWithAmazon] Mentions migrated to ${duplicateProduct.id}, duplicate ${productId} deleted`);
      }
      return true;
    }
  }

  // Amazon情報からタグを抽出（種類タグ + 特徴タグ を統合）
  let extractedTags: string[] | undefined;

  const { data: product } = await supabase
    .from("products")
    .select("category")
    .eq("id", productId)
    .single();

  if (product) {
    extractedTags = extractProductTags({
      category: product.category,
      title: productInfo.amazon_title,
      features: productInfo.amazon_features,
      technicalInfo: productInfo.amazon_technical_info,
      amazonCategories: productInfo.amazon_categories,
      brand: productInfo.amazon_brand,
    });
  }

  const updateData: Record<string, unknown> = { ...productInfo };
  if (priceRange) {
    updateData.price_range = priceRange;
  }
  if (extractedTags && extractedTags.length > 0) {
    updateData.tags = extractedTags;
    console.log(`[updateProductWithAmazon] Extracted tags for ${productId}:`, extractedTags);
  }

  const { error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId);

  if (error) {
    console.error("Error updating product with Amazon/Rakuten info:", error);
    return false;
  }

  return true;
}

// インフルエンサーを保存または更新（YouTube）
export async function saveInfluencer(influencer: Omit<Influencer, "id" | "created_at" | "updated_at">): Promise<Influencer | null> {
  console.log("[saveInfluencer] Called with:", JSON.stringify({
    channel_id: influencer.channel_id,
    channel_title: influencer.channel_title,
    source_type: influencer.source_type,
    occupation: influencer.occupation,
    occupation_tags: influencer.occupation_tags,
  }, null, 2));

  if (influencer.source_type === "youtube" && influencer.channel_id) {
    // 既存チェック
    const { data: existing, error: existingError } = await supabase
      .from("influencers")
      .select("*")
      .eq("channel_id", influencer.channel_id)
      .single();

    console.log("[saveInfluencer] Existing check:", {
      found: !!existing,
      error: existingError?.code,
      existing_id: existing?.id,
      existing_tags: existing?.occupation_tags,
    });

    if (existing) {
      // 更新データを準備
      const updateData: Record<string, unknown> = {
        subscriber_count: influencer.subscriber_count,
        video_count: (existing.video_count || 0) + 1,
        updated_at: new Date().toISOString(),
      };

      // サムネイルURLを更新（チャンネルアイコン）
      if (influencer.thumbnail_url) {
        updateData.thumbnail_url = influencer.thumbnail_url;
      }

      // 職種情報を更新（新しい情報がある場合）
      if (influencer.occupation && !existing.occupation) {
        updateData.occupation = influencer.occupation;
      }
      // occupation_tagsは新しい解析結果があれば上書き（1人1職業の原則）
      if (influencer.occupation_tags && influencer.occupation_tags.length > 0) {
        updateData.occupation_tags = influencer.occupation_tags.slice(0, 1);
      }

      console.log("[saveInfluencer] Updating existing influencer with:", JSON.stringify(updateData, null, 2));

      const { data, error } = await supabase
        .from("influencers")
        .update(updateData)
        .eq("channel_id", influencer.channel_id)
        .select()
        .single();

      if (error) {
        console.error("[saveInfluencer] Error updating influencer:", error);
        return existing as Influencer;
      }
      console.log("[saveInfluencer] Update SUCCESS:", { id: data.id, occupation_tags: data.occupation_tags });
      return data as Influencer;
    }

    // 新規作成
    const insertData = { ...influencer, video_count: 1 };
    console.log("[saveInfluencer] Inserting new influencer:", JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from("influencers")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("[saveInfluencer] Error saving influencer:", error);
      return null;
    }

    console.log("[saveInfluencer] Insert SUCCESS:", { id: data.id, occupation_tags: data.occupation_tags });
    return data as Influencer;
  }

  // 記事著者の場合
  if (influencer.source_type === "article" && influencer.author_id) {
    const { data: existing } = await supabase
      .from("influencers")
      .select("*")
      .eq("author_id", influencer.author_id)
      .single();

    if (existing) {
      const updateData: Record<string, unknown> = {
        article_count: (existing.article_count || 0) + 1,
        updated_at: new Date().toISOString(),
      };

      if (influencer.occupation && !existing.occupation) {
        updateData.occupation = influencer.occupation;
      }
      // occupation_tagsは新しい解析結果があれば上書き（1人1職業の原則）
      if (influencer.occupation_tags && influencer.occupation_tags.length > 0) {
        updateData.occupation_tags = influencer.occupation_tags.slice(0, 1);
      }

      const { data, error } = await supabase
        .from("influencers")
        .update(updateData)
        .eq("author_id", influencer.author_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating article author:", error);
        return existing as Influencer;
      }
      return data as Influencer;
    }

    // 新規作成
    const { data, error } = await supabase
      .from("influencers")
      .insert([{ ...influencer, article_count: 1 }])
      .select()
      .single();

    if (error) {
      console.error("Error saving article author:", error);
      return null;
    }

    return data as Influencer;
  }

  return null;
}

// ========== 再編集用の更新関数 ==========

// 動画/記事のメタデータ更新（summary, tags）
export async function updateSourceMetadata(
  sourceType: "video" | "article",
  sourceId: string,
  data: { summary: string; tags: string[] }
): Promise<boolean> {
  if (sourceType === "video") {
    const { error } = await supabase
      .from("videos")
      .update({ summary: data.summary, tags: data.tags })
      .eq("video_id", sourceId);
    if (error) {
      console.error("Error updating video metadata:", error);
      return false;
    }
    return true;
  } else {
    const { error } = await supabase
      .from("articles")
      .update({ summary: data.summary, tags: data.tags })
      .eq("url", sourceId);
    if (error) {
      console.error("Error updating article metadata:", error);
      return false;
    }
    return true;
  }
}

// インフルエンサーの職業タグ更新
export async function updateInfluencerOccupationTags(
  sourceType: "video" | "article",
  sourceId: string,
  occupationTags: string[]
): Promise<boolean> {
  if (sourceType === "video") {
    const { data: video } = await supabase
      .from("videos")
      .select("channel_id")
      .eq("video_id", sourceId)
      .single();
    if (!video?.channel_id) return false;

    const { error } = await supabase
      .from("influencers")
      .update({ occupation_tags: occupationTags })
      .eq("channel_id", video.channel_id);
    if (error) {
      console.error("Error updating influencer occupation_tags:", error);
      return false;
    }
    return true;
  } else {
    // 記事の場合: author_idのドメインマッチでインフルエンサーを特定
    const { data: influencers } = await supabase
      .from("influencers")
      .select("id, author_id")
      .not("author_id", "is", null);

    const match = influencers?.find(inf => {
      if (!inf.author_id) return false;
      const domain = inf.author_id.split(":")[0];
      return domain && sourceId.includes(domain);
    });
    if (!match) return false;

    const { error } = await supabase
      .from("influencers")
      .update({ occupation_tags: occupationTags })
      .eq("id", match.id);
    if (error) {
      console.error("Error updating article author occupation_tags:", error);
      return false;
    }
    return true;
  }
}

// 商品のコメント文（reason）更新
export async function updateMentionReason(
  productId: string,
  sourceType: "video" | "article",
  sourceId: string,
  reason: string
): Promise<boolean> {
  const column = sourceType === "video" ? "video_id" : "article_id";
  const { error } = await supabase
    .from("product_mentions")
    .update({ reason })
    .eq("product_id", productId)
    .eq(column, sourceId);
  if (error) {
    console.error("Error updating mention reason:", error);
    return false;
  }
  return true;
}

// ソース（動画/記事）を削除
// 関連するproduct_mentionsも削除し、mentionが0になった商品も削除する
export async function deleteSource(
  sourceType: "video" | "article",
  sourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mentionColumn = sourceType === "video" ? "video_id" : "article_id";

    // 1. 関連するproduct_mentionsを取得（orphan商品チェック用）
    const { data: mentions } = await supabase
      .from("product_mentions")
      .select("product_id")
      .eq(mentionColumn, sourceId);

    const affectedProductIds = [...new Set((mentions || []).map(m => m.product_id))];

    // 2. product_mentionsを削除
    const { error: mentionError } = await supabase
      .from("product_mentions")
      .delete()
      .eq(mentionColumn, sourceId);

    if (mentionError) {
      console.error("Error deleting product_mentions:", mentionError);
      return { success: false, error: "product_mentionsの削除に失敗" };
    }

    // 3. ソース本体を削除
    if (sourceType === "video") {
      const { error } = await supabase.from("videos").delete().eq("video_id", sourceId);
      if (error) {
        console.error("Error deleting video:", error);
        return { success: false, error: "動画の削除に失敗" };
      }
    } else {
      const { error } = await supabase.from("articles").delete().eq("url", sourceId);
      if (error) {
        console.error("Error deleting article:", error);
        return { success: false, error: "記事の削除に失敗" };
      }
    }

    // 4. orphanになった商品（mentionが0件）を削除
    let orphanDeleted = 0;
    for (const productId of affectedProductIds) {
      const { count } = await supabase
        .from("product_mentions")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);

      if (count === 0) {
        await supabase.from("products").delete().eq("id", productId);
        orphanDeleted++;
      }
    }

    console.log(`[deleteSource] Deleted ${sourceType} ${sourceId}, ${mentions?.length || 0} mentions removed, ${orphanDeleted} orphan products cleaned up`);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteSource:", error);
    return { success: false, error: "削除中にエラーが発生しました" };
  }
}

// 商品メタデータ更新（name, brand, category, tags）
export async function updateProductMetadata(
  productId: string,
  data: {
    name?: string; brand?: string; category?: string; tags?: string[];
    asin?: string; amazon_url?: string; amazon_image_url?: string;
    amazon_price?: number; product_source?: string;
  }
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.asin !== undefined) updateData.asin = data.asin;
  if (data.amazon_url !== undefined) updateData.amazon_url = data.amazon_url;
  if (data.amazon_image_url !== undefined) updateData.amazon_image_url = data.amazon_image_url;
  if (data.amazon_price !== undefined) updateData.amazon_price = data.amazon_price;
  if (data.product_source !== undefined) updateData.product_source = data.product_source;

  if (Object.keys(updateData).length === 0) return true;

  const { error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId);
  if (error) {
    console.error("Error updating product metadata:", error);
    return false;
  }
  return true;
}
