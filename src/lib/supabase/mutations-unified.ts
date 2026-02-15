/**
 * 統合ミューテーション層
 * 全ドメイン（desktour, camera）で共通のDB書き込みロジック。
 * 各関数の第1引数に domain: DomainId を取り、getDomainConfig() でテーブル名・定数を解決する。
 */

import { supabase } from "./client";
import type { Video, Article, Product, ProductMention, Influencer } from "./types-unified";
import type { DomainId } from "@/lib/domain";
import { getDomainConfig } from "@/lib/domain";
import { normalizeProductName } from "../product-normalize";
import { generateProductSlug, addSuffixToSlug } from "../productSlug";
import { extractProductTags } from "../tag-inference";
import { normalizeBrand } from "./queries-common";
import { fuzzyMatchProduct } from "../fuzzy-product-match";
import { isExcludedBrand } from "../excluded-brands";

// ========== 型エクスポート ==========

export interface SaveProductResult<T> {
  product: T | null;
  isExisting: boolean;
}

/** ファジーマッチ用カテゴリキャッシュ型（ループ内で使い回してSupabaseクエリを削減） */
export type FuzzyCategoryCache = Map<string, Array<{ id: string; name: string; normalized_name: string; brand: string | null }>>;

// ========== チェック関数 ==========

/** 動画が既に解析済みかチェック */
export async function isVideoAnalyzed(domain: DomainId, videoId: string): Promise<boolean> {
  const config = getDomainConfig(domain);
  const { data } = await supabase
    .from(config.tables.videos)
    .select("id")
    .eq("video_id", videoId)
    .single();

  return !!data;
}

/** 記事が既に解析済みかチェック */
export async function isArticleAnalyzed(domain: DomainId, url: string): Promise<boolean> {
  const config = getDomainConfig(domain);
  const { data } = await supabase
    .from(config.tables.articles)
    .select("id")
    .eq("url", url)
    .single();

  return !!data;
}

// ========== ソース保存 ==========

/** 記事を保存 */
export async function saveArticle(domain: DomainId, article: Article): Promise<{ data: Article | null; isNew: boolean }> {
  const config = getDomainConfig(domain);

  // 既存チェック
  const { data: existing } = await supabase
    .from(config.tables.articles)
    .select("*")
    .eq("url", article.url)
    .single();

  if (existing) {
    return { data: existing as Article, isNew: false };
  }

  const { data, error } = await supabase
    .from(config.tables.articles)
    .insert([article])
    .select()
    .single();

  if (error) {
    console.error(`[saveArticle][${domain}] Error saving article:`, error);
    return { data: null, isNew: false };
  }

  return { data: data as Article, isNew: true };
}

/** 動画を保存 */
export async function saveVideo(domain: DomainId, video: Video): Promise<{ data: Video | null; isNew: boolean }> {
  const config = getDomainConfig(domain);

  // 既存チェック
  const { data: existing } = await supabase
    .from(config.tables.videos)
    .select("*")
    .eq("video_id", video.video_id)
    .single();

  if (existing) {
    return { data: existing as Video, isNew: false };
  }

  const { data, error } = await supabase
    .from(config.tables.videos)
    .insert([video])
    .select()
    .single();

  if (error) {
    console.error(`[saveVideo][${domain}] Error saving video:`, error);
    return { data: null, isNew: false };
  }

  return { data: data as Video, isNew: true };
}

// ========== 商品保存 ==========

