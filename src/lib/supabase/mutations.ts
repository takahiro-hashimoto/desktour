import { supabase } from "./client";
import type { Video, Article, Product, ProductMention, Influencer } from "./types";
import { normalizeProductName } from "../product-normalize";
import { generateProductSlug } from "../productSlug";
import { extractProductTags } from "../productTags";

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
export async function saveProduct(product: Omit<Product, "id">): Promise<Product | null> {
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

  if (existing) {
    // 既存の商品に新しいソースからの言及を追加
    await saveMention({
      product_id: existing.id,
      video_id: product.video_id,
      article_id: product.article_id,
      source_type: product.source_type,
      reason: product.reason,
      confidence: product.confidence,
    });
    return existing as Product;
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
    return null;
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
  return data as Product;
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
