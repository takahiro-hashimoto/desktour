import { supabase } from "./client";
import { findBrandByName } from "./queries-brands";
import type { ProductMention, VideoWithProductCount, ArticleWithProductCount, Video, Article } from "./types-unified";
import type {
  ProductWithStats,
  ProductComment,
  SearchParams,
  ProductDetail,
  OccupationStat,
  CoUsedProduct,
  SimilarProduct,
  DeskSetupStat,
  SiteStats,
  SourceDetail,
  SourceProduct,
} from "@/types";
import { getDomainConfig, type DomainId } from "@/lib/domain";
import { calculateSimilarityScore } from "@/lib/similarity-scoring";
import { CAMERA_SOURCE_BRAND_FILTERS } from "@/lib/camera/constants";

// DBブランド名のエイリアス -> フィルター正規名（カメラ専用）
const BRAND_ALIAS_MAP: Record<string, string> = {
  "lumix": "Panasonic",
  "ソニー": "Sony",
  "キヤノン": "Canon",
  "ニコン": "Nikon",
  "富士フイルム": "Fujifilm",
  "オリンパス": "Olympus",
  "パナソニック": "Panasonic",
  "ペンタックス": "Pentax",
  "リコー": "Ricoh",
  "ハッセルブラッド": "Hasselblad",
  "ライカ": "Leica",
};

// DBブランド名 -> フィルター用正規ブランド名に変換（カメラ専用）
function normalizeBrandToFilter(dbBrand: string): string | null {
  const lower = dbBrand.toLowerCase();
  // 1. フィルターリストとの直接マッチ（部分一致）
  for (const filterBrand of CAMERA_SOURCE_BRAND_FILTERS) {
    if (lower.includes(filterBrand.toLowerCase())) {
      return filterBrand;
    }
  }
  // 2. エイリアスマッチ
  for (const [alias, normalized] of Object.entries(BRAND_ALIAS_MAP)) {
    if (lower.includes(alias.toLowerCase())) {
      return normalized;
    }
  }
  return null;
}

// ランキング取得（言及回数でソート）
export async function getProductRanking(domain: DomainId, limit = 20, category?: string) {
  const config = getDomainConfig(domain);

  let query = supabase
    .from(config.tables.products)
    .select(`
      *,
      mention_count:${config.tables.product_mentions}!inner(count)
    `)
    .neq(`${config.tables.product_mentions}.confidence`, "low")
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
export async function getInfluencers(domain: DomainId, limit = 50) {
  const config = getDomainConfig(domain);

  const { data, error } = await supabase
    .from(config.tables.influencers)
    .select("*")
    .order("subscriber_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching influencers:", error);
    return [];
  }

  return data;
}

// カテゴリー内のサブカテゴリー一覧を取得（商品が存在するもののみ）
// カメラドメインのみ有効。desktourでは空配列を返す。
export async function getSubcategories(domain: DomainId, category: string): Promise<string[]> {
  const config = getDomainConfig(domain);

  if (!config.search.hasSubcategory) {
    return [];
  }

  const { data, error } = await supabase
    .from(config.tables.products)
    .select("subcategory")
    .eq("category", category)
    .not("subcategory", "is", null)
    .not("subcategory", "eq", "");

  if (error) {
    console.error("Error fetching subcategories:", error);
    return [];
  }

  // 重複を除去してユニークなサブカテゴリーリストを返す
  const subcategories = [...new Set((data || []).map(d => d.subcategory as string))];
  return subcategories;
}