/** 商品を保存（正規化名で重複チェック - 色違い・サイズ違いを統合） */
export async function saveProduct(
  domain: DomainId,
  product: Omit<Product, "id">,
  fuzzyCategoryCache?: FuzzyCategoryCache,
  /** 段階1(findExistingProducts)で既にマッチ済みの商品ID（あればDB検索をスキップ） */
  preMatchedProductId?: string
): Promise<SaveProductResult<Product>> {
  const config = getDomainConfig(domain);
  const productsTable = config.tables.products as "products" | "products_camera";
  const logPrefix = `[saveProduct][${domain}]`;

  // ブランド名を正規化
  if (product.brand) {
    const originalBrand = product.brand;
    const normalized = await normalizeBrand(product.brand, productsTable, config.constants.brandTags);
    if (originalBrand !== normalized) {
      console.log(`${logPrefix} Brand normalized: "${originalBrand}" → "${normalized}"`);
      product = { ...product, brand: normalized };
    }
  }

  // 正規化名を生成（色・サイズ表記を除去）
  const normalizedName = normalizeProductName(product.name);
  console.log(`${logPrefix} Original: "${product.name}" → Normalized: "${normalizedName}"`);

  let existing: Record<string, unknown> | null = null;

  // 【優先0】段階1(findExistingProducts)で既にマッチ済みの場合、直接DBから取得（DB問い合わせ削減）
  if (preMatchedProductId) {
    const { data: preMatched } = await supabase
      .from(productsTable)
      .select("*")
      .eq("id", preMatchedProductId)
      .maybeSingle();
    if (preMatched) {
      existing = preMatched;
      console.log(`${logPrefix} Pre-matched from stage 1: "${preMatched.name}" (id: ${preMatchedProductId})`);
    }
  }

  // 【優先1】ASINが指定されていれば、ASINで既存商品を検索（最も信頼性が高い）
  // 偽ASINプレフィックス（official-/existing-）は除外
  if (product.asin && !product.asin.startsWith("official-") && !product.asin.startsWith("existing-")) {
    const { data: asinMatch } = await supabase
      .from(productsTable)
      .select("*")
      .eq("asin", product.asin)
      .limit(1)
      .single();
    if (asinMatch) {
      existing = asinMatch;
      console.log(`${logPrefix} Found existing by ASIN: "${asinMatch.name}" (asin: ${product.asin})`);
    }
  }

  // 【優先1.5】amazon_url（公式サイトURL含む）で既存商品を検索
  if (!existing && product.amazon_url) {
    const { data: urlMatch } = await supabase
      .from(productsTable)
      .select("*")
      .eq("amazon_url", product.amazon_url)
      .limit(1)
      .maybeSingle();
    if (urlMatch) {
      existing = urlMatch;
      console.log(`${logPrefix} Found existing by URL: "${urlMatch.name}" (url: ${product.amazon_url})`);
    }
  }

  // 【優先2】正規化名でチェック（.eq() を使用、.or() の文字列補間はスペース・日本語で壊れるため）
  if (!existing) {
    const { data: byNormalized } = await supabase
      .from(productsTable)
      .select("*")
      .eq("normalized_name", normalizedName)
      .limit(1)
      .maybeSingle();

    if (byNormalized) {
      existing = byNormalized;
      console.log(`${logPrefix} Found existing: "${byNormalized.name}" (matched by normalized_name)`);
    }
  }

  // 【優先2.5】通常名でチェック
  if (!existing) {
    const { data: byName } = await supabase
      .from(productsTable)
      .select("*")
      .eq("name", product.name)
      .limit(1)
      .maybeSingle();

    if (byName) {
      existing = byName;
      console.log(`${logPrefix} Found existing: "${byName.name}" (matched by name)`);
    }
  }

  // --- ファジーマッチフォールバック ---
  if (!existing && product.category) {
    let sameCategoryProducts = fuzzyCategoryCache?.get(product.category);

    if (!sameCategoryProducts) {
      const { data } = await supabase
        .from(productsTable)
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
        console.log(`${logPrefix} Fuzzy match: "${product.name}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
        // 既存商品のフルデータを取得
        const { data: fullProduct } = await supabase
          .from(productsTable)
          .select("*")
          .eq("id", matched.id)
          .single();
        if (fullProduct) existing = fullProduct;
      }
    }
  }

  // --- 除外ブランド（PREDUCTS, Grovemade, WAAK等）の場合、同ブランド商品をDB検索してファジーマッチ ---
  if (!existing) {
    const excludedBrand = isExcludedBrand(product.name) ||
      (product.brand ? isExcludedBrand(product.brand) : null);

    if (excludedBrand) {
      console.log(`${logPrefix} Excluded brand "${excludedBrand.name}" detected — searching DB by brand...`);
      const { data: brandProducts } = await supabase
        .from(productsTable)
        .select("id, name, normalized_name, brand")
        .ilike("brand", excludedBrand.name)
        .limit(100);

      if (brandProducts && brandProducts.length > 0) {
        console.log(`${logPrefix} Found ${brandProducts.length} "${excludedBrand.name}" products in DB`);
        const fuzzyResult = fuzzyMatchProduct(
          normalizedName,
          brandProducts as Array<{ id: string; name: string; normalized_name: string; brand: string | null }>,
          product.brand
        );
        if (fuzzyResult) {
          const matched = brandProducts[fuzzyResult.index];
          console.log(`${logPrefix} Excluded brand fuzzy match: "${product.name}" → "${matched.name}" (score: ${fuzzyResult.score.toFixed(3)}, ${fuzzyResult.matchReason})`);
          const { data: fullProduct } = await supabase
            .from(productsTable)
            .select("*")
            .eq("id", matched.id)
            .single();
          if (fullProduct) existing = fullProduct;
        }
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

    // カメラ固有フィールド（subcategory, lens_tags, body_tags）
    if (config.search.hasSubcategory && product.subcategory !== undefined && product.subcategory !== existing.subcategory) {
      updateData.subcategory = product.subcategory;
    }
    if (config.search.hasLensTags && product.lens_tags && product.lens_tags.length > 0) {
      updateData.lens_tags = product.lens_tags;
    }
    if (config.search.hasBodyTags && product.body_tags && product.body_tags.length > 0) {
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
      console.log(`${logPrefix} Updating existing "${existing.name}":`, Object.keys(updateData));
      const { data: updated, error } = await supabase
        .from(productsTable)
        .update(updateData)
        .eq("id", existing.id as string)
        .select()
        .single();
      if (!error && updated) existing = updated;
    }

    // 既存の商品に新しいソースからの言及を追加
    await saveMention(domain, {
      product_id: existing!.id as string,
      video_id: product.video_id,
      article_id: product.article_id,
      source_type: product.source_type,
      reason: product.reason,
      confidence: product.confidence,
    });
    return { product: existing! as unknown as Product, isExisting: true };
  }

  // 新規商品を保存（正規化名とslugも一緒に保存）
  // slug重複時はサフィックスを付けてリトライ（最大5回）
  const baseSlug = generateProductSlug({
    name: product.name,
    brand: product.brand,
    asin: product.asin,
  });

  let slug = baseSlug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      slug = addSuffixToSlug(baseSlug, attempt + 1);
      console.log(`${logPrefix} Slug collision, retrying with: "${slug}" (attempt ${attempt + 1})`);
    }

    const productWithNormalized = {
      ...product,
      normalized_name: normalizedName,
      slug,
    };

    const result = await supabase
      .from(productsTable)
      .insert([productWithNormalized])
      .select()
      .single();

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    // slug重複エラー（unique constraint violation）の場合はリトライ
    if (result.error.code === "23505" && result.error.message?.includes("slug")) {
      lastError = result.error;
      continue;
    }

    // その他のエラーは即座に返す
    console.error(`${logPrefix} Error saving product:`, result.error);
    return { product: null, isExisting: false };
  }

  if (!data) {
    console.error(`${logPrefix} Failed to save product after slug retries:`, lastError);
    return { product: null, isExisting: false };
  }

  // 言及も保存
  await saveMention(domain, {
    product_id: data.id,
    video_id: product.video_id,
    article_id: product.article_id,
    source_type: product.source_type,
    reason: product.reason,
    confidence: product.confidence,
  });

  console.log(`${logPrefix} Created new product: "${data.name}" (normalized: "${normalizedName}", slug: "${slug}")`);
  return { product: data as Product, isExisting: false };
}

// ========== 言及保存 ==========

/** 言及を保存（UPSERTで重複防止、フォールバック付き） */
export async function saveMention(domain: DomainId, mention: Omit<ProductMention, "id">): Promise<ProductMention | null> {
  const config = getDomainConfig(domain);
  const mentionsTable = config.tables.product_mentions;

  try {
    const { data, error } = await supabase
      .from(mentionsTable)
      .upsert([mention], {
        onConflict: mention.video_id ? "product_id,video_id" : "product_id,article_id",
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (error) {
      // 一意制約がない場合は従来方式にフォールバック
      if (error.code === "42P10" || error.message?.includes("constraint")) {
        return await saveMentionLegacy(domain, mention);
      }
      console.error(`[saveMention][${domain}] Error saving mention:`, error);
      return null;
    }

    return data as ProductMention;
  } catch {
    // エラー時は従来方式にフォールバック
    return await saveMentionLegacy(domain, mention);
  }
}

/** 従来のSELECT+INSERT方式（フォールバック用） */
async function saveMentionLegacy(domain: DomainId, mention: Omit<ProductMention, "id">): Promise<ProductMention | null> {
  const config = getDomainConfig(domain);
  const mentionsTable = config.tables.product_mentions;

  let query = supabase
    .from(mentionsTable)
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
    .from(mentionsTable)
    .insert([mention])
    .select()
    .single();

  if (error) {
    console.error(`[saveMentionLegacy][${domain}] Error saving mention:`, error);
    return null;
  }

  return data as ProductMention;
}

// ========== Amazon/楽天情報更新 ==========

/** 商品をAmazon/楽天情報で更新（skipIfHasAsin: trueの場合は既にASINがあればスキップ） */
export async function updateProductWithAmazon(
  domain: DomainId,
  productId: string,
  productInfo: {
    asin: string;
    amazon_url: string;
    amazon_image_url: string;
    amazon_price?: number;
    amazon_title: string;
    product_source?: "amazon" | "rakuten";
    rakuten_shop_name?: string;
    amazon_manufacturer?: string;
    amazon_brand?: string;
    amazon_model_number?: string;
    amazon_color?: string;
    amazon_size?: string;
    amazon_weight?: string;
    amazon_release_date?: string;
    amazon_features?: string[];
    amazon_features_raw?: string[];
    amazon_technical_info?: Record<string, string>;
    amazon_categories?: string[];
    amazon_product_group?: string;
  },
  priceRange?: string,
  skipIfHasAsin: boolean = false
): Promise<boolean> {
  const config = getDomainConfig(domain);
  const productsTable = config.tables.products;
  const mentionsTable = config.tables.product_mentions;
  const logPrefix = `[updateProductWithAmazon][${domain}]`;

  // 【最適化】既にASINがある場合はスキップ（オプション）
  if (skipIfHasAsin) {
    const { data: existing } = await supabase
      .from(productsTable)
      .select("asin")
      .eq("id", productId)
      .single();

    if (existing?.asin) {
      console.log(`${logPrefix} Skipping ${productId} - already has ASIN: ${existing.asin}`);
      return true;
    }
  }

  // 【重複検知】同じASINを持つ別の商品が既に存在するかチェック
  if (productInfo.asin) {
    const { data: duplicateProduct } = await supabase
      .from(productsTable)
      .select("id, name")
      .eq("asin", productInfo.asin)
      .neq("id", productId)
      .maybeSingle();

    if (duplicateProduct) {
      console.log(`${logPrefix} ASIN重複検出: "${productInfo.asin}" は既に "${duplicateProduct.name}" (${duplicateProduct.id}) に割り当て済み`);
      // 重複商品のmentionsを既存商品に移行して、新規商品を削除
      const { error: migrateError } = await supabase
        .from(mentionsTable)
        .update({ product_id: duplicateProduct.id })
        .eq("product_id", productId);

      if (!migrateError) {
        await supabase.from(productsTable).delete().eq("id", productId);
        console.log(`${logPrefix} Mentions migrated to ${duplicateProduct.id}, duplicate ${productId} deleted`);
      }
      return true;
    }
  }

  // Amazon情報からタグを抽出（種類タグ + 特徴タグ を統合）
  let extractedTags: string[] | undefined;

  const { data: product } = await supabase
    .from(productsTable)
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
    console.log(`${logPrefix} Extracted tags for ${productId}:`, extractedTags);
  }

  const { error } = await supabase
    .from(productsTable)
    .update(updateData)
    .eq("id", productId);

  if (error) {
    console.error(`${logPrefix} Error updating product with Amazon/Rakuten info:`, error);
    return false;
  }

  return true;
}

// ========== Amazon補強タグ更新（camera固有だが統合APIとして提供） ==========

/** Amazon情報から補強されたタグを更新 */
export async function updateProductEnrichedTags(
  domain: DomainId,
  productId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const config = getDomainConfig(domain);
  const logPrefix = `[updateProductEnrichedTags][${domain}]`;

  const { error } = await supabase
    .from(config.tables.products)
    .update(updates)
    .eq("id", productId);

  if (error) {
    console.error(`${logPrefix} Error:`, error);
    return false;
  }

  console.log(`${logPrefix} Updated ${productId}:`, updates);
  return true;
}

// ========== インフルエンサー保存 ==========

/** インフルエンサーを保存または更新（YouTube / 記事著者） */
export async function saveInfluencer(
  domain: DomainId,
  influencer: Omit<Influencer, "id" | "created_at" | "updated_at">
): Promise<Influencer | null> {
  const config = getDomainConfig(domain);
  const influencersTable = config.tables.influencers;
  const logPrefix = `[saveInfluencer][${domain}]`;

  console.log(`${logPrefix} Called with:`, JSON.stringify({
    channel_id: influencer.channel_id,
    channel_title: influencer.channel_title,
    source_type: influencer.source_type,
    occupation: influencer.occupation,
    occupation_tags: influencer.occupation_tags,
  }, null, 2));

  if (influencer.source_type === "youtube" && influencer.channel_id) {
    // 既存チェック
    const { data: existing, error: existingError } = await supabase
      .from(influencersTable)
      .select("*")
      .eq("channel_id", influencer.channel_id)
      .single();

    console.log(`${logPrefix} Existing check:`, {
      found: !!existing,
      error: existingError?.code,
      existing_id: existing?.id,
      existing_tags: existing?.occupation_tags,
    });

    if (existing) {
      // 更新データを準備
      const updateData: Record<string, unknown> = {
        subscriber_count: influencer.subscriber_count,
        video_count: ((existing.video_count as number) || 0) + 1,
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

      console.log(`${logPrefix} Updating existing influencer with:`, JSON.stringify(updateData, null, 2));

      const { data, error } = await supabase
        .from(influencersTable)
        .update(updateData)
        .eq("channel_id", influencer.channel_id)
        .select()
        .single();

      if (error) {
        console.error(`${logPrefix} Error updating influencer:`, error);
        return existing as Influencer;
      }
      console.log(`${logPrefix} Update SUCCESS:`, { id: data.id, occupation_tags: data.occupation_tags });
      return data as Influencer;
    }

    // 新規作成
    const insertData = { ...influencer, video_count: 1 };
    console.log(`${logPrefix} Inserting new influencer:`, JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from(influencersTable)
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error(`${logPrefix} Error saving influencer:`, error);
      return null;
    }

    console.log(`${logPrefix} Insert SUCCESS:`, { id: data.id, occupation_tags: data.occupation_tags });
    return data as Influencer;
  }

  // 記事著者の場合
  if (influencer.source_type === "article" && influencer.author_id) {
    const { data: existing } = await supabase
      .from(influencersTable)
      .select("*")
      .eq("author_id", influencer.author_id)
      .single();

    if (existing) {
      const updateData: Record<string, unknown> = {
        article_count: ((existing.article_count as number) || 0) + 1,
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
        .from(influencersTable)
        .update(updateData)
        .eq("author_id", influencer.author_id)
        .select()
        .single();

      if (error) {
        console.error(`${logPrefix} Error updating article author:`, error);
        return existing as Influencer;
      }
      return data as Influencer;
    }

    // 新規作成
    const { data, error } = await supabase
      .from(influencersTable)
      .insert([{ ...influencer, article_count: 1 }])
      .select()
      .single();

    if (error) {
      console.error(`${logPrefix} Error saving article author:`, error);
      return null;
    }

    return data as Influencer;
  }

  return null;
}

// ========== 再編集用の更新関数 ==========

/** 動画/記事のメタデータ更新（summary, tags） */
export async function updateSourceMetadata(
  domain: DomainId,
  sourceType: "video" | "article",
  sourceId: string,
  data: { summary: string; tags: string[] }
): Promise<boolean> {
  const config = getDomainConfig(domain);

  if (sourceType === "video") {
    const { error } = await supabase
      .from(config.tables.videos)
      .update({ summary: data.summary, tags: data.tags })
      .eq("video_id", sourceId);
    if (error) {
      console.error(`[updateSourceMetadata][${domain}] Error updating video metadata:`, error);
      return false;
    }
    return true;
  } else {
    const { error } = await supabase
      .from(config.tables.articles)
      .update({ summary: data.summary, tags: data.tags })
      .eq("url", sourceId);
    if (error) {
      console.error(`[updateSourceMetadata][${domain}] Error updating article metadata:`, error);
      return false;
    }
    return true;
  }
}

/** インフルエンサーの職業タグ更新 */
export async function updateInfluencerOccupationTags(
  domain: DomainId,
  sourceType: "video" | "article",
  sourceId: string,
  occupationTags: string[]
): Promise<boolean> {
  const config = getDomainConfig(domain);
  const logPrefix = `[updateInfluencerOccupationTags][${domain}]`;

  if (sourceType === "video") {
    const { data: video } = await supabase
      .from(config.tables.videos)
      .select("channel_id")
      .eq("video_id", sourceId)
      .single();
    if (!video?.channel_id) return false;

    const { error } = await supabase
      .from(config.tables.influencers)
      .update({ occupation_tags: occupationTags })
      .eq("channel_id", video.channel_id);
    if (error) {
      console.error(`${logPrefix} Error updating influencer occupation_tags:`, error);
      return false;
    }
    return true;
  } else {
    // 記事の場合: author_idのドメインマッチでインフルエンサーを特定
    const { data: influencers } = await supabase
      .from(config.tables.influencers)
      .select("id, author_id")
      .not("author_id", "is", null);

    const match = influencers?.find((inf: { id: string; author_id: string | null }) => {
      if (!inf.author_id) return false;
      const authorDomain = inf.author_id.split(":")[0];
      return authorDomain && sourceId.includes(authorDomain);
    });
    if (!match) return false;

    const { error } = await supabase
      .from(config.tables.influencers)
      .update({ occupation_tags: occupationTags })
      .eq("id", match.id);
    if (error) {
      console.error(`${logPrefix} Error updating article author occupation_tags:`, error);
      return false;
    }
    return true;
  }
}

/** 商品のコメント文（reason）更新 */
export async function updateMentionReason(
  domain: DomainId,
  productId: string,
  sourceType: "video" | "article",
  sourceId: string,
  reason: string
): Promise<boolean> {
  const config = getDomainConfig(domain);
  const column = sourceType === "video" ? "video_id" : "article_id";
  const { error } = await supabase
    .from(config.tables.product_mentions)
    .update({ reason })
    .eq("product_id", productId)
    .eq(column, sourceId);
  if (error) {
    console.error(`[updateMentionReason][${domain}] Error updating mention reason:`, error);
    return false;
  }
  return true;
}

/** ソース（動画/記事）を削除。関連するproduct_mentionsも削除し、mentionが0になった商品も削除する */
export async function deleteSource(
  domain: DomainId,
  sourceType: "video" | "article",
  sourceId: string
): Promise<{ success: boolean; error?: string }> {
  const config = getDomainConfig(domain);
  const logPrefix = `[deleteSource][${domain}]`;

  try {
    const mentionColumn = sourceType === "video" ? "video_id" : "article_id";

    // 1. 関連するproduct_mentionsを取得（orphan商品チェック用）
    const { data: mentions } = await supabase
      .from(config.tables.product_mentions)
      .select("product_id")
      .eq(mentionColumn, sourceId);

    const affectedProductIds = [...new Set((mentions || []).map((m: { product_id: string }) => m.product_id))];

    // 2. product_mentionsを削除
    const { error: mentionError } = await supabase
      .from(config.tables.product_mentions)
      .delete()
      .eq(mentionColumn, sourceId);

    if (mentionError) {
      console.error(`${logPrefix} Error deleting product_mentions:`, mentionError);
      return { success: false, error: "product_mentionsの削除に失敗" };
    }

    // 3. ソース本体を削除
    if (sourceType === "video") {
      const { error } = await supabase.from(config.tables.videos).delete().eq("video_id", sourceId);
      if (error) {
        console.error(`${logPrefix} Error deleting video:`, error);
        return { success: false, error: "動画の削除に失敗" };
      }
    } else {
      const { error } = await supabase.from(config.tables.articles).delete().eq("url", sourceId);
      if (error) {
        console.error(`${logPrefix} Error deleting article:`, error);
        return { success: false, error: "記事の削除に失敗" };
      }
    }

    // 4. orphanになった商品（mentionが0件）を削除
    let orphanDeleted = 0;
    for (const productId of affectedProductIds) {
      const { count } = await supabase
        .from(config.tables.product_mentions)
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);

      if (count === 0) {
        await supabase.from(config.tables.products).delete().eq("id", productId);
        orphanDeleted++;
      }
    }

    console.log(`${logPrefix} Deleted ${sourceType} ${sourceId}, ${mentions?.length || 0} mentions removed, ${orphanDeleted} orphan products cleaned up`);
    return { success: true };
  } catch (error) {
    console.error(`${logPrefix} Error in deleteSource:`, error);
    return { success: false, error: "削除中にエラーが発生しました" };
  }
}

/**
 * 特定ソースからの言及を1件削除し、孤児商品があれば削除する。
 * Admin編集画面で商品をソースから除外する際に使用。
 */
export async function deleteMentionAndCleanupOrphan(
  domain: DomainId,
  productId: string,
  sourceType: "video" | "article",
  sourceId: string
): Promise<{ success: boolean; orphanDeleted: boolean; error?: string }> {
  const config = getDomainConfig(domain);
  const logPrefix = `[deleteMentionAndCleanupOrphan][${domain}]`;

  try {
    // 1. 該当の product_mention レコードを削除
    const mentionColumn = sourceType === "video" ? "video_id" : "article_id";
    const { error: deleteError } = await supabase
      .from(config.tables.product_mentions)
      .delete()
      .eq("product_id", productId)
      .eq(mentionColumn, sourceId);

    if (deleteError) {
      console.error(`${logPrefix} Error deleting mention:`, deleteError);
      return { success: false, orphanDeleted: false, error: "言及の削除に失敗" };
    }

    // 2. 残りのmention数をチェック → 0件なら商品自体も削除
    const { count } = await supabase
      .from(config.tables.product_mentions)
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    let orphanDeleted = false;
    if (count === 0) {
      const { error: productDeleteError } = await supabase
        .from(config.tables.products)
        .delete()
        .eq("id", productId);

      if (productDeleteError) {
        console.error(`${logPrefix} Error deleting orphan product:`, productDeleteError);
      } else {
        orphanDeleted = true;
      }
    }

    console.log(`${logPrefix} Deleted mention for product ${productId} from ${sourceType}:${sourceId}, orphanDeleted=${orphanDeleted}`);
    return { success: true, orphanDeleted };
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return { success: false, orphanDeleted: false, error: "削除中にエラーが発生しました" };
  }
}

/** 商品メタデータ更新（name, brand, category, tags） */
export async function updateProductMetadata(
  domain: DomainId,
  productId: string,
  data: {
    name?: string; brand?: string; category?: string; tags?: string[];
    asin?: string; amazon_url?: string; amazon_image_url?: string;
    amazon_price?: number; product_source?: string;
  }
): Promise<boolean> {
  const config = getDomainConfig(domain);

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = data.tags;
  // 空文字列でasin/url/imageを上書きしない（既存データ保護）
  if (data.asin) updateData.asin = data.asin;
  if (data.amazon_url) updateData.amazon_url = data.amazon_url;
  if (data.amazon_image_url) updateData.amazon_image_url = data.amazon_image_url;
  if (data.amazon_price !== undefined) updateData.amazon_price = data.amazon_price;
  if (data.product_source) updateData.product_source = data.product_source;

  if (Object.keys(updateData).length === 0) return true;

  const { error } = await supabase
    .from(config.tables.products)
    .update(updateData)
    .eq("id", productId);
  if (error) {
    console.error(`[updateProductMetadata][${domain}] Error updating product metadata:`, error);
    return false;
  }
  return true;
}
