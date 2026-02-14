import { supabase } from "./client";
import type { CameraVideo, CameraArticle, CameraProduct, CameraProductMention, CameraInfluencer } from "./types-camera";
import { normalizeProductName } from "../product-normalize";
import { generateProductSlug } from "../productSlug";
import { extractProductTags } from "../tag-inference";
import { normalizeBrand } from "./queries-common";
import { CAMERA_BRAND_TAGS } from "../camera/constants";
import { fuzzyMatchProduct } from "../fuzzy-product-match";

// 動画が既に解析済みかチェック
export async function isCameraVideoAnalyzed(videoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("videos_camera")
    .select("id")
    .eq("video_id", videoId)
    .single();

  return !!data;
}

// 記事が既に解析済みかチェック
export async function isCameraArticleAnalyzed(url: string): Promise<boolean> {
  const { data } = await supabase
    .from("articles_camera")
    .select("id")
    .eq("url", url)
    .single();

  return !!data;
}

// 記事を保存
export async function saveCameraArticle(article: CameraArticle): Promise<{ data: CameraArticle | null; isNew: boolean }> {
  // 既存チェック
  const { data: existing } = await supabase
    .from("articles_camera")
    .select("*")
    .eq("url", article.url)
    .single();

  if (existing) {
    return { data: existing as CameraArticle, isNew: false };
  }

  const { data, error } = await supabase
    .from("articles_camera")
    .insert([article])
    .select()
    .single();

  if (error) {
    console.error("Error saving camera article:", error);
    return { data: null, isNew: false };
  }

  return { data: data as CameraArticle, isNew: true };
}

// 動画を保存
export async function saveCameraVideo(video: CameraVideo): Promise<{ data: CameraVideo | null; isNew: boolean }> {
  // 既存チェック
  const { data: existing } = await supabase
    .from("videos_camera")
    .select("*")
    .eq("video_id", video.video_id)
    .single();

  if (existing) {
    return { data: existing as CameraVideo, isNew: false };
  }

  const { data, error } = await supabase
    .from("videos_camera")
    .insert([video])
    .select()
    .single();

  if (error) {
    console.error("Error saving camera video:", error);
    return { data: null, isNew: false };
  }

  return { data: data as CameraVideo, isNew: true };
}

// 商品を保存（正規化名で重複チェック - 色違い・サイズ違いを統合）
export interface SaveProductResult<T> {
  product: T | null;
  isExisting: boolean;
}

export type CameraFuzzyCategoryCache = Map<string, Array<{ id: string; name: string; normalized_name: string; brand: string | null }>>;

