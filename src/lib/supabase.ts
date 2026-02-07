import { createClient } from "@supabase/supabase-js";
import { normalizeProductName } from "./product-normalize";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 型定義
export interface Video {
  id?: string;
  video_id: string;
  title: string;
  channel_title: string;
  channel_id: string;
  subscriber_count: number;
  thumbnail_url: string;
  published_at: string;
  analyzed_at?: string;
  summary: string;
  tags?: string[];
}

export interface Article {
  id?: string;
  url: string;
  title: string;
  author: string | null;
  author_url: string | null;
  site_name: string | null;
  source_type: "note" | "blog" | "other";
  thumbnail_url: string | null;
  published_at: string | null;
  analyzed_at?: string;
  summary: string;
  tags?: string[];
}

export interface Product {
  id?: string;
  name: string;
  normalized_name?: string; // 色・サイズ表記を除去した正規化名（統合用）
  brand?: string;
  category: string;
  subcategory?: string; // サブカテゴリ（メカニカルキーボード、4Kモニター等）
  reason: string;
  confidence: "high" | "medium" | "low";
  video_id?: string;
  article_id?: string;
  source_type: "video" | "article";
  price_range?: string;
  // 商品取得元（amazon/rakuten）
  product_source?: "amazon" | "rakuten";
  // Amazon/楽天 基本情報（カラム名はamazon_だが楽天でも使用）
  asin?: string;                  // 楽天の場合はitemCode
  amazon_url?: string;            // 楽天の場合はaffiliateUrl
  amazon_image_url?: string;      // 楽天の場合はmediumImageUrls
  amazon_price?: number;          // 楽天の場合はitemPrice
  amazon_title?: string;          // 楽天の場合はitemName
  // Amazon詳細スペック（楽天では取得不可）
  amazon_manufacturer?: string;
  amazon_brand?: string;
  amazon_model_number?: string;
  amazon_color?: string;
  amazon_size?: string;
  amazon_weight?: string;
  amazon_release_date?: string;
  amazon_features?: string[];
  amazon_features_raw?: string[];  // 原文の特徴（要約前）
  amazon_technical_info?: Record<string, string>;
  // カテゴリ情報（Amazon）
  amazon_categories?: string[];  // カテゴリ階層
  amazon_product_group?: string; // 商品グループ
  // 楽天固有
  rakuten_shop_name?: string;
}

export interface ProductMention {
  id?: string;
  product_id: string;
  video_id?: string;
  article_id?: string;
  source_type: "video" | "article";
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface Influencer {
  id?: string;
  channel_id?: string;
  author_id?: string;
  channel_title?: string;
  author_name?: string;
  subscriber_count?: number;
  thumbnail_url?: string;
  video_count?: number;
  article_count?: number;
  source_type: "youtube" | "article";
  occupation?: string;
  occupation_tags?: string[];
  created_at?: string;
  updated_at?: string;
}

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

