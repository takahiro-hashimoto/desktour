import { supabase } from "./client";
import type { Video, ProductMention, Influencer, VideoWithProductCount, ArticleWithProductCount, Article } from "./types";
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
import { getCompatibleCategories, selectPrimaryOccupation } from "@/lib/constants";

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

// 商品検索（一覧ページ用）
export async function searchProducts(params: SearchParams): Promise<{
  products: ProductWithStats[];
  total: number;
}> {
  const {
    occupationTag,
    category,
    typeTag,
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

  // occupationTagフィルタリング用のID取得（動画＋記事の両方に対応）
  if (occupationTag) {
    const { data: taggedInfluencers, error: infError } = await supabase
      .from("influencers")
      .select("channel_id, author_id, occupation_tags")
      .contains("occupation_tags", [occupationTag]);

    if (infError) {
      console.error("Error fetching influencers by occupation_tags:", infError);
    }

    const channelIds = (taggedInfluencers || []).map(i => i.channel_id).filter(Boolean);
    const authorIds = (taggedInfluencers || []).map(i => i.author_id).filter(Boolean);

    // 動画IDを取得
    if (channelIds.length > 0) {
      const { data: taggedVideos } = await supabase
        .from("videos")
        .select("video_id")
        .in("channel_id", channelIds);
      validVideoIds = new Set((taggedVideos || []).map(v => v.video_id).filter(Boolean));
    } else {
      validVideoIds = new Set();
    }

    // 記事URLを取得（author_idのドメイン部分でマッチング）
    if (authorIds.length > 0) {
      const { data: allArticles } = await supabase
        .from("articles")
        .select("url, author_url");
      const matchedUrls: string[] = [];
      for (const article of allArticles || []) {
        const matched = authorIds.some((authorId) => {
          const domain = authorId.split(":")[0];
          return article.author_url?.includes(domain) || article.url?.includes(domain);
        });
        if (matched && article.url) matchedUrls.push(article.url);
      }
      validArticleIds = new Set(matchedUrls);
    } else {
      validArticleIds = new Set();
    }
  }

  // 基本クエリ: 商品と言及数を取得
  // タグフィルタがある場合はページネーションを外して全件取得（JS側でフィルタ後にページネーション）
  const needsJsFilter = setupTag || occupationTag;

  let query = supabase
    .from("products")
    .select(`
      *,
      product_mentions!inner (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `, { count: "exact" })
    .neq("product_mentions.confidence", "low")
    .not("asin", "is", null); // ASINがない商品を除外

  // カテゴリフィルタ
  if (category) {
    query = query.eq("category", category);
  }

  // 種類タグフィルタ
  if (typeTag) {
    query = query.contains("tags", [typeTag]);
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
      comment: m.reason || "",
      source_type: m.source_type || "video",
      source_id: m.video_id || m.article_id || undefined,
      source_title: "",
      occupation_tags: [],
    }));

    return {
      id: product.id,
      asin: product.asin,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      tags: product.tags || undefined,
      price_range: product.price_range,
      amazon_url: product.amazon_url,
      amazon_image_url: product.amazon_image_url,
      amazon_price: product.amazon_price,
      amazon_title: product.amazon_title,
      rakuten_url: product.rakuten_url,
      rakuten_image_url: product.rakuten_image_url,
      official_url: product.official_url,
      product_source: product.product_source,
      updated_at: product.updated_at,
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
  // searchProductsと同じ条件で数える（ASIN有り & confidence != low の言及がある商品のみ）
  const { data, error } = await supabase
    .from("products")
    .select("id, category, product_mentions!inner(id, confidence)")
    .neq("product_mentions.confidence", "low")
    .not("asin", "is", null);

  if (error) {
    console.error("Error fetching category counts:", error);
    return {};
  }

  // 同じ商品の重複を排除してカウント
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (const product of data || []) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    counts[product.category] = (counts[product.category] || 0) + 1;
  }

  return counts;
}

// ASINで商品詳細を取得
export async function getProductDetailByAsin(asin: string): Promise<ProductDetail | null> {
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
    .eq("asin", asin)
    .neq("product_mentions.confidence", "low")
    .single();

  if (error || !product) {
    console.error("Error fetching product detail by ASIN:", error);
    return null;
  }

  return getProductDetailCommon(product);
}