export async function saveCameraProduct(
  product: Omit<CameraProduct, "id">,
  fuzzyCategoryCache?: CameraFuzzyCategoryCache
): Promise<SaveProductResult<CameraProduct>> {
  // ブランド名を正規化
  if (product.brand) {
    const originalBrand = product.brand;
    const normalized = await normalizeBrand(product.brand, "products_camera", CAMERA_BRAND_TAGS);
    if (originalBrand !== normalized) {
      console.log(`[saveCameraProduct] Brand normalized: "${originalBrand}" → "${normalized}"`);
      product = { ...product, brand: normalized };
    }
  }

  // 正規化名を生成（色・サイズ表記を除去）
  const normalizedName = normalizeProductName(product.name);
  console.log(`[saveCameraProduct] Original: "${product.name}" → Normalized: "${normalizedName}"`);

  // 【最適化】正規化名と通常名を1回のクエリでチェック
  const { data: existingProducts } = await supabase
    .from("products_camera")
    .select("*")
    .or(`normalized_name.eq.${normalizedName},name.eq.${product.name}`)
    .limit(2);

  let existing = null;
  if (existingProducts && existingProducts.length > 0) {
    // 正規化名でのマッチを優先
    existing = existingProducts.find(p => p.normalized_name === normalizedName)
      || existingProducts[0];
    console.log(`[saveCameraProduct] Found existing: "${existing.name}" (matched by ${existing.normalized_name === normalizedName ? 'normalized_name' : 'name'})`);
  }

  // --- ファジーマッチフォールバック ---
  if (!existing && product.category) {
    let sameCategoryProducts = fuzzyCategoryCache?.get(product.category);

    if (!sameCategoryProducts) {
      const { data } = await supabase
        .from("products_camera")
        .select("id, name, normalized_name, brand")
        .eq("category", product.category)
        .limit(200);
      sameCategoryProducts = (data || []) as Array<{ id: string; name: string; normalized_name: string; brand: string | null }>;
      // キャッシュに保存（渡されている場合のみ）
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
        console.log(`[saveCameraProduct] Fuzzy match: "${product.name}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
        // 既存商品のフルデータを取得
        const { data: fullProduct } = await supabase
          .from("products_camera")
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
    if (product.subcategory !== undefined && product.subcategory !== existing.subcategory) {
      updateData.subcategory = product.subcategory;
    }
    if (product.tags && product.tags.length > 0) {
      updateData.tags = product.tags;
    }
    if (product.lens_tags && product.lens_tags.length > 0) {
      updateData.lens_tags = product.lens_tags;
    }
    if (product.body_tags && product.body_tags.length > 0) {
      updateData.body_tags = product.body_tags;
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
      console.log(`[saveCameraProduct] Updating existing "${existing.name}":`, Object.keys(updateData));
      const { data: updated, error } = await supabase
        .from("products_camera")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      if (!error && updated) existing = updated;
    }

    // 既存の商品に新しいソースからの言及を追加
    await saveCameraMention({
      product_id: existing.id,
      video_id: product.video_id,
      article_id: product.article_id,
      source_type: product.source_type,
      reason: product.reason,
      confidence: product.confidence,
    });
    return { product: existing as CameraProduct, isExisting: true };
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
    .from("products_camera")
    .insert([productWithNormalized])
    .select()
    .single();

  if (error) {
    console.error("Error saving camera product:", error);
    return { product: null, isExisting: false };
  }

  // 言及も保存
  await saveCameraMention({
    product_id: data.id,
    video_id: product.video_id,
    article_id: product.article_id,
    source_type: product.source_type,
    reason: product.reason,
    confidence: product.confidence,
  });

  console.log(`[saveCameraProduct] Created new product: "${data.name}" (normalized: "${normalizedName}", slug: "${slug}")`);
  return { product: data as CameraProduct, isExisting: false };
}

// 言及を保存
// 【最適化】UPSERTを使用してSELECT+INSERTの2回のクエリを1回に削減
export async function saveCameraMention(mention: Omit<CameraProductMention, "id">): Promise<CameraProductMention | null> {
  // UPSERTで重複時は何もしない（onConflictで一意制約を指定）
  // 注: product_mentions_cameraテーブルに (product_id, video_id) と (product_id, article_id) の
  //     複合一意制約がある前提。なければ従来のSELECT+INSERT方式にフォールバック
  try {
    const { data, error } = await supabase
      .from("product_mentions_camera")
      .upsert([mention], {
        onConflict: mention.video_id ? "product_id,video_id" : "product_id,article_id",
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (error) {
      // 一意制約がない場合は従来方式にフォールバック
      if (error.code === "42P10" || error.message?.includes("constraint")) {
        return await saveCameraMentionLegacy(mention);
      }
      console.error("Error saving camera mention:", error);
      return null;
    }

    return data as CameraProductMention;
  } catch {
    // エラー時は従来方式にフォールバック
    return await saveCameraMentionLegacy(mention);
  }
}

// 従来のSELECT+INSERT方式（フォールバック用）
async function saveCameraMentionLegacy(mention: Omit<CameraProductMention, "id">): Promise<CameraProductMention | null> {
  let query = supabase
    .from("product_mentions_camera")
    .select("*")
    .eq("product_id", mention.product_id);

  if (mention.source_type === "video" && mention.video_id) {
    query = query.eq("video_id", mention.video_id);
  } else if (mention.source_type === "article" && mention.article_id) {
    query = query.eq("article_id", mention.article_id);
  }

  const { data: existing } = await query.single();

  if (existing) {
    return existing as CameraProductMention;
  }

  const { data, error } = await supabase
    .from("product_mentions_camera")
    .insert([mention])
    .select()
    .single();

  if (error) {
    console.error("Error saving camera mention (legacy):", error);
    return null;
  }

  return data as CameraProductMention;
}

// 商品をAmazon/楽天情報で更新
// 【最適化】既にASINがある商品はスキップ（skipIfHasAsin: trueの場合）
export async function updateCameraProductWithAmazon(
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
      .from("products_camera")
      .select("asin")
      .eq("id", productId)
      .single();

    if (existing?.asin) {
      console.log(`[updateCameraProductWithAmazon] Skipping ${productId} - already has ASIN: ${existing.asin}`);
      return true;
    }
  }

  // 【重複検知】同じASINを持つ別の商品が既に存在するかチェック
  if (productInfo.asin) {
    const { data: duplicateProduct } = await supabase
      .from("products_camera")
      .select("id, name")
      .eq("asin", productInfo.asin)
      .neq("id", productId)
      .maybeSingle();

    if (duplicateProduct) {
      console.log(`[updateCameraProductWithAmazon] ASIN重複検出: "${productInfo.asin}" は既に "${duplicateProduct.name}" (${duplicateProduct.id}) に割り当て済み`);
      // 重複商品のmentionsを既存商品に移行して、新規商品を削除
      const { error: migrateError } = await supabase
        .from("product_mentions_camera")
        .update({ product_id: duplicateProduct.id })
        .eq("product_id", productId);

      if (!migrateError) {
        await supabase.from("products_camera").delete().eq("id", productId);
        console.log(`[updateCameraProductWithAmazon] Mentions migrated to ${duplicateProduct.id}, duplicate ${productId} deleted`);
      }
      return true;
    }
  }

  // Amazon情報からタグを抽出（種類タグ + 特徴タグ を統合）
  let extractedTags: string[] | undefined;

  const { data: product } = await supabase
    .from("products_camera")
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
    console.log(`[updateCameraProductWithAmazon] Extracted tags for ${productId}:`, extractedTags);
  }

  const { error } = await supabase
    .from("products_camera")
    .update(updateData)
    .eq("id", productId);

  if (error) {
    console.error("Error updating camera product with Amazon/Rakuten info:", error);
    return false;
  }

  return true;
}

// Amazon情報から補強されたCamera用タグを更新
export async function updateCameraProductEnrichedTags(
  productId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from("products_camera")
    .update(updates)
    .eq("id", productId);

  if (error) {
    console.error("[updateCameraProductEnrichedTags] Error:", error);
    return false;
  }

  console.log(`[updateCameraProductEnrichedTags] Updated ${productId}:`, updates);
  return true;
}

// インフルエンサーを保存または更新（YouTube）
export async function saveCameraInfluencer(influencer: Omit<CameraInfluencer, "id" | "created_at" | "updated_at">): Promise<CameraInfluencer | null> {
  console.log("[saveCameraInfluencer] Called with:", JSON.stringify({
    channel_id: influencer.channel_id,
    channel_title: influencer.channel_title,
    source_type: influencer.source_type,
    occupation: influencer.occupation,
    occupation_tags: influencer.occupation_tags,
  }, null, 2));

  if (influencer.source_type === "youtube" && influencer.channel_id) {
    // 既存チェック
    const { data: existing, error: existingError } = await supabase
      .from("influencers_camera")
      .select("*")
      .eq("channel_id", influencer.channel_id)
      .single();

    console.log("[saveCameraInfluencer] Existing check:", {
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

      console.log("[saveCameraInfluencer] Updating existing influencer with:", JSON.stringify(updateData, null, 2));

      const { data, error } = await supabase
        .from("influencers_camera")
        .update(updateData)
        .eq("channel_id", influencer.channel_id)
        .select()
        .single();

      if (error) {
        console.error("[saveCameraInfluencer] Error updating influencer:", error);
        return existing as CameraInfluencer;
      }
      console.log("[saveCameraInfluencer] Update SUCCESS:", { id: data.id, occupation_tags: data.occupation_tags });
      return data as CameraInfluencer;
    }

    // 新規作成
    const insertData = { ...influencer, video_count: 1 };
    console.log("[saveCameraInfluencer] Inserting new influencer:", JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from("influencers_camera")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("[saveCameraInfluencer] Error saving influencer:", error);
      return null;
    }

    console.log("[saveCameraInfluencer] Insert SUCCESS:", { id: data.id, occupation_tags: data.occupation_tags });
    return data as CameraInfluencer;
  }

  // 記事著者の場合
  if (influencer.source_type === "article" && influencer.author_id) {
    const { data: existing } = await supabase
      .from("influencers_camera")
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
        .from("influencers_camera")
        .update(updateData)
        .eq("author_id", influencer.author_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating camera article author:", error);
        return existing as CameraInfluencer;
      }
      return data as CameraInfluencer;
    }

    // 新規作成
    const { data, error } = await supabase
      .from("influencers_camera")
      .insert([{ ...influencer, article_count: 1 }])
      .select()
      .single();

    if (error) {
      console.error("Error saving camera article author:", error);
      return null;
    }

    return data as CameraInfluencer;
  }

  return null;
}

// ========== 再編集用の更新関数 ==========

// 動画/記事のメタデータ更新（summary, tags）
export async function updateCameraSourceMetadata(
  sourceType: "video" | "article",
  sourceId: string,
  data: { summary: string; tags: string[] }
): Promise<boolean> {
  if (sourceType === "video") {
    const { error } = await supabase
      .from("videos_camera")
      .update({ summary: data.summary, tags: data.tags })
      .eq("video_id", sourceId);
    if (error) {
      console.error("Error updating camera video metadata:", error);
      return false;
    }
    return true;
  } else {
    const { error } = await supabase
      .from("articles_camera")
      .update({ summary: data.summary, tags: data.tags })
      .eq("url", sourceId);
    if (error) {
      console.error("Error updating camera article metadata:", error);
      return false;
    }
    return true;
  }
}

// インフルエンサーの職業タグ更新
export async function updateCameraInfluencerOccupationTags(
  sourceType: "video" | "article",
  sourceId: string,
  occupationTags: string[]
): Promise<boolean> {
  if (sourceType === "video") {
    const { data: video } = await supabase
      .from("videos_camera")
      .select("channel_id")
      .eq("video_id", sourceId)
      .single();
    if (!video?.channel_id) return false;

    const { error } = await supabase
      .from("influencers_camera")
      .update({ occupation_tags: occupationTags })
      .eq("channel_id", video.channel_id);
    if (error) {
      console.error("Error updating camera influencer occupation_tags:", error);
      return false;
    }
    return true;
  } else {
    const { data: influencers } = await supabase
      .from("influencers_camera")
      .select("id, author_id")
      .not("author_id", "is", null);

    const match = influencers?.find(inf => {
      if (!inf.author_id) return false;
      const domain = inf.author_id.split(":")[0];
      return domain && sourceId.includes(domain);
    });
    if (!match) return false;

    const { error } = await supabase
      .from("influencers_camera")
      .update({ occupation_tags: occupationTags })
      .eq("id", match.id);
    if (error) {
      console.error("Error updating camera article author occupation_tags:", error);
      return false;
    }
    return true;
  }
}

// 商品のコメント文（reason）更新
export async function updateCameraMentionReason(
  productId: string,
  sourceType: "video" | "article",
  sourceId: string,
  reason: string
): Promise<boolean> {
  const column = sourceType === "video" ? "video_id" : "article_id";
  const { error } = await supabase
    .from("product_mentions_camera")
    .update({ reason })
    .eq("product_id", productId)
    .eq(column, sourceId);
  if (error) {
    console.error("Error updating camera mention reason:", error);
    return false;
  }
  return true;
}

// カメラソース（動画/記事）を削除
export async function deleteCameraSource(
  sourceType: "video" | "article",
  sourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mentionColumn = sourceType === "video" ? "video_id" : "article_id";

    // 1. 関連するproduct_mentions_cameraを取得（orphan商品チェック用）
    const { data: mentions } = await supabase
      .from("product_mentions_camera")
      .select("product_id")
      .eq(mentionColumn, sourceId);

    const affectedProductIds = [...new Set((mentions || []).map(m => m.product_id))];

    // 2. product_mentions_cameraを削除
    const { error: mentionError } = await supabase
      .from("product_mentions_camera")
      .delete()
      .eq(mentionColumn, sourceId);

    if (mentionError) {
      console.error("Error deleting product_mentions_camera:", mentionError);
      return { success: false, error: "product_mentions_cameraの削除に失敗" };
    }

    // 3. ソース本体を削除
    if (sourceType === "video") {
      const { error } = await supabase.from("videos_camera").delete().eq("video_id", sourceId);
      if (error) {
        console.error("Error deleting camera video:", error);
        return { success: false, error: "動画の削除に失敗" };
      }
    } else {
      const { error } = await supabase.from("articles_camera").delete().eq("url", sourceId);
      if (error) {
        console.error("Error deleting camera article:", error);
        return { success: false, error: "記事の削除に失敗" };
      }
    }

    // 4. orphanになった商品（mentionが0件）を削除
    let orphanDeleted = 0;
    for (const productId of affectedProductIds) {
      const { count } = await supabase
        .from("product_mentions_camera")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);

      if (count === 0) {
        await supabase.from("products_camera").delete().eq("id", productId);
        orphanDeleted++;
      }
    }

    console.log(`[deleteCameraSource] Deleted ${sourceType} ${sourceId}, ${mentions?.length || 0} mentions removed, ${orphanDeleted} orphan products cleaned up`);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteCameraSource:", error);
    return { success: false, error: "削除中にエラーが発生しました" };
  }
}

// 商品メタデータ更新（name, brand, category, tags）
export async function updateCameraProductMetadata(
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
    .from("products_camera")
    .update(updateData)
    .eq("id", productId);
  if (error) {
    console.error("Error updating camera product metadata:", error);
    return false;
  }
  return true;
}