// 商品検索（一覧ページ用）
export async function searchProducts(domain: DomainId, params: SearchParams): Promise<{
  products: ProductWithStats[];
  total: number;
}> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;

  const {
    occupationTag,
    category,
    typeTag,
    lensTag,
    bodyTag,
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
      .from(config.tables.videos)
      .select("video_id")
      .contains("tags", [setupTag]);

    const { data: taggedArticles } = await supabase
      .from(config.tables.articles)
      .select("url")
      .contains("tags", [setupTag]);

    validVideoIds = new Set(taggedVideos?.map(v => v.video_id) || []);
    validArticleIds = new Set(taggedArticles?.map(a => a.url) || []);
  }

  // occupationTagフィルタリング用のID取得（動画＋記事の両方に対応）
  if (occupationTag) {
    const { data: taggedInfluencers, error: infError } = await supabase
      .from(config.tables.influencers)
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
        .from(config.tables.videos)
        .select("video_id")
        .in("channel_id", channelIds);
      validVideoIds = new Set((taggedVideos || []).map(v => v.video_id).filter(Boolean));
    } else {
      validVideoIds = new Set();
    }

    // 記事URLを取得（author_idのドメイン部分でマッチング）
    if (authorIds.length > 0) {
      const { data: allArticles } = await supabase
        .from(config.tables.articles)
        .select("url, author_url");
      const matchedUrls: string[] = [];
      for (const article of allArticles || []) {
        const matched = authorIds.some((authorId) => {
          const articleDomain = authorId.split(":")[0];
          return article.author_url?.includes(articleDomain) || article.url?.includes(articleDomain);
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
    .from(config.tables.products)
    .select(`
      *,
      ${mentionsKey}!inner (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `, { count: "exact" })
    .neq(`${mentionsKey}.confidence`, "low")
    .not("asin", "is", null); // ASINがない商品を除外

  // カテゴリフィルタ
  if (category) {
    query = query.eq("category", category);
  }

  // 種類タグフィルタ
  if (typeTag) {
    if (config.search.hasSubcategory) {
      // Camera: subcategoryカラムで絞り込み
      query = query.eq("subcategory", typeTag);
    } else {
      // Desktour: tagsカラムで絞り込み
      query = query.contains("tags", [typeTag]);
    }
  }

  // レンズタグフィルタ（Camera専用）
  if (lensTag && config.search.hasLensTags) {
    query = query.contains("lens_tags", [lensTag]);
  }

  // ボディタグフィルタ（Camera専用）
  if (bodyTag && config.search.hasBodyTags) {
    query = query.contains("body_tags", [bodyTag]);
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

  // mention_countソートの場合、Supabaseでは集計カラムでのソートが不可能なため
  // 全件取得してJS側でソート＆ページネーションする必要がある
  const needsJsPagination = needsJsFilter || sortBy === "mention_count";

  // JS側でページネーションしない場合のみDBでページネーション
  if (!needsJsPagination) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error searching products:", error);
    return { products: [], total: 0 };
  }

  // データを整形
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: ProductWithStats[] = (data || []).map((product: any) => {
    let mentions = product[mentionsKey] || [];

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

    // 文字数が多い順にソートして上位3件を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedMentions = [...mentions].sort((a: any, b: any) =>
      (b.reason || "").length - (a.reason || "").length
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments: ProductComment[] = sortedMentions.slice(0, 3).map((m: any) => ({
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

  // JS側でページネーションが必要な場合（タグフィルタ or mention_countソート）
  const total = needsJsPagination ? products.length : (count || 0);
  if (needsJsPagination) {
    products = products.slice(offset, offset + limit);
  }

  return { products, total };
}

// カテゴリ別の商品数を取得（最適化: カテゴリとIDだけ取得、mentionsはjoinのみ）
export async function getProductCountByCategory(domain: DomainId): Promise<Record<string, number>> {
  const config = getDomainConfig(domain);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from(config.tables.products)
    .select(`id, category, ${config.tables.product_mentions}!inner(count)`)
    .neq(`${config.tables.product_mentions}.confidence`, "low")
    .not("asin", "is", null) as any);

  if (error) {
    console.error("Error fetching category counts:", error);
    return {};
  }

  // 同じ商品の重複を排除してカウント
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const product of (data || []) as any[]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    counts[product.category] = (counts[product.category] || 0) + 1;
  }

  return counts;
}

// ASINで商品詳細を取得
export async function getProductDetailByAsin(domain: DomainId, asin: string): Promise<ProductDetail | null> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;

  // 商品基本情報（confidence: low を除外）
  const { data: product, error } = await supabase
    .from(config.tables.products)
    .select(`
      *,
      ${mentionsKey} (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `)
    .eq("asin", asin)
    .neq(`${mentionsKey}.confidence`, "low")
    .single();

  if (error || !product) {
    console.error("Error fetching product detail by ASIN:", error);
    return null;
  }

  return getProductDetailCommon(domain, product);
}

// スラッグで商品詳細を取得
export async function getProductDetailBySlug(domain: DomainId, slug: string): Promise<ProductDetail | null> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;

  // 商品基本情報（confidence: low を除外）
  const { data: product, error } = await supabase
    .from(config.tables.products)
    .select(`
      *,
      ${mentionsKey} (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `)
    .eq("slug", slug)
    .neq(`${mentionsKey}.confidence`, "low")
    .maybeSingle();

  if (error) {
    console.error(`Error fetching product detail by slug "${slug}":`, error);
    return null;
  }

  if (!product) {
    return null;
  }

  return getProductDetailCommon(domain, product);
}

// 商品詳細を取得
export async function getProductDetail(domain: DomainId, productId: string): Promise<ProductDetail | null> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;

  // 商品基本情報（confidence: low を除外）
  const { data: product, error } = await supabase
    .from(config.tables.products)
    .select(`
      *,
      ${mentionsKey} (
        id,
        reason,
        source_type,
        video_id,
        article_id,
        confidence
      )
    `)
    .eq("id", productId)
    .neq(`${mentionsKey}.confidence`, "low")
    .maybeSingle();

  if (error) {
    console.error("Error fetching product detail:", error);
    return null;
  }

  if (!product) {
    return null;
  }

  return getProductDetailCommon(domain, product);
}

// 商品詳細の共通処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProductDetailCommon(domain: DomainId, product: any): Promise<ProductDetail | null> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;
  const productId = product.id;

  const mentions = product[mentionsKey] || [];

  // コメント（全件）にサムネイル情報を含める
  const videoIds = mentions.filter((m: ProductMention) => m.video_id).map((m: ProductMention) => m.video_id);
  const articleIds = mentions.filter((m: ProductMention) => m.article_id).map((m: ProductMention) => m.article_id);

  // 動画情報を一括取得
  const { data: commentVideos } = videoIds.length > 0
    ? await supabase.from(config.tables.videos)
        .select("video_id, title, thumbnail_url, channel_title")
        .in("video_id", videoIds)
    : { data: [] };

  // 記事情報を一括取得
  const { data: commentArticles } = articleIds.length > 0
    ? await supabase.from(config.tables.articles)
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
  const coUsedProducts = await getCoOccurrenceProducts(domain, productId, 10, product.category);

  // カテゴリ内順位を計算
  const { categoryRank, totalInCategory } = await getCategoryRank(domain, productId, product.category);

  // 職業別統計を取得
  const occupationBreakdown = await getOccupationBreakdownForProduct(domain, mentions);

  // デスクセットアップ統計を取得
  const deskSetupStats = await getDeskSetupStatsForProduct(domain, mentions);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory || undefined,
    tags: product.tags || undefined,
    lens_tags: product.lens_tags || undefined,
    body_tags: product.body_tags || undefined,
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
    chosen_reasons: product.chosen_reasons || undefined,
    updated_at: product.updated_at,
  };
}

// カテゴリ内順位を取得（同じmention_countは同順位）
async function getCategoryRank(domain: DomainId, productId: string, category: string): Promise<{ categoryRank: number; totalInCategory: number }> {
  const config = getDomainConfig(domain);
  const mentionsKey = config.tables.product_mentions;

  // 同じカテゴリの全商品を言及数でソートして取得
  const { data: products } = await supabase
    .from(config.tables.products)
    .select(`
      id,
      ${mentionsKey}!inner (count)
    `)
    .eq("category", category)
    .neq(`${mentionsKey}.confidence`, "low");

  if (!products || products.length === 0) {
    return { categoryRank: 0, totalInCategory: 0 };
  }

  // 言及数でソート
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = products.map((p: any) => ({
    id: p.id,
    count: Array.isArray(p[mentionsKey]) ? p[mentionsKey].length : (p[mentionsKey]?.[0]?.count || 0),
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
    const p = sorted[i];

    if (previousCount !== null && p.count < previousCount) {
      rank = i + 1;
    }

    if (p.id === productId) {
      return {
        categoryRank: rank,
        totalInCategory: products.length,
      };
    }

    previousCount = p.count;
  }

  return {
    categoryRank: rank,
    totalInCategory: products.length,
  };
}

// 商品の言及から職業別統計を取得
async function getOccupationBreakdownForProduct(domain: DomainId, mentions: ProductMention[]): Promise<OccupationStat[]> {
  const config = getDomainConfig(domain);
  const selectPrimaryOccupation = config.constants.selectPrimaryOccupation;

  const videoIds = mentions.filter((m) => m.video_id).map((m) => m.video_id);
  const articleIds = mentions.filter((m) => m.article_id).map((m) => m.article_id);

  if (videoIds.length === 0 && articleIds.length === 0) {
    return [];
  }

  const tagCounts = new Map<string, number>();
  const countedInfluencerIds = new Set<string>(); // 同一インフルエンサーの重複カウント防止

  // 動画からチャンネルID -> インフルエンサーの職業タグを取得
  if (videoIds.length > 0) {
    const { data: videos } = await supabase
      .from(config.tables.videos)
      .select("video_id, channel_id")
      .in("video_id", videoIds);

    const channelIds = (videos || []).map((v) => v.channel_id).filter(Boolean);

    if (channelIds.length > 0) {
      const { data: influencers } = await supabase
        .from(config.tables.influencers)
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

  // 記事から著者 -> インフルエンサーの職業タグを取得
  if (articleIds.length > 0) {
    const { data: articles } = await supabase
      .from(config.tables.articles)
      .select("url, author_url")
      .in("url", articleIds);

    // author_idを持つインフルエンサーを取得
    const { data: authorInfluencers } = await supabase
      .from(config.tables.influencers)
      .select("id, author_id, occupation_tags")
      .not("author_id", "is", null);

    for (const article of articles || []) {
      // author_urlまたはURL自体からマッチング
      const matchedInf = (authorInfluencers || []).find((inf) => {
        if (!inf.author_id) return false;
        const infDomain = inf.author_id.split(":")[0];
        return article.author_url?.includes(infDomain) || article.url?.includes(infDomain);
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
async function getDeskSetupStatsForProduct(domain: DomainId, mentions: ProductMention[]): Promise<DeskSetupStat[]> {
  const config = getDomainConfig(domain);

  const videoIds = mentions.filter((m) => m.video_id).map((m) => m.video_id);
  const articleIds = mentions.filter((m) => m.article_id).map((m) => m.article_id);

  if (videoIds.length === 0 && articleIds.length === 0) {
    return [];
  }

  // 動画からタグを取得
  const { data: videos } = videoIds.length > 0
    ? await supabase.from(config.tables.videos).select("video_id, tags").in("video_id", videoIds)
    : { data: [] };

  // 記事からタグを取得
  const { data: articles } = articleIds.length > 0
    ? await supabase.from(config.tables.articles).select("url, tags").in("url", articleIds)
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
  domain: DomainId,
  productId: string,
  limit = 10,
  currentProductCategory?: string
): Promise<CoUsedProduct[]> {
  const config = getDomainConfig(domain);

  // この商品が言及されている動画/記事のIDを取得
  const { data: mentions, error: mentionError } = await supabase
    .from(config.tables.product_mentions)
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
      .from(config.tables.product_mentions)
      .select("product_id")
      .in("video_id", videoIds)
      .neq("product_id", productId)
      .neq("confidence", "low");
    if (data) coMentions = [...coMentions, ...data];
  }

  if (articleIds.length > 0) {
    const { data } = await supabase
      .from(config.tables.product_mentions)
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
    .from(config.tables.products)
    .select("id, asin, slug, name, brand, category, amazon_image_url")
    .in("id", sortedProductIds);

  if (productError || !products) {
    return [];
  }

  // 相性の良いカテゴリを取得
  const compatibleCategories = currentProductCategory
    ? config.constants.getCompatibleCategories(currentProductCategory)
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

// 代替品・類似商品を取得（同カテゴリ内のタグ一致スコアリング）
export async function getSimilarProducts(
  domain: DomainId,
  product: {
    id: string;
    category: string;
    subcategory?: string;
    tags?: string[];
    lens_tags?: string[];
    body_tags?: string[];
    brand?: string;
    price_range?: string;
  },
  limit = 4,
): Promise<SimilarProduct[]> {
  const config = getDomainConfig(domain);

  // 同カテゴリの全商品を取得（自分自身を除外）
  // Camera固有カラムも常に含める（desktourではnull/undefinedになるだけ）
  const { data: candidates, error } = await supabase
    .from(config.tables.products)
    .select("id, asin, slug, name, brand, category, subcategory, tags, lens_tags, body_tags, price_range, amazon_image_url, amazon_price")
    .eq("category", product.category)
    .neq("id", product.id)
    .not("slug", "is", null);

  if (error || !candidates || candidates.length === 0) return [];

  // 各商品のmention_countを一括取得
  const candidateIds = candidates.map(c => c.id);
  const { data: mentions } = await supabase
    .from(config.tables.product_mentions)
    .select("product_id")
    .in("product_id", candidateIds)
    .neq("confidence", "low");

  const mentionCountMap: Record<string, number> = {};
  for (const m of mentions || []) {
    mentionCountMap[m.product_id] = (mentionCountMap[m.product_id] || 0) + 1;
  }

  // スコアリング
  const scored: SimilarProduct[] = candidates.map((c) => {
    const mentionCount = mentionCountMap[c.id] || 0;
    const { score, matchedTagCount } = calculateSimilarityScore(
      {
        tags: product.tags,
        brand: product.brand,
        price_range: product.price_range,
        mention_count: 0,
        subcategory: product.subcategory,
        lens_tags: product.lens_tags,
        body_tags: product.body_tags,
      },
      {
        tags: c.tags || [],
        brand: c.brand,
        price_range: c.price_range,
        mention_count: mentionCount,
        subcategory: c.subcategory,
        lens_tags: c.lens_tags || [],
        body_tags: c.body_tags || [],
      },
      config.constants.priceRangeOrder,
    );

    return {
      id: c.id,
      asin: c.asin,
      slug: c.slug,
      name: c.name,
      brand: c.brand,
      category: c.category,
      amazon_image_url: c.amazon_image_url,
      amazon_price: c.amazon_price,
      mention_count: mentionCount,
      similarity_score: score,
      matched_tag_count: matchedTagCount,
    };
  });

  // スコア > 0 のみ、スコア降順 -> mention_count降順でソート
  return scored
    .filter(s => s.similarity_score > 0)
    .sort((a, b) =>
      b.similarity_score - a.similarity_score ||
      b.mention_count - a.mention_count
    )
    .slice(0, limit);
}

// 同じブランドの人気商品を取得（商品詳細ページ用）
export async function getBrandPopularProducts(
  domain: DomainId,
  product: { id: string; brand?: string },
  limit = 4,
): Promise<SimilarProduct[]> {
  if (!product.brand) return [];

  const config = getDomainConfig(domain);

  // 同ブランドの商品を取得（自分自身を除外、slug必須）
  const { data: candidates, error } = await supabase
    .from(config.tables.products)
    .select("id, asin, slug, name, brand, category, amazon_image_url, amazon_price")
    .ilike("brand", product.brand)
    .neq("id", product.id)
    .not("slug", "is", null);

  if (error || !candidates || candidates.length === 0) return [];

  // mention_count を一括取得
  const candidateIds = candidates.map(c => c.id);
  const { data: mentions } = await supabase
    .from(config.tables.product_mentions)
    .select("product_id")
    .in("product_id", candidateIds)
    .neq("confidence", "low");

  const mentionCountMap: Record<string, number> = {};
  for (const m of mentions || []) {
    mentionCountMap[m.product_id] = (mentionCountMap[m.product_id] || 0) + 1;
  }

  // mention_count > 0 のみ、降順でソート
  return candidates
    .map((c) => ({
      id: c.id,
      asin: c.asin,
      slug: c.slug,
      name: c.name,
      brand: c.brand,
      category: c.category,
      amazon_image_url: c.amazon_image_url,
      amazon_price: c.amazon_price,
      mention_count: mentionCountMap[c.id] || 0,
      similarity_score: 0,
      matched_tag_count: 0,
    }))
    .filter(p => p.mention_count > 0)
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, limit);
}

// サイト統計を取得（トップページ用）
export async function getSiteStats(domain: DomainId): Promise<SiteStats> {
  const config = getDomainConfig(domain);

  const [
    { count: productCount },
    { count: mentionCount },
    { count: videoCount },
    { count: articleCount },
    { count: influencerCount },
  ] = await Promise.all([
    supabase.from(config.tables.products).select("*", { count: "exact", head: true }),
    supabase.from(config.tables.product_mentions).select("*", { count: "exact", head: true }),
    supabase.from(config.tables.videos).select("*", { count: "exact", head: true }),
    supabase.from(config.tables.articles).select("*", { count: "exact", head: true }),
    supabase.from(config.tables.influencers).select("*", { count: "exact", head: true }),
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
export async function getTopProductImages(domain: DomainId, limit = 24): Promise<string[]> {
  const config = getDomainConfig(domain);

  // product_mentionsから商品ごとの言及数を集計（confidence lowを除外）
  const { data: mentions, error: mentionError } = await supabase
    .from(config.tables.product_mentions)
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
    .from(config.tables.products)
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

// 各カテゴリの人気商品（画像付き）を取得（最適化: 並列クエリ、最小カラム）
export async function getTopProductByCategory(domain: DomainId): Promise<
  Record<string, { name: string; imageUrl: string; mentionCount: number }>
> {
  const config = getDomainConfig(domain);

  // 並列で商品情報と言及数を取得
  const [{ data: mentions, error: mentionError }, { data, error }] = await Promise.all([
    supabase.from(config.tables.product_mentions).select("product_id").neq("confidence", "low"),
    supabase.from(config.tables.products).select("id, name, category, amazon_image_url")
      .not("amazon_image_url", "is", null)
      .not("amazon_image_url", "eq", ""),
  ]);

  if (mentionError || error) {
    console.error("Error fetching top products by category:", mentionError || error);
    return {};
  }

  // 商品IDごとに言及数をカウント
  const mentionCounts = new Map<string, number>();
  for (const m of mentions || []) {
    mentionCounts.set(m.product_id, (mentionCounts.get(m.product_id) || 0) + 1);
  }

  // 各カテゴリで最も言及数が多い商品を1つだけ取得
  const result: Record<string, { name: string; imageUrl: string; mentionCount: number }> = {};

  const sortedProducts = (data || []).sort((a, b) => {
    return (mentionCounts.get(b.id) || 0) - (mentionCounts.get(a.id) || 0);
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

// 職業タグ別のデスクツアー数（動画+記事）を取得（最適化: 必要カラムのみ取得、並列クエリ）
export async function getOccupationTagCounts(domain: DomainId): Promise<Record<string, number>> {
  const config = getDomainConfig(domain);
  const selectPrimaryOccupation = config.constants.selectPrimaryOccupation;

  // 3つのクエリを並列実行
  const [
    { data: allInfluencers, error },
    { data: videos },
    { data: articles },
  ] = await Promise.all([
    supabase.from(config.tables.influencers).select("channel_id, author_id, occupation_tags").not("occupation_tags", "is", null),
    supabase.from(config.tables.videos).select("video_id, channel_id"),
    supabase.from(config.tables.articles).select("url, author_url"),
  ]);

  if (error) {
    console.error("Error fetching influencers:", error);
    return {};
  }

  // チャンネルID -> 職業タグ（第一優先）のマップ
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

  const tagSourceSet = new Map<string, Set<string>>();

  // 動画数をカウント
  for (const video of videos || []) {
    const tag = channelToTag.get(video.channel_id);
    if (tag && video.video_id) {
      if (!tagSourceSet.has(tag)) tagSourceSet.set(tag, new Set());
      tagSourceSet.get(tag)!.add(`v:${video.video_id}`);
    }
  }

  // 記事数をカウント
  for (const article of articles || []) {
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

// セットアップタグ別の動画・記事数を取得（最適化: tagsカラムのみ取得、not null フィルタ）
export async function getSetupTagCounts(domain: DomainId): Promise<Record<string, number>> {
  const config = getDomainConfig(domain);

  const [{ data: videos }, { data: articles }] = await Promise.all([
    supabase.from(config.tables.videos).select("tags").not("tags", "is", null),
    supabase.from(config.tables.articles).select("tags").not("tags", "is", null),
  ]);

  const counts: Record<string, number> = {};

  for (const video of videos || []) {
    if (video.tags) {
      for (const tag of video.tags) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }

  for (const article of articles || []) {
    if (article.tags) {
      for (const tag of article.tags) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }

  return counts;
}

// ソース詳細を取得（モーダル用）
// sourceIdはYouTubeの動画IDまたは記事のURL
export async function getSourceDetail(
  domain: DomainId,
  sourceType: "video" | "article",
  sourceId: string
): Promise<SourceDetail | null> {
  const config = getDomainConfig(domain);
  const productsTable = config.tables.products;

  if (sourceType === "video") {
    // 動画情報を取得（video_idはYouTubeの動画ID）
    const { data: video, error: videoError } = await supabase
      .from(config.tables.videos)
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
      .from(config.tables.product_mentions)
      .select(`
        reason,
        product_id,
        ${productsTable} (
          id,
          slug,
          name,
          brand,
          category,
          tags,
          asin,
          amazon_title,
          amazon_price,
          amazon_features,
          amazon_technical_info,
          amazon_categories,
          amazon_brand,
          amazon_image_url,
          amazon_url,
          amazon_model_number,
          product_source
        )
      `)
      .eq("video_id", video.video_id)
      .neq("confidence", "low");

    // 各商品のmention_countを取得
    const productIds = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m[productsTable])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.product_id);

    const { data: mentionCounts } = productIds.length > 0
      ? await supabase
          .from(config.tables.product_mentions)
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
      .filter((m: any) => m[productsTable])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => {
        const productData = m[productsTable];
        return {
          id: productData.id,
          slug: productData.slug,
          name: productData.name,
          brand: productData.brand,
          category: productData.category,
          tags: productData.tags,
          asin: productData.asin,
          amazon_price: productData.amazon_price,
          amazon_image_url: productData.amazon_image_url,
          amazon_url: productData.amazon_url,
          amazon_model_number: productData.amazon_model_number,
          product_source: productData.product_source,
          reason: m.reason,
          mention_count: countMap.get(m.product_id) || 1,
        };
      });

    // influencers テーブルから occupation_tags を取得
    let occupationTags: string[] = [];

    if (video.channel_id) {
      const { data: influencer } = await supabase
        .from(config.tables.influencers)
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
      .from(config.tables.articles)
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
      .from(config.tables.product_mentions)
      .select(`
        reason,
        product_id,
        ${productsTable} (
          id,
          slug,
          name,
          brand,
          category,
          tags,
          asin,
          amazon_title,
          amazon_price,
          amazon_features,
          amazon_technical_info,
          amazon_categories,
          amazon_brand,
          amazon_image_url,
          amazon_url,
          amazon_model_number,
          product_source
        )
      `)
      .eq("article_id", article.url)
      .neq("confidence", "low");

    // 各商品のmention_countを取得
    const productIds = (mentions || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m[productsTable])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.product_id);

    const { data: mentionCounts } = productIds.length > 0
      ? await supabase
          .from(config.tables.product_mentions)
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
      .filter((m: any) => m[productsTable])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => {
        const productData = m[productsTable];
        return {
          id: productData.id,
          slug: productData.slug,
          name: productData.name,
          brand: productData.brand,
          category: productData.category,
          tags: productData.tags,
          asin: productData.asin,
          amazon_price: productData.amazon_price,
          amazon_image_url: productData.amazon_image_url,
          amazon_url: productData.amazon_url,
          amazon_model_number: productData.amazon_model_number,
          product_source: productData.product_source,
          reason: m.reason,
          mention_count: countMap.get(m.product_id) || 1,
        };
      });

    // 記事著者の職業タグを取得
    // author_idは "ドメイン:著者名" 形式なので、記事URLのドメイン部分でマッチング
    let occupationTags: string[] = [];
    const { data: influencersData } = await supabase
      .from(config.tables.influencers)
      .select("author_id, occupation_tags")
      .not("author_id", "is", null);

    const matchedInfluencer = influencersData?.find((inf) => {
      if (!inf.author_id) return false;
      // author_idからドメイン部分を抽出（例: "ritalog0317.com:リタ" -> "ritalog0317.com"）
      const infDomain = inf.author_id.split(":")[0];
      return article.url?.includes(infDomain);
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
export async function getVideos(domain: DomainId, params: {
  tags?: string[];
  year?: number;
  sortBy?: "published_at" | "subscriber_count";
  page?: number;
  limit?: number;
}): Promise<{ videos: VideoWithProductCount[]; total: number }> {
  const config = getDomainConfig(domain);
  const { tags, year, sortBy = "published_at", page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from(config.tables.videos)
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
      .from(config.tables.product_mentions)
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
export async function getArticles(domain: DomainId, params: {
  tags?: string[];
  year?: number;
  sourceType?: "note" | "blog" | "official" | "other";
  sortBy?: "published_at";
  page?: number;
  limit?: number;
}): Promise<{ articles: ArticleWithProductCount[]; total: number }> {
  const config = getDomainConfig(domain);
  const { tags, year, sourceType, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from(config.tables.articles)
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
        .from(config.tables.product_mentions)
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

// 動画・記事で使用されているタグを集計（最適化: not null フィルタ）
export async function getSourceTagCounts(domain: DomainId): Promise<Record<string, number>> {
  const config = getDomainConfig(domain);

  const [{ data: videos }, { data: articles }] = await Promise.all([
    supabase.from(config.tables.videos).select("tags").not("tags", "is", null),
    supabase.from(config.tables.articles).select("tags").not("tags", "is", null),
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

// ソース（動画/記事）ごとの登場ブランド一覧を取得（カメラ専用）
// desktourでは空のデータを返す
export async function getSourceBrands(domain: DomainId): Promise<{
  videoBrands: Record<string, string[]>;
  articleBrands: Record<string, string[]>;
  allBrands: string[];
}> {
  const config = getDomainConfig(domain);

  // desktourにはブランドフィルタリング機能がない
  if (domain !== "camera") {
    return { videoBrands: {}, articleBrands: {}, allBrands: [] };
  }

  const { data, error } = await supabase
    .from(config.tables.product_mentions)
    .select("video_id, article_id, product_id")
    .neq("confidence", "low");

  if (error || !data) {
    console.error("Error fetching source brands:", error);
    return { videoBrands: {}, articleBrands: {}, allBrands: [] };
  }

  // product_idからブランドを取得
  const productIds = [...new Set(data.map(d => d.product_id).filter(Boolean))];
  const { data: products } = await supabase
    .from(config.tables.products)
    .select("id, brand")
    .in("id", productIds)
    .not("brand", "is", null);

  // DBブランド -> フィルター正規名のマップを構築
  const productNormalizedBrandMap = new Map<string, string>();
  for (const p of products || []) {
    const normalized = normalizeBrandToFilter(p.brand);
    if (normalized) {
      productNormalizedBrandMap.set(p.id, normalized);
    }
  }

  const videoBrandsMap = new Map<string, Set<string>>();
  const articleBrandsMap = new Map<string, Set<string>>();
  const allBrandsSet = new Set<string>();

  for (const mention of data) {
    const brandName = productNormalizedBrandMap.get(mention.product_id);
    if (!brandName) continue;
    allBrandsSet.add(brandName);

    if (mention.video_id) {
      if (!videoBrandsMap.has(mention.video_id)) videoBrandsMap.set(mention.video_id, new Set());
      videoBrandsMap.get(mention.video_id)!.add(brandName);
    }
    if (mention.article_id) {
      if (!articleBrandsMap.has(mention.article_id)) articleBrandsMap.set(mention.article_id, new Set());
      articleBrandsMap.get(mention.article_id)!.add(brandName);
    }
  }

  // JSON-serializable なオブジェクトに変換（unstable_cache対応）
  const videoBrands: Record<string, string[]> = {};
  for (const [k, v] of videoBrandsMap) {
    videoBrands[k] = [...v];
  }
  const articleBrands: Record<string, string[]> = {};
  for (const [k, v] of articleBrandsMap) {
    articleBrands[k] = [...v];
  }

  return {
    videoBrands,
    articleBrands,
    allBrands: [...allBrandsSet].sort(),
  };
}

// ブランド別の商品数を取得
export async function getBrandProductCounts(domain: DomainId, brands: string[]): Promise<Record<string, number>> {
  const config = getDomainConfig(domain);
  const counts: Record<string, number> = {};

  // 並列でクエリを実行
  const results = await Promise.all(
    brands.map(async (brand) => {
      const { count } = await supabase
        .from(config.tables.products)
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
// brands マスターテーブルから slug / icon / description を取得
export async function getTopBrandsByProductCount(
  domain: DomainId,
  limit: number = 8,
  minCount: number = 1
): Promise<Array<{ brand: string; count: number; slug: string; icon?: string; description?: string }>> {
  const config = getDomainConfig(domain);
  const descField = domain === "camera" ? "description_camera" : "description_desktour";

  const { data } = await supabase
    .from(config.tables.products)
    .select("brand")
    .not("brand", "is", null);

  // ブランドごとにカウント
  const brandCounts: Record<string, number> = {};
  data?.forEach((p) => {
    if (p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    }
  });

  const topBrands = Object.entries(brandCounts)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // brands マスターテーブルから slug/icon/description を一括取得
  const brandNames = topBrands.map(([name]) => name);
  const { data: brandsData } = await supabase
    .from("brands")
    .select(`name, slug, icon, ${descField}`)
    .in("name", brandNames.length > 0 ? brandNames : ["__none__"]);

  const brandLookup = new Map<string, { slug: string; icon?: string; description?: string }>();
  for (const b of (brandsData || []) as { name: string; slug: string; icon: string | null; [key: string]: unknown }[]) {
    brandLookup.set(b.name, {
      slug: b.slug,
      icon: b.icon || undefined,
      description: (b[descField] as string) || undefined,
    });
  }

  // フォールバック slug 生成（brands テーブル未登録ブランド用）
  const fallbackSlug = (brand: string) =>
    brand.replace(/[（(].+?[）)]/g, "").trim().toLowerCase().replace(/\s+/g, "-");

  return topBrands.map(([brand, count]) => {
    const info = brandLookup.get(brand);
    return {
      brand,
      count,
      slug: info?.slug || fallbackSlug(brand),
      icon: info?.icon,
      description: info?.description,
    };
  });
}

// ブランドがDBに存在するか確認し、正確なブランド名を返す
// brands マスターテーブルを最優先で検索し、fallback で products テーブルをスキャン
export async function findBrandInDatabase(domain: DomainId, brandName: string): Promise<string | null> {
  // 1. brands マスターテーブルで検索（name / aliases で解決）
  const brandRow = await findBrandByName(brandName);
  if (brandRow) return brandRow.name;

  // 2. fallback: products テーブルで ilike 検索（brands テーブル未登録ブランド用）
  const config = getDomainConfig(domain);

  const { data } = await supabase
    .from(config.tables.products)
    .select("brand")
    .ilike("brand", brandName)
    .limit(1);

  if (data && data.length > 0) return data[0].brand;

  // 3. ハイフン・スペースを相互変換して再検索
  const normalized = brandName.replace(/[-\s]+/g, "%");
  if (normalized !== brandName) {
    const { data: data2 } = await supabase
      .from(config.tables.products)
      .select("brand")
      .ilike("brand", normalized)
      .limit(1);

    if (data2 && data2.length > 0) return data2[0].brand;
  }

  return null;
}

// 最新のデスクツアー動画を取得（TOPページ用）
export async function getLatestVideos(domain: DomainId, limit: number = 3): Promise<VideoWithProductCount[]> {
  const config = getDomainConfig(domain);

  const { data: videos } = await supabase
    .from(config.tables.videos)
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!videos || videos.length === 0) {
    return [];
  }

  // 各動画の商品数を取得（confidence lowを除外）
  const videoIds = videos.map((v) => v.video_id);
  const { data: mentions } = await supabase
    .from(config.tables.product_mentions)
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
        .from(config.tables.influencers)
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

/** DB登録済み商品をキーワードで検索（Admin検索モーダル用） */
export async function searchExistingProducts(
  domain: DomainId,
  keyword: string,
  limit = 5
): Promise<Array<{
  id: string;
  name: string;
  brand: string | null;
  asin: string | null;
  amazon_url: string | null;
  amazon_image_url: string | null;
  amazon_price: number | null;
  product_source: string | null;
  mention_count: number;
}>> {
  const config = getDomainConfig(domain);

  // ilike でキーワード部分一致検索
  const { data, error } = await supabase
    .from(config.tables.products)
    .select("id, name, brand, asin, amazon_url, amazon_image_url, amazon_price, product_source")
    .ilike("name", `%${keyword}%`)
    .order("name")
    .limit(limit);

  if (error || !data) return [];

  // 各商品のmention_countを取得
  const productIds = data.map((p: any) => p.id);
  const { data: mentionCounts } = productIds.length > 0
    ? await supabase
        .from(config.tables.product_mentions)
        .select("product_id")
        .in("product_id", productIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const mc of mentionCounts || []) {
    countMap.set(mc.product_id, (countMap.get(mc.product_id) || 0) + 1);
  }

  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    asin: p.asin,
    amazon_url: p.amazon_url,
    amazon_image_url: p.amazon_image_url,
    amazon_price: p.amazon_price,
    product_source: p.product_source,
    mention_count: countMap.get(p.id) || 0,
  }));
}