// スラッグで商品詳細を取得
export async function getProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
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
    .eq("slug", slug)
    .neq("product_mentions.confidence", "low")
    .maybeSingle();

  if (error) {
    console.error(`Error fetching product detail by slug "${slug}":`, error);
    return null;
  }

  if (!product) {
    return null;
  }

  return getProductDetailCommon(product);
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
    .maybeSingle();

  if (error) {
    console.error("Error fetching product detail:", error);
    return null;
  }

  if (!product) {
    return null;
  }

  return getProductDetailCommon(product);
}

// 商品詳細の共通処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProductDetailCommon(product: any): Promise<ProductDetail | null> {
  const productId = product.id;

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
        comment: m.reason || "",
        source_type: "video" as const,
        source_video_id: m.video_id,
        source_url: `https://www.youtube.com/watch?v=${m.video_id}`,
        source_title: video?.title || "",
        source_thumbnail_url: video?.thumbnail_url || undefined,
        channel_title: video?.channel_title,
        occupation_tags: [],
      };
    } else if (m.article_id) {
      const article = articleMap.get(m.article_id);
      return {
        comment: m.reason || "",
        source_type: "article" as const,
        source_id: m.article_id,
        source_url: m.article_id,
        source_title: article?.title || "",
        source_thumbnail_url: article?.thumbnail_url || undefined,
        author: article?.author || undefined,
        occupation_tags: [],
      };
    } else {
      // video_idもarticle_idもない場合
      return {
        comment: m.reason || "",
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
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    tags: product.tags || undefined,
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

// カテゴリ内順位を取得（同じmention_countは同順位）
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

  // 対象商品のmention_countを取得
  const targetProduct = sorted.find((p) => p.id === productId);
  if (!targetProduct) {
    return { categoryRank: 0, totalInCategory: products.length };
  }

  // 同じcount値の場合は同順位として計算
  let rank = 1;
  let previousCount: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const product = sorted[i];

    if (previousCount !== null && product.count < previousCount) {
      rank = i + 1;
    }

    if (product.id === productId) {
      return {
        categoryRank: rank,
        totalInCategory: products.length,
      };
    }

    previousCount = product.count;
  }

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

  const tagCounts = new Map<string, number>();
  const countedInfluencerIds = new Set<string>(); // 同一インフルエンサーの重複カウント防止

  // 動画からチャンネルID → インフルエンサーの職業タグを取得
  if (videoIds.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("video_id", videoIds);

    const channelIds = (videos || []).map((v) => v.channel_id).filter(Boolean);

    if (channelIds.length > 0) {
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, channel_id, occupation_tags")
        .in("channel_id", channelIds);

      for (const inf of influencers || []) {
        if (countedInfluencerIds.has(inf.id)) continue;
        if (inf.occupation_tags && inf.occupation_tags.length > 0) {
          const primaryTag = selectPrimaryOccupation(inf.occupation_tags);
          if (primaryTag) {
            tagCounts.set(primaryTag, (tagCounts.get(primaryTag) || 0) + 1);
            countedInfluencerIds.add(inf.id);
          }
        }
      }
    }
  }

  // 記事から著者 → インフルエンサーの職業タグを取得
  if (articleIds.length > 0) {
    const { data: articles } = await supabase
      .from("articles")
      .select("url, author_url")
      .in("url", articleIds);

    // author_idを持つインフルエンサーを取得
    const { data: authorInfluencers } = await supabase
      .from("influencers")
      .select("id, author_id, occupation_tags")
      .not("author_id", "is", null);

    for (const article of articles || []) {
      // author_urlまたはURL自体からマッチング
      const matchedInf = (authorInfluencers || []).find((inf) => {
        if (!inf.author_id) return false;
        const domain = inf.author_id.split(":")[0];
        return article.author_url?.includes(domain) || article.url?.includes(domain);
      });

      if (matchedInf && !countedInfluencerIds.has(matchedInf.id)) {
        if (matchedInf.occupation_tags && matchedInf.occupation_tags.length > 0) {
          const primaryTag = selectPrimaryOccupation(matchedInf.occupation_tags);
          if (primaryTag) {
            tagCounts.set(primaryTag, (tagCounts.get(primaryTag) || 0) + 1);
            countedInfluencerIds.add(matchedInf.id);
          }
        }
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
    .select("id, asin, slug, name, brand, category, amazon_image_url")
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
      asin: p.asin,
      slug: p.slug,
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

// 職業タグ別のデスクツアー数（動画+記事）を取得
export async function getOccupationTagCounts(): Promise<Record<string, number>> {
  // インフルエンサー情報を取得
  const { data: allInfluencers, error } = await supabase
    .from("influencers")
    .select("id, channel_id, author_id, occupation_tags");

  if (error) {
    console.error("Error fetching influencers:", error);
    return {};
  }

  // チャンネルID → 職業タグ（第一優先）のマップ
  const channelToTag = new Map<string, string>();
  const authorToTag = new Map<string, string>();

  for (const inf of allInfluencers || []) {
    if (inf.occupation_tags && inf.occupation_tags.length > 0) {
      const primaryTag = selectPrimaryOccupation(inf.occupation_tags);
      if (primaryTag) {
        if (inf.channel_id) channelToTag.set(inf.channel_id, primaryTag);
        if (inf.author_id) authorToTag.set(inf.author_id, primaryTag);
      }
    }
  }

  // 動画数をカウント
  const { data: videos } = await supabase
    .from("videos")
    .select("video_id, channel_id");

  const tagSourceSet = new Map<string, Set<string>>();

  for (const video of videos || []) {
    const tag = channelToTag.get(video.channel_id);
    if (tag && video.video_id) {
      if (!tagSourceSet.has(tag)) tagSourceSet.set(tag, new Set());
      tagSourceSet.get(tag)!.add(`v:${video.video_id}`);
    }
  }

  // 記事数をカウント
  const { data: articles } = await supabase
    .from("articles")
    .select("url, author_url");

  for (const article of articles || []) {
    // author_urlからマッチするインフルエンサーを探す
    const matchedEntry = Array.from(authorToTag.entries()).find(
      ([authorId]) => article.author_url?.includes(authorId.split(":")[0]) || article.url?.includes(authorId.split(":")[0])
    );
    if (matchedEntry && article.url) {
      const [, tag] = matchedEntry;
      if (!tagSourceSet.has(tag)) tagSourceSet.set(tag, new Set());
      tagSourceSet.get(tag)!.add(`a:${article.url}`);
    }
  }

  const counts: Record<string, number> = {};
  for (const [tag, sources] of tagSourceSet) {
    counts[tag] = sources.size;
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
          slug,
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
        slug: m.products.slug,
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

    if (video.channel_id) {
      const { data: influencer } = await supabase
        .from("influencers")
        .select("occupation_tags")
        .eq("channel_id", video.channel_id)
        .single();

      if (influencer?.occupation_tags && influencer.occupation_tags.length > 0) {
        occupationTags = influencer.occupation_tags;
      }
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
          slug,
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
        slug: m.products.slug,
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
    const { data: influencersData } = await supabase
      .from("influencers")
      .select("author_id, occupation_tags")
      .not("author_id", "is", null);

    const matchedInfluencer = influencersData?.find((inf) => {
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

// 最新のデスクツアー動画を取得（TOPページ用）
export async function getLatestVideos(limit: number = 3): Promise<VideoWithProductCount[]> {
  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!videos || videos.length === 0) {
    return [];
  }

  // 各動画の商品数を取得（confidence lowを除外）
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

  // インフルエンサー情報を取得してタグを付与
  const channelIds = videos.map((v) => v.channel_id).filter(Boolean);
  const { data: influencersData } = channelIds.length > 0
    ? await supabase
        .from("influencers")
        .select("channel_id, occupation_tags")
        .in("channel_id", channelIds)
    : { data: [] };

  const influencerMap = new Map(
    (influencersData || []).map((inf) => [inf.channel_id, inf.occupation_tags || []])
  );

  // 動画に商品数とタグを付与
  const videosWithCount: VideoWithProductCount[] = videos.map((v) => ({
    ...v,
    product_count: countMap[v.video_id] || 0,
    occupation_tags: influencerMap.get(v.channel_id) || [],
  }));

  return videosWithCount;
}