  // 新規商品を保存（正規化名も一緒に保存）
  const productWithNormalized = {
    ...product,
    normalized_name: normalizedName,
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

  console.log(`[saveProduct] Created new product: "${data.name}" (normalized: "${normalizedName}")`);
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
    // 推測されたサブカテゴリ（Amazon商品名から推測）
    subcategory?: string;
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

  const updateData: Record<string, unknown> = { ...productInfo };
  if (priceRange) {
    updateData.price_range = priceRange;
  }
  // subcategoryがundefinedの場合は既存の値を保持（更新しない）
  if (productInfo.subcategory === undefined) {
    delete updateData.subcategory;
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
      // occupation_tagsはマージする（既存タグと新しいタグを結合、重複除去）
      if (influencer.occupation_tags && influencer.occupation_tags.length > 0) {
        const existingTags = existing.occupation_tags || [];
        const mergedTags = [...new Set([...existingTags, ...influencer.occupation_tags])];
        updateData.occupation_tags = mergedTags;
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
      // occupation_tagsはマージする（既存タグと新しいタグを結合、重複除去）
      if (influencer.occupation_tags && influencer.occupation_tags.length > 0) {
        const existingTags = existing.occupation_tags || [];
        const mergedTags = [...new Set([...existingTags, ...influencer.occupation_tags])];
        updateData.occupation_tags = mergedTags;
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

// ランキング取得（言及回数でソート）
export async function getProductRanking(limit = 20, category?: string) {
  let query = supabase
    .from("products")
    .select(`
      *,
      mention_count:product_mentions!inner(count)
    `)
    .neq("product_mentions.confidence", "low")
    .order("mention_count", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ranking:", error);
    return [];
  }

  return data;
}

// インフルエンサー一覧取得
export async function getInfluencers(limit = 50) {
  const { data, error } = await supabase
    .from("influencers")
    .select("*")
    .order("subscriber_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching influencers:", error);
    return [];
  }

  return data;
}

// ========================================
// 一覧ページ・詳細ページ用の新規関数
// ========================================

import type {
  ProductWithStats,
  ProductComment,
  SearchParams,
  ProductDetail,
  OccupationStat,
  CoUsedProduct,
  DeskSetupStat,
  SiteStats,
  SourceDetail,
  SourceProduct,
} from "@/types";
import { OCCUPATION_TAG_GROUPS, getCompatibleCategories } from "@/lib/constants";

// 商品検索（一覧ページ用）
export async function searchProducts(params: SearchParams): Promise<{
  products: ProductWithStats[];
  total: number;
}> {
  const {
    occupationTag,
    category,
    subcategory,
    setupTag,
    brand,
    priceRange,
    sortBy = "mention_count",
    page = 1,
    limit = 20,
  } = params;

  const offset = (page - 1) * limit;

  // setupTagまたはoccupationTagでフィルタリングが必要な場合、
  // 先に対象のvideo_id/article_idを取得する
  let validVideoIds: Set<string> | null = null;
  let validArticleIds: Set<string> | null = null;

  // setupTagフィルタリング用のID取得
  if (setupTag) {
    const { data: taggedVideos } = await supabase
      .from("videos")
      .select("video_id")
      .contains("tags", [setupTag]);

    const { data: taggedArticles } = await supabase
      .from("articles")
      .select("url")
      .contains("tags", [setupTag]);

    validVideoIds = new Set(taggedVideos?.map(v => v.video_id) || []);
    validArticleIds = new Set(taggedArticles?.map(a => a.url) || []);
  }

  // occupationTagフィルタリング用のID取得
  if (occupationTag) {
    // グループに含まれる全タグを取得（例: "エンジニア" → ["エンジニア", "Webエンジニア", ...]）
    const targetTags = OCCUPATION_TAG_GROUPS[occupationTag] || [occupationTag];
    console.log(`[searchProducts] occupationTag: ${occupationTag}, targetTags:`, targetTags);

    // いずれかのタグを持つインフルエンサーのchannel_idを取得（overlapsで部分一致）
    const { data: taggedInfluencers, error: infError } = await supabase
      .from("influencers")
      .select("channel_id, occupation_tags")
      .overlaps("occupation_tags", targetTags);

    if (infError) {
      console.error("Error fetching influencers by occupation_tags:", infError);
    }
    console.log(`[searchProducts] found influencers:`, taggedInfluencers?.length || 0, taggedInfluencers?.map(i => ({ channel_id: i.channel_id, tags: i.occupation_tags })));

    const channelIds = taggedInfluencers?.map(i => i.channel_id).filter(Boolean) || [];

    if (channelIds.length > 0) {
      // そのchannel_idを持つ動画のvideo_idを取得
      const { data: taggedVideos, error: vidError } = await supabase
        .from("videos")
        .select("video_id, channel_id")
        .in("channel_id", channelIds);

      if (vidError) {
        console.error("Error fetching videos by channel_id:", vidError);
      }
      console.log(`[searchProducts] found videos for occupation:`, taggedVideos?.length || 0);

      validVideoIds = new Set(taggedVideos?.map(v => v.video_id).filter(Boolean) || []);
    } else {
      // influencersに該当するタグがない場合は、空のSetを設定して結果を0件にする
      console.log(`[searchProducts] No influencers found with occupation_tags - returning empty results`);
      validVideoIds = new Set(); // 空のSetにすると全商品がフィルタアウトされる
    }
    // occupationTagの場合、article_idはフィルタしない（influencerは動画のみ）
  }

  // 基本クエリ: 商品と言及数を取得
  // タグフィルタがある場合はページネーションを外して全件取得（JS側でフィルタ後にページネーション）
  const needsJsFilter = setupTag || occupationTag;

  let query = supabase
    .from("products")
    .select(`
      id,
      name,
      brand,
      category,
      subcategory,
      price_range,
      amazon_url,
      amazon_image_url,
      amazon_price,
      amazon_title,
      product_mentions!inner (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `, { count: "exact" })
    .neq("product_mentions.confidence", "low");

  // カテゴリフィルタ
  if (category) {
    query = query.eq("category", category);
  }

  // サブカテゴリフィルタ
  if (subcategory) {
    query = query.eq("subcategory", subcategory);
  }

  // ブランドフィルタ（大文字小文字を無視してマッチ）
  if (brand) {
    query = query.ilike("brand", brand);
  }

  // 価格帯フィルタ
  if (priceRange) {
    query = query.eq("price_range", priceRange);
  }

  // ソート（価格ソートの場合のみDBで）
  if (sortBy === "price_asc") {
    query = query.order("amazon_price", { ascending: true, nullsFirst: false });
  } else if (sortBy === "price_desc") {
    query = query.order("amazon_price", { ascending: false, nullsFirst: false });
  }

  // タグフィルタがない場合のみDBでページネーション
  if (!needsJsFilter) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error searching products:", error);
    return { products: [], total: 0 };
  }

  // データを整形
  let products: ProductWithStats[] = (data || []).map((product) => {
    let mentions = product.product_mentions || [];

    // タグフィルタがある場合、mentionsをフィルタする
    if (validVideoIds !== null || validArticleIds !== null) {
      mentions = mentions.filter((m: { video_id?: string; article_id?: string }) => {
        // video_idがvalidVideoIdsに含まれる
        if (validVideoIds && m.video_id && validVideoIds.has(m.video_id)) {
          return true;
        }
        // article_idがvalidArticleIdsに含まれる
        if (validArticleIds && m.article_id && validArticleIds.has(m.article_id)) {
          return true;
        }
        return false;
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments: ProductComment[] = mentions.slice(0, 3).map((m: any) => ({
      reason: m.reason || "",
      source_type: m.source_type || "video",
      source_id: m.video_id || m.article_id || undefined,
      source_title: "",
      occupation_tags: [],
    }));

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      subcategory: product.subcategory,
      price_range: product.price_range,
      amazon_url: product.amazon_url,
      amazon_image_url: product.amazon_image_url,
      amazon_price: product.amazon_price,
      amazon_title: product.amazon_title,
      mention_count: mentions.length,
      comments,
    };
  });

  // タグフィルタがある場合、mention_countが0の商品を除外
  if (needsJsFilter) {
    products = products.filter(p => p.mention_count > 0);
  }

  // mention_countでソート（Supabaseでは集計カラムのソートが難しいため）
  if (sortBy === "mention_count") {
    products.sort((a, b) => b.mention_count - a.mention_count);
  }

  // タグフィルタがある場合、JS側でページネーション
  const total = needsJsFilter ? products.length : (count || 0);
  if (needsJsFilter) {
    products = products.slice(offset, offset + limit);
  }

  return { products, total };
}

// カテゴリ別の商品数を取得
export async function getProductCountByCategory(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("category");

  if (error) {
    console.error("Error fetching category counts:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const product of data || []) {
    counts[product.category] = (counts[product.category] || 0) + 1;
  }

  return counts;
}

// 商品詳細を取得
export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  // 商品基本情報（confidence: low を除外）
  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *,
      product_mentions (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `)
    .eq("id", productId)
    .neq("product_mentions.confidence", "low")
    .single();

  if (error || !product) {
    console.error("Error fetching product detail:", error);
    return null;
  }

  const mentions = product.product_mentions || [];

  // コメント（全件）にサムネイル情報を含める
  const videoIds = mentions.filter((m: ProductMention) => m.video_id).map((m: ProductMention) => m.video_id);
  const articleIds = mentions.filter((m: ProductMention) => m.article_id).map((m: ProductMention) => m.article_id);

  // 動画情報を一括取得
  const { data: commentVideos } = videoIds.length > 0
    ? await supabase.from("videos")
        .select("video_id, title, thumbnail_url, channel_title")
        .in("video_id", videoIds)
    : { data: [] };

  // 記事情報を一括取得
  const { data: commentArticles } = articleIds.length > 0
    ? await supabase.from("articles")
        .select("url, title, thumbnail_url, author")
        .in("url", articleIds)
    : { data: [] };

  // Map作成
  const videoMap = new Map((commentVideos || []).map((v: { video_id: string; title: string; thumbnail_url: string | null; channel_title: string }) => [v.video_id, v]));
  const articleMap = new Map((commentArticles || []).map((a: { url: string; title: string; thumbnail_url: string | null; author: string | null }) => [a.url, a]));

  // コメント生成
  const allComments: ProductComment[] = mentions.map((m: ProductMention) => {
    if (m.video_id) {
      const video = videoMap.get(m.video_id);
      return {
        reason: m.reason,
        source_type: "video" as const,
        source_id: m.video_id,
        source_title: video?.title || "",
        thumbnail_url: video?.thumbnail_url || undefined,
        channel_title: video?.channel_title,
        occupation_tags: [],
      };
    } else if (m.article_id) {
      const article = articleMap.get(m.article_id);
      return {
        reason: m.reason,
        source_type: "article" as const,
        source_id: m.article_id,
        source_title: article?.title || "",
        thumbnail_url: article?.thumbnail_url || undefined,
        author: article?.author || undefined,
        occupation_tags: [],
      };
    } else {
      // video_idもarticle_idもない場合
      return {
        reason: m.reason,
        source_type: m.source_type,
        source_id: undefined,
        source_title: "",
        occupation_tags: [],
      };
    }
  });

  // 共起商品を取得（同じカテゴリを除外、相性の良いカテゴリを優先）
  const coUsedProducts = await getCoOccurrenceProducts(productId, 10, product.category);

  // カテゴリ内順位を計算
  const { categoryRank, totalInCategory } = await getCategoryRank(productId, product.category);

  // 職業別統計を取得
  const occupationBreakdown = await getOccupationBreakdownForProduct(mentions);

  // デスクセットアップ統計を取得
  const deskSetupStats = await getDeskSetupStatsForProduct(mentions);

  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price_range: product.price_range,
    amazon_url: product.amazon_url,
    amazon_image_url: product.amazon_image_url,
    amazon_price: product.amazon_price,
    amazon_title: product.amazon_title,
    amazon_manufacturer: product.amazon_manufacturer,
    amazon_brand: product.amazon_brand,
    amazon_model_number: product.amazon_model_number,
    amazon_color: product.amazon_color,
    amazon_size: product.amazon_size,
    amazon_weight: product.amazon_weight,
    amazon_release_date: product.amazon_release_date,
    amazon_features: product.amazon_features,
    amazon_technical_info: product.amazon_technical_info,
    amazon_categories: product.amazon_categories,
    amazon_product_group: product.amazon_product_group,
    product_source: product.product_source,
    rakuten_shop_name: product.rakuten_shop_name,
    asin: product.asin,
    mention_count: mentions.length,
    category_rank: categoryRank,
    total_in_category: totalInCategory,
    occupation_breakdown: occupationBreakdown,
    co_used_products: coUsedProducts,
    all_comments: allComments,
    desk_setup_stats: deskSetupStats,
    updated_at: product.updated_at,
  };
}

// カテゴリ内順位を取得
async function getCategoryRank(productId: string, category: string): Promise<{ categoryRank: number; totalInCategory: number }> {
  // 同じカテゴリの全商品を言及数でソートして取得
  const { data: products } = await supabase
    .from("products")
    .select(`
      id,
      product_mentions!inner (count)
    `)
    .eq("category", category)
    .neq("product_mentions.confidence", "low");

  if (!products || products.length === 0) {
    return { categoryRank: 0, totalInCategory: 0 };
  }

  // 言及数でソート
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = products.map((p: any) => ({
    id: p.id,
    count: Array.isArray(p.product_mentions) ? p.product_mentions.length : (p.product_mentions?.[0]?.count || 0),
  })).sort((a, b) => b.count - a.count);

  const rank = sorted.findIndex((p) => p.id === productId) + 1;

  return {
    categoryRank: rank,
    totalInCategory: products.length,
  };
}

// 商品の言及から職業別統計を取得
async function getOccupationBreakdownForProduct(mentions: ProductMention[]): Promise<OccupationStat[]> {
  const videoIds = mentions.filter((m) => m.video_id).map((m) => m.video_id);
  const articleIds = mentions.filter((m) => m.article_id).map((m) => m.article_id);

  if (videoIds.length === 0 && articleIds.length === 0) {
    return [];
  }

  // 動画からチャンネルIDを取得
  const { data: videos } = videoIds.length > 0
    ? await supabase.from("videos").select("video_id, channel_id").in("video_id", videoIds)
    : { data: [] };

  // チャンネルIDからインフルエンサーの職業タグを取得
  const channelIds = (videos || []).map((v) => v.channel_id).filter(Boolean);

  const { data: influencers } = channelIds.length > 0
    ? await supabase.from("influencers").select("channel_id, occupation_tags").in("channel_id", channelIds)
    : { data: [] };

  // 職業タグをカウント
  const tagCounts = new Map<string, number>();

  for (const inf of influencers || []) {
    if (inf.occupation_tags) {
      for (const tag of inf.occupation_tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // ソートして返す
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ occupation_tag: tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// 商品の言及からデスクセットアップ統計を取得
async function getDeskSetupStatsForProduct(mentions: ProductMention[]): Promise<DeskSetupStat[]> {
  const videoIds = mentions.filter((m) => m.video_id).map((m) => m.video_id);
  const articleIds = mentions.filter((m) => m.article_id).map((m) => m.article_id);

  if (videoIds.length === 0 && articleIds.length === 0) {
    return [];
  }

  // 動画からタグを取得
  const { data: videos } = videoIds.length > 0
    ? await supabase.from("videos").select("video_id, tags").in("video_id", videoIds)
    : { data: [] };

  // 記事からタグを取得
  const { data: articles } = articleIds.length > 0
    ? await supabase.from("articles").select("url, tags").in("url", articleIds)
    : { data: [] };

  // タグをカウント
  const tagCounts = new Map<string, number>();

  for (const video of videos || []) {
    if (video.tags) {
      for (const tag of video.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  for (const article of articles || []) {
    if (article.tags) {
      for (const tag of article.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // ソートして返す
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ setup_tag: tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// 共起商品を取得（同じ動画/記事で紹介された他の商品）
// 相性の良いカテゴリを優先して表示
export async function getCoOccurrenceProducts(
  productId: string,
  limit = 10,
  currentProductCategory?: string
): Promise<CoUsedProduct[]> {
  // この商品が言及されている動画/記事のIDを取得
  const { data: mentions, error: mentionError } = await supabase
    .from("product_mentions")
    .select("video_id, article_id")
    .eq("product_id", productId)
    .neq("confidence", "low");

  if (mentionError || !mentions || mentions.length === 0) {
    return [];
  }

  const videoIds = mentions
    .filter((m) => m.video_id)
    .map((m) => m.video_id);
  const articleIds = mentions
    .filter((m) => m.article_id)
    .map((m) => m.article_id);

  // 同じソースで言及されている他の商品を取得
  let coMentions: Array<{ product_id: string }> = [];

  if (videoIds.length > 0) {
    const { data } = await supabase
      .from("product_mentions")
      .select("product_id")
      .in("video_id", videoIds)
      .neq("product_id", productId)
      .neq("confidence", "low");
    if (data) coMentions = [...coMentions, ...data];
  }

  if (articleIds.length > 0) {
    const { data } = await supabase
      .from("product_mentions")
      .select("product_id")
      .in("article_id", articleIds)
      .neq("product_id", productId)
      .neq("confidence", "low");
    if (data) coMentions = [...coMentions, ...data];
  }

  // 商品IDごとにカウント
  const coCountMap: Record<string, number> = {};
  for (const m of coMentions) {
    coCountMap[m.product_id] = (coCountMap[m.product_id] || 0) + 1;
  }

  // 多めに取得（後でフィルタリングするため）
  const sortedProductIds = Object.entries(coCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 3) // 3倍取得
    .map(([id]) => id);

  if (sortedProductIds.length === 0) {
    return [];
  }

  // 商品情報を取得
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, brand, category, amazon_image_url")
    .in("id", sortedProductIds);

  if (productError || !products) {
    return [];
  }

  // 相性の良いカテゴリを取得
  const compatibleCategories = currentProductCategory
    ? getCompatibleCategories(currentProductCategory)
    : [];

  // 結果を整形し、相性の良いカテゴリを優先してソート
  const result = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      amazon_image_url: p.amazon_image_url,
      co_occurrence_count: coCountMap[p.id] || 0,
    }))
    // 同じカテゴリを除外
    .filter((p) => p.category !== currentProductCategory)
    // 相性の良いカテゴリを優先、その中で共起回数でソート
    .sort((a, b) => {
      const aIsCompatible = compatibleCategories.includes(a.category);
      const bIsCompatible = compatibleCategories.includes(b.category);

      // 相性の良いカテゴリを優先
      if (aIsCompatible && !bIsCompatible) return -1;
      if (!aIsCompatible && bIsCompatible) return 1;

      // 同じ相性レベルなら共起回数でソート
      return b.co_occurrence_count - a.co_occurrence_count;
    })
    .slice(0, limit);

  return result;
}

// サイト統計を取得（トップページ用）
export async function getSiteStats(): Promise<SiteStats> {
  const [
    { count: productCount },
    { count: mentionCount },
    { count: videoCount },
    { count: articleCount },
    { count: influencerCount },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("product_mentions").select("*", { count: "exact", head: true }),
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("influencers").select("*", { count: "exact", head: true }),
  ]);

  return {
    total_products: productCount || 0,
    total_mentions: mentionCount || 0,
    total_videos: videoCount || 0,
    total_articles: articleCount || 0,
    total_influencers: influencerCount || 0,
  };
}

// ヒーローセクション用の商品画像を取得（言及数順）
export async function getTopProductImages(limit = 24): Promise<string[]> {
  // product_mentionsから商品ごとの言及数を集計（confidence lowを除外）
  const { data: mentions, error: mentionError } = await supabase
    .from("product_mentions")
    .select("product_id")
    .neq("confidence", "low");

  if (mentionError) {
    console.error("Error fetching product mentions:", mentionError);
    return [];
  }

  // 商品IDごとに言及数をカウント
  const mentionCounts = new Map<string, number>();
  for (const m of mentions || []) {
    mentionCounts.set(m.product_id, (mentionCounts.get(m.product_id) || 0) + 1);
  }

  // 言及数でソートした商品IDリスト
  const sortedProductIds = [...mentionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2) // 画像がない商品もあるので多めに取得
    .map(([id]) => id);

  if (sortedProductIds.length === 0) {
    return [];
  }

  // 商品情報を取得
  const { data: products, error } = await supabase
    .from("products")
    .select("id, amazon_image_url")
    .in("id", sortedProductIds)
    .not("amazon_image_url", "is", null)
    .not("amazon_image_url", "eq", "");

  if (error) {
    console.error("Error fetching product images:", error);
    return [];
  }

  // 元の順序を維持しながら画像URLを返す
  const productMap = new Map((products || []).map((p) => [p.id, p.amazon_image_url]));
  return sortedProductIds
    .map((id) => productMap.get(id))
    .filter((url): url is string => !!url)
    .slice(0, limit);
}

// 各カテゴリの人気商品（画像付き）を取得
export async function getTopProductByCategory(): Promise<
  Record<string, { name: string; imageUrl: string; mentionCount: number }>
> {
  // product_mentionsから商品ごとの言及数を集計（confidence lowを除外）
  const { data: mentions, error: mentionError } = await supabase
    .from("product_mentions")
    .select("product_id")
    .neq("confidence", "low");

  if (mentionError) {
    console.error("Error fetching product mentions:", mentionError);
    return {};
  }

  // 商品IDごとに言及数をカウント
  const mentionCounts = new Map<string, number>();
  for (const m of mentions || []) {
    mentionCounts.set(m.product_id, (mentionCounts.get(m.product_id) || 0) + 1);
  }

  // 商品情報を取得
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, amazon_image_url")
    .not("amazon_image_url", "is", null)
    .not("amazon_image_url", "eq", "");

  if (error) {
    console.error("Error fetching top products by category:", error);
    return {};
  }

  // 各カテゴリで最も言及数が多い商品を1つだけ取得
  const result: Record<string, { name: string; imageUrl: string; mentionCount: number }> = {};

  // 言及数でソート
  const sortedProducts = (data || []).sort((a, b) => {
    const countA = mentionCounts.get(a.id) || 0;
    const countB = mentionCounts.get(b.id) || 0;
    return countB - countA;
  });

  for (const product of sortedProducts) {
    if (product.category && !result[product.category]) {
      result[product.category] = {
        name: product.name,
        imageUrl: product.amazon_image_url,
        mentionCount: mentionCounts.get(product.id) || 0,
      };
    }
  }

  return result;
}

// 職業タグ別の商品数を取得（DBに存在するタグのみ）
export async function getOccupationTagCounts(): Promise<Record<string, number>> {
  // influencersテーブルからoccupation_tagsを取得
  const { data: influencers, error } = await supabase
    .from("influencers")
    .select("id, occupation_tags");

  if (error) {
    console.error("Error fetching occupation tags:", error);
    return {};
  }

  // インフルエンサーIDとそのタグのマップを作成
  const influencerTagMap = new Map<string, string[]>();
  for (const inf of influencers || []) {
    if (inf.occupation_tags && inf.occupation_tags.length > 0) {
      influencerTagMap.set(inf.id, inf.occupation_tags);
    }
  }

  if (influencerTagMap.size === 0) {
    return {};
  }

  // videos/articlesから関連する商品数をカウント
  // 各タグが付いているインフルエンサーの動画/記事に紐づく商品をカウント
  // product_mentions.video_id はYouTube動画ID、article_id は記事URLを格納
  const { data: videos } = await supabase
    .from("videos")
    .select("video_id, channel_id");

  const { data: articles } = await supabase
    .from("articles")
    .select("url, author_url");

  // channel_id/author_urlからインフルエンサーを特定
  const { data: allInfluencers } = await supabase
    .from("influencers")
    .select("id, channel_id, author_id, occupation_tags");

  // チャンネルID/著者IDからインフルエンサーへのマップ
  const channelToInfluencer = new Map<string, Influencer>();
  const authorToInfluencer = new Map<string, Influencer>();
  for (const inf of allInfluencers || []) {
    if (inf.channel_id) channelToInfluencer.set(inf.channel_id, inf as Influencer);
    if (inf.author_id) authorToInfluencer.set(inf.author_id, inf as Influencer);
  }

  // YouTube動画ID/記事URLから職業タグへのマップ
  const videoToTags = new Map<string, string[]>();
  const articleToTags = new Map<string, string[]>();

  for (const video of videos || []) {
    const inf = channelToInfluencer.get(video.channel_id);
    if (inf?.occupation_tags && video.video_id) {
      videoToTags.set(video.video_id, inf.occupation_tags);
    }
  }

  for (const article of articles || []) {
    // author_urlからauthor_idを抽出（簡易版）
    const inf = Array.from(authorToInfluencer.values()).find(
      (i) => i.author_id && article.author_url?.includes(i.author_id)
    );
    if (inf?.occupation_tags && article.url) {
      articleToTags.set(article.url, inf.occupation_tags);
    }
  }

  // 商品言及から各タグの商品数をカウント（confidence lowを除外）
  const { data: mentions } = await supabase
    .from("product_mentions")
    .select("product_id, video_id, article_id")
    .neq("confidence", "low");

  const tagProductSet = new Map<string, Set<string>>();

  for (const mention of mentions || []) {
    let tags: string[] = [];
    if (mention.video_id && videoToTags.has(mention.video_id)) {
      tags = videoToTags.get(mention.video_id) || [];
    } else if (mention.article_id && articleToTags.has(mention.article_id)) {
      tags = articleToTags.get(mention.article_id) || [];
    }

    for (const tag of tags) {
      if (!tagProductSet.has(tag)) {
        tagProductSet.set(tag, new Set());
      }
      tagProductSet.get(tag)!.add(mention.product_id);
    }
  }

  const counts: Record<string, number> = {};
  for (const [tag, products] of tagProductSet) {
    counts[tag] = products.size;
  }

  return counts;
}

// セットアップタグ別の商品数を取得（DBに存在するタグのみ）
export async function getSetupTagCounts(): Promise<Record<string, number>> {
  // videosとarticlesからtagsを取得
  // product_mentions.video_id はYouTube動画ID、article_id は記事URLを格納
  const [{ data: videos }, { data: articles }] = await Promise.all([
    supabase.from("videos").select("video_id, tags"),
    supabase.from("articles").select("url, tags"),
  ]);

  // YouTube動画ID/記事URLからタグへのマップ
  const videoToTags = new Map<string, string[]>();
  const articleToTags = new Map<string, string[]>();

  for (const video of videos || []) {
    if (video.tags && video.tags.length > 0 && video.video_id) {
      videoToTags.set(video.video_id, video.tags);
    }
  }

  for (const article of articles || []) {
    if (article.tags && article.tags.length > 0 && article.url) {
      articleToTags.set(article.url, article.tags);
    }
  }

  // 商品言及から各タグの商品数をカウント（confidence lowを除外）
  const { data: mentions } = await supabase
    .from("product_mentions")
    .select("product_id, video_id, article_id")
    .neq("confidence", "low");

  const tagProductSet = new Map<string, Set<string>>();

  for (const mention of mentions || []) {
    let tags: string[] = [];
    if (mention.video_id && videoToTags.has(mention.video_id)) {
      tags = videoToTags.get(mention.video_id) || [];
    } else if (mention.article_id && articleToTags.has(mention.article_id)) {
      tags = articleToTags.get(mention.article_id) || [];
    }

    for (const tag of tags) {
      if (!tagProductSet.has(tag)) {
        tagProductSet.set(tag, new Set());
      }
      tagProductSet.get(tag)!.add(mention.product_id);
    }
  }

  const counts: Record<string, number> = {};
  for (const [tag, products] of tagProductSet) {
    counts[tag] = products.size;
  }

  return counts;
}

// ソース詳細を取得（モーダル用）
// sourceIdはYouTubeの動画IDまたは記事のURL
export async function getSourceDetail(
  sourceType: "video" | "article",
  sourceId: string
): Promise<SourceDetail | null> {
  if (sourceType === "video") {
    // 動画情報を取得（video_idはYouTubeの動画ID）
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("video_id", sourceId)
      .single();

    if (videoError || !video) {
      console.error("Error fetching video:", videoError);
      return null;
    }

    // この動画で紹介されている商品を取得（confidence lowを除外）
    // product_mentions.video_idにはYouTube動画ID(video.video_id)が入っている
    const { data: mentions } = await supabase
      .from("product_mentions")
      .select(`
        reason,
        product_id,
        products (
          id,
          name,
          brand,
          category,
          amazon_image_url,
          amazon_url,
          amazon_model_number
        )
      `)
      .eq("video_id", video.video_id)
      .neq("confidence", "low");

    // 各商品のmention_countを取得
    const productIds = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.products)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.product_id);

    const { data: mentionCounts } = productIds.length > 0
      ? await supabase
          .from("product_mentions")
          .select("product_id")
          .in("product_id", productIds)
          .neq("confidence", "low")
      : { data: [] };

    // product_idごとのカウントを集計
    const countMap = new Map<string, number>();
    for (const mc of mentionCounts || []) {
      countMap.set(mc.product_id, (countMap.get(mc.product_id) || 0) + 1);
    }

    const products: SourceProduct[] = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.products)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        id: m.products.id,
        name: m.products.name,
        brand: m.products.brand,
        category: m.products.category,
        amazon_image_url: m.products.amazon_image_url,
        amazon_url: m.products.amazon_url,
        amazon_model_number: m.products.amazon_model_number,
        reason: m.reason,
        mention_count: countMap.get(m.product_id) || 1,
      }));

    // influencers テーブルから occupation_tags を取得
    let occupationTags: string[] = [];
    let debugInfo: Record<string, unknown> = {};

    if (video.channel_id) {
      // まずchannel_idで検索
      const { data: influencer, error: infError } = await supabase
        .from("influencers")
        .select("*")
        .eq("channel_id", video.channel_id)
        .single();

      debugInfo = {
        channel_id: video.channel_id,
        influencer_found: !!influencer,
        influencer_occupation_tags: influencer?.occupation_tags || null,
        error_code: infError?.code || null,
        error_message: infError?.message || null,
      };

      console.log(`[getSourceDetail] DEBUG:`, JSON.stringify(debugInfo, null, 2));

      if (influencer?.occupation_tags && influencer.occupation_tags.length > 0) {
        occupationTags = influencer.occupation_tags;
      }
    } else {
      debugInfo = { channel_id: null, message: "video has no channel_id" };
      console.log(`[getSourceDetail] DEBUG:`, JSON.stringify(debugInfo, null, 2));
    }

    return {
      id: video.id,
      type: "video",
      title: video.title,
      thumbnail_url: video.thumbnail_url,
      channel_title: video.channel_title,
      published_at: video.published_at,
      summary: video.summary,
      video_id: video.video_id,
      products,
      tags: video.tags || [],
      occupation_tags: occupationTags,
    };
  } else {
    // 記事情報を取得（article_idは記事のURL）
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("url", sourceId)
      .single();

    if (articleError || !article) {
      console.error("Error fetching article:", articleError);
      return null;
    }

    // この記事で紹介されている商品を取得（confidence lowを除外）
    // product_mentions.article_idには記事のURL(article.url)が入っている
    const { data: mentions } = await supabase
      .from("product_mentions")
      .select(`
        reason,
        product_id,
        products (
          id,
          name,
          brand,
          category,
          amazon_image_url,
          amazon_url,
          amazon_model_number
        )
      `)
      .eq("article_id", article.url)
      .neq("confidence", "low");

    // 各商品のmention_countを取得
    const productIds = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.products)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.product_id);

    const { data: mentionCounts } = productIds.length > 0
      ? await supabase
          .from("product_mentions")
          .select("product_id")
          .in("product_id", productIds)
          .neq("confidence", "low")
      : { data: [] };

    // product_idごとのカウントを集計
    const countMap = new Map<string, number>();
    for (const mc of mentionCounts || []) {
      countMap.set(mc.product_id, (countMap.get(mc.product_id) || 0) + 1);
    }

    const products: SourceProduct[] = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.products)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        id: m.products.id,
        name: m.products.name,
        brand: m.products.brand,
        category: m.products.category,
        amazon_image_url: m.products.amazon_image_url,
        amazon_url: m.products.amazon_url,
        amazon_model_number: m.products.amazon_model_number,
        reason: m.reason,
        mention_count: countMap.get(m.product_id) || 1,
      }));

    // 記事著者の職業タグを取得
    // author_idは "ドメイン:著者名" 形式なので、記事URLのドメイン部分でマッチング
    let occupationTags: string[] = [];
    const { data: influencers } = await supabase
      .from("influencers")
      .select("author_id, occupation_tags")
      .not("author_id", "is", null);

    const matchedInfluencer = influencers?.find((inf) => {
      if (!inf.author_id) return false;
      // author_idからドメイン部分を抽出（例: "ritalog0317.com:リタ" → "ritalog0317.com"）
      const domain = inf.author_id.split(":")[0];
      return article.url?.includes(domain);
    });
    if (matchedInfluencer?.occupation_tags) {
      occupationTags = matchedInfluencer.occupation_tags;
    }

    return {
      id: article.id,
      type: "article",
      title: article.title,
      thumbnail_url: article.thumbnail_url,
      author: article.author,
      published_at: article.published_at,
      summary: article.summary,
      url: article.url,
      products,
      tags: article.tags || [],
      occupation_tags: occupationTags,
    };
  }
}

// 動画一覧取得
// 拡張Video型（商品数含む）
export type VideoWithProductCount = Video & { product_count?: number };

export async function getVideos(params: {
  tags?: string[];
  year?: number;
  sortBy?: "published_at" | "subscriber_count";
  page?: number;
  limit?: number;
}): Promise<{ videos: VideoWithProductCount[]; total: number }> {
  const { tags, year, sortBy = "published_at", page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("videos")
    .select("*", { count: "exact" });

  // タグフィルター（配列に含まれるかチェック）
  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  // 年フィルター
  if (year) {
    const startOfYear = `${year}-01-01T00:00:00.000Z`;
    const endOfYear = `${year}-12-31T23:59:59.999Z`;
    query = query.gte("published_at", startOfYear).lte("published_at", endOfYear);
  }

  // ソート
  if (sortBy === "subscriber_count") {
    query = query.order("subscriber_count", { ascending: false });
  } else {
    query = query.order("published_at", { ascending: false });
  }

  // ページネーション
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching videos:", error);
    return { videos: [], total: 0 };
  }

  const videos = (data || []) as Video[];

  // 各動画の商品数を取得（confidence lowを除外）
  if (videos.length > 0) {
    const videoIds = videos.map((v) => v.video_id);
    const { data: mentions } = await supabase
      .from("product_mentions")
      .select("video_id")
      .in("video_id", videoIds)
      .neq("confidence", "low");

    // video_idごとにカウント
    const countMap: Record<string, number> = {};
    (mentions || []).forEach((m) => {
      if (m.video_id) {
        countMap[m.video_id] = (countMap[m.video_id] || 0) + 1;
      }
    });

    // 動画に商品数を付与
    const videosWithCount: VideoWithProductCount[] = videos.map((v) => ({
      ...v,
      product_count: countMap[v.video_id] || 0,
    }));

    return { videos: videosWithCount, total: count || 0 };
  }

  return { videos: videos as VideoWithProductCount[], total: count || 0 };
}

// 拡張Article型（商品数含む）
export type ArticleWithProductCount = Article & { product_count?: number };

// 記事一覧取得
export async function getArticles(params: {
  tags?: string[];
  year?: number;
  sourceType?: "note" | "blog" | "other";
  sortBy?: "published_at";
  page?: number;
  limit?: number;
}): Promise<{ articles: ArticleWithProductCount[]; total: number }> {
  const { tags, year, sourceType, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" });

  // タグフィルター
  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  // 年フィルター
  if (year) {
    const startOfYear = `${year}-01-01T00:00:00.000Z`;
    const endOfYear = `${year}-12-31T23:59:59.999Z`;
    query = query.gte("published_at", startOfYear).lte("published_at", endOfYear);
  }

  // ソースタイプフィルター
  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }

  // ソート
  query = query.order("published_at", { ascending: false, nullsFirst: false });

  // ページネーション
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching articles:", error);
    return { articles: [], total: 0 };
  }

  const articles = (data || []) as Article[];

  // 各記事の商品数を取得（confidence lowを除外）
  // product_mentions.article_idには記事のURLが入っている
  if (articles.length > 0) {
    const articleUrls = articles.map((a) => a.url).filter(Boolean);
    if (articleUrls.length > 0) {
      const { data: mentions } = await supabase
        .from("product_mentions")
        .select("article_id")
        .in("article_id", articleUrls)
        .neq("confidence", "low");

      // article_id（URL）ごとにカウント
      const countMap: Record<string, number> = {};
      (mentions || []).forEach((m) => {
        if (m.article_id) {
          countMap[m.article_id] = (countMap[m.article_id] || 0) + 1;
        }
      });

      // 記事に商品数を付与（urlをキーにして参照）
      const articlesWithCount: ArticleWithProductCount[] = articles.map((a) => ({
        ...a,
        product_count: a.url ? countMap[a.url] || 0 : 0,
      }));

      return { articles: articlesWithCount, total: count || 0 };
    }
  }

  return { articles: articles as ArticleWithProductCount[], total: count || 0 };
}

// 動画・記事で使用されているタグを集計
export async function getSourceTagCounts(): Promise<Record<string, number>> {
  const [{ data: videos }, { data: articles }] = await Promise.all([
    supabase.from("videos").select("tags"),
    supabase.from("articles").select("tags"),
  ]);

  const tagCounts: Record<string, number> = {};

  for (const video of videos || []) {
    if (video.tags) {
      for (const tag of video.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  for (const article of articles || []) {
    if (article.tags) {
      for (const tag of article.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  return tagCounts;
}

// ブランド別の商品数を取得
export async function getBrandProductCounts(brands: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // 並列でクエリを実行
  const results = await Promise.all(
    brands.map(async (brand) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .ilike("brand", brand);
      return { brand, count: count || 0 };
    })
  );

  for (const { brand, count } of results) {
    counts[brand] = count;
  }

  return counts;
}

// ブランド別商品数を取得し、上位N件を返す
export async function getTopBrandsByProductCount(
  limit: number = 8
): Promise<Array<{ brand: string; count: number; slug: string }>> {
  const { data } = await supabase
    .from("products")
    .select("brand")
    .not("brand", "is", null);

  // ブランドごとにカウント
  const brandCounts: Record<string, number> = {};
  data?.forEach((p) => {
    if (p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    }
  });

  // 上位N件をソートして返す
  return Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand, count]) => ({
      brand,
      count,
      slug: brand.toLowerCase().replace(/\s+/g, "-"),
    }));
}

// ブランドがDBに存在するか確認し、正確なブランド名を返す
export async function findBrandInDatabase(brandName: string): Promise<string | null> {
  const { data } = await supabase
    .from("products")
    .select("brand")
    .ilike("brand", brandName)
    .limit(1);

  return data && data.length > 0 ? data[0].brand : null;
}
