import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { searchCameraProducts, getCameraSiteStats, getCameraSubcategories, getCameraProductDetailBySlug, getCameraCoOccurrenceProducts, getCameraSimilarProducts } from "@/lib/supabase/queries-camera";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_ALL_LENS_TAGS,
  CAMERA_ALL_BODY_TAGS,
  slugToCameraCategory,
  cameraCategoryToSlug,
  cameraSubcategoryToSlug,
  cameraBrandToSlug,
  cameraProductUrl,
  CAMERA_OCCUPATION_TAGS,
} from "@/lib/camera/constants";
import { getProductLinks } from "@/lib/affiliateLinks";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { ProductReviews } from "@/components/product/ProductReviews";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData, generateProductStructuredData, generateFAQStructuredData, generateItemListStructuredData } from "@/lib/structuredData";
import { getCameraCategoryIcon } from "@/lib/camera/category-icons";
import { formatProductForDisplay, convertSize, convertWeight, formatReleaseDate, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import { generateSubcategoryAnalysis } from "@/lib/subcategory-analysis";
import "../../detail-styles.css";
import "../../listing-styles.css";
import "../../product-detail-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: {
    lens?: string;
    body?: string;
    sort?: string;
    page?: string;
  };
}

// ============================================================
// ユーティリティ
// ============================================================

function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCameraCategory(slug);
  return category && (CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category) ? category : null;
}


const getCachedProductDetail = cache(async (slug: string) => {
  return getCameraProductDetailBySlug(slug);
});

// ============================================================
// generateMetadata — カテゴリ or 商品詳細
// ============================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getCategoryFromSlug(params.slug);
  if (category) {
    const { products: topProducts, total } = await searchCameraProducts({ category, sortBy: "mention_count", limit: 1 });
    const topName = topProducts.length > 0 ? topProducts[0].name : null;

    const title = `撮影機材紹介で人気の${category}まとめ`;
    const description = topName
      ? `${total}件のYouTube機材紹介・カバンの中身動画を分析。最も愛用されている${category}は${topName}。セットアップで人気の${category}を登場回数順にまとめています。`
      : `YouTube機材紹介やカバンの中身動画で実際に愛用されている${category}を登場回数順にまとめ。口コミ付き。【${total}件掲載】`;
    const canonical = `/camera/${params.slug}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, type: "website" },
      twitter: { card: "summary", title, description },
    };
  }

  const product = await getCachedProductDetail(params.slug);
  if (!product) {
    return { title: "ページが見つかりません | Creator Clip" };
  }

  const commentsCount = product.all_comments?.length || 0;
  const shouldNoIndex = commentsCount < 3;
  const canonicalUrl = `/camera/${params.slug}`;

  const title = `${product.brand ? product.brand + " " : ""}${product.name}の評判・ユーザーの口コミを紹介`;
  const description = `${product.mention_count}件のYouTube機材紹介に登場した${product.name}の口コミ${commentsCount}件。愛用者のセットアップや使用環境の傾向を掲載。`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      ...(product.amazon_image_url ? {
        images: [{ url: product.amazon_image_url, width: 500, height: 500, alt: product.name }],
      } : {}),
    },
    twitter: {
      card: product.amazon_image_url ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

// ============================================================
// カテゴリ一覧ページ（サブカテゴリありの場合セクション表示）
// ============================================================

async function CategoryListPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug)!;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  // DBからサブカテゴリー一覧を取得
  const subcategories = await getCameraSubcategories(category);

  // 撮影機材紹介動画・記事の件数を取得
  const stats = await getCameraSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" },
    { name: "撮影機材", url: "/camera" },
    { name: category },
  ]);

  // ===== サブカテゴリーが存在する場合：セクション表示 =====
  if (subcategories.length > 0) {
    const subcategoryProducts = await Promise.all(
      subcategories.map(async (sub) => {
        const { products, total } = await searchCameraProducts({
          category,
          typeTag: sub,
          sortBy: "mention_count",
          limit: 5,
        });

        return {
          subcategory: sub,
          products: products.map(formatProductForDisplay),
          rawProducts: products, // 分析用に生データも保持
          total,
        };
      })
    );

    const filteredSubs = subcategoryProducts.filter((s) => s.products.length > 0);
    const { total: totalInCategory } = await searchCameraProducts({ category, limit: 1 });

    // 動的FAQ：各サブカテゴリの1位を集約
    const topBySubcat = filteredSubs
      .filter(s => s.products[0])
      .slice(0, 3)
      .map((s, i) => `${i + 1}位: ${s.products[0].brand ? s.products[0].brand + " " : ""}${s.products[0].name}（${s.products[0].mention_count}件の撮影機材紹介に登場）`);
    const rankingAnswer = topBySubcat.length > 0
      ? topBySubcat.join("、") + "。実際のクリエイターが愛用している機材を登場回数順にランキングしています。"
      : "まだデータがありません。";

    const allFaqItems = [
      { question: `${category}ではどんな商品が人気ですか？`, answer: rankingAnswer },
      ...COMMON_FAQ_ITEMS,
    ];
    const faqData = generateFAQStructuredData(allFaqItems);

    // ItemList構造化データ：サブカテゴリの人気商品
    const allSubProducts = filteredSubs.flatMap(s => s.products);
    const itemListData = generateItemListStructuredData(
      allSubProducts.slice(0, 20).map((p, i) => ({
        name: p.name,
        url: cameraProductUrl(p),
        image_url: p.image_url,
        position: i + 1,
      }))
    );

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
        />
        <PageHeaderSection
          domain="camera"
          label="Database Report"
          title={`撮影機材紹介で人気の${category}まとめ`}
          description={
            <>
              {totalInCategory}件の
              <Link href="/camera/sources" className="link">
                撮影機材紹介
              </Link>
              でクリエイターが愛用している{category}をセットアップ事例とあわせて紹介。
            </>
          }
          breadcrumbCurrent={category}
          breadcrumbMiddle={{ label: "カテゴリ", href: "/camera/category" }}
          icon={getCameraCategoryIcon(category)}
        />

        <div className="detail-container" style={{ paddingTop: "48px" }}>
          {filteredSubs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
              <p style={{ fontSize: "15px" }}>このカテゴリーにはまだ商品が登録されていません。</p>
            </div>
          ) : (
            filteredSubs.map(({ subcategory, products, rawProducts, total }) => (
              <div key={subcategory} style={{ marginBottom: "60px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{subcategory}</h2>
                  {total > 3 && (
                    <Link
                      href={`/camera/${params.slug}/${cameraSubcategoryToSlug(subcategory)}`}
                      style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                    </Link>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "#6e7a8a", marginBottom: "16px", lineHeight: "1.6" }}>
                  {subcategory}の人気ランキング（全{total}件）。{products[0] && `1位は${products[0].name}（${products[0].mention_count}件の撮影機材紹介に登場）。`}{generateSubcategoryAnalysis({ subcategory, products: rawProducts, total })}詳細ページではクリエイターのコメントや引用元の動画・記事がわかります。
                </p>
                <ProductGrid products={products.slice(0, 3)} domain="camera" />
              </div>
            ))
          )}

          <FAQSection items={allFaqItems} />
        </div>
      </>
    );
  }

  // ===== サブカテゴリーなし：フラット表示 =====
  const lensTagFilter = searchParams.lens;
  const bodyTagFilter = searchParams.body;

  const lensTags = category === "レンズ" ? CAMERA_ALL_LENS_TAGS : [];
  const bodyTags = category === "カメラ" ? CAMERA_ALL_BODY_TAGS : [];

  const { products, total } = await searchCameraProducts({
    category,
    lensTag: lensTagFilter,
    bodyTag: bodyTagFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  const formattedProducts = products.map(formatProductForDisplay);
  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  const topProductName = sort === "mention" && page === 1 && products.length > 0 ? products[0].name : null;

  // 動的FAQ：人気商品ランキング（上位3件）
  const top3 = products.slice(0, 3);
  const rankingAnswer = top3.length > 0
    ? top3.map((p, i) => `${i + 1}位: ${p.brand ? p.brand + " " : ""}${p.name}（${p.mention_count}件の撮影機材紹介に登場）`).join("、") + "。実際のクリエイターが愛用している機材を登場回数順にランキングしています。"
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${category}ではどんな商品が人気ですか？`, answer: rankingAnswer },
    ...COMMON_FAQ_ITEMS,
  ];
  const faqData = generateFAQStructuredData(allFaqItems);

  // ItemList構造化データ
  const itemListData = generateItemListStructuredData(
    formattedProducts.slice(0, 20).map((p, i) => ({
      name: p.name,
      url: cameraProductUrl(p),
      image_url: p.image_url,
      position: i + 1,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
      <PageHeaderSection
        domain="camera"
        label="Database Report"
        title={`撮影機材紹介で人気の${category}まとめ`}
        description={
          <>
            {total}件の
            <Link href="/camera/sources" className="link">撮影機材紹介</Link>
            でクリエイターが愛用している{category}を口コミ・セットアップ事例つきで紹介。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: "カテゴリ", href: "/camera/category" }}
        icon={getCameraCategoryIcon(category)}
      />

      <div className="detail-container">
        {lensTags.length > 0 && (
          <FilterSection
            label="レンズスペックで絞り込み"
            filterKey="lens"
            tags={lensTags}
            currentFilter={lensTagFilter}
          />
        )}
        {bodyTags.length > 0 && (
          <FilterSection
            label="センサーサイズで絞り込み"
            filterKey="body"
            tags={bodyTags}
            currentFilter={bodyTagFilter}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} domain="camera" />

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}

// ============================================================
// 商品詳細ページ
// ============================================================

async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = (await getCachedProductDetail(params.slug))!;

  const correctCatSlug = cameraCategoryToSlug(product.category);

  const [coUsedProducts, similarProducts, stats] = await Promise.all([
    getCameraCoOccurrenceProducts(product.id, 4),
    getCameraSimilarProducts({
      id: product.id,
      category: product.category,
      subcategory: product.subcategory,
      tags: product.tags,
      lens_tags: product.lens_tags,
      body_tags: product.body_tags,
      brand: product.brand,
      price_range: product.price_range,
    }, 4),
    getCameraSiteStats(),
  ]);

  const totalOccupation = product.occupation_breakdown?.reduce((sum, s) => sum + s.count, 0) || 1;

  const hasProductInfo = product.amazon_model_number ||
    product.amazon_manufacturer ||
    product.brand ||
    product.amazon_brand ||
    product.amazon_color ||
    product.amazon_size ||
    product.amazon_weight ||
    product.amazon_release_date ||
    product.asin ||
    product.category ||
    product.subcategory ||
    (product.lens_tags && product.lens_tags.length > 0) ||
    (product.body_tags && product.body_tags.length > 0);

  const hasFeatures = product.amazon_features && product.amazon_features.length > 0 && !isLowQualityFeatures(product.amazon_features);

  const hasChosenReasons = product.chosen_reasons && product.chosen_reasons.length > 0;
  const hasEnvironmentStats = (product.occupation_breakdown && product.occupation_breakdown.length > 0) ||
    hasChosenReasons;
  const hasComments = product.all_comments && product.all_comments.length > 0;
  const hasCoUsedProducts = coUsedProducts.length > 0;
  const hasSimilarProducts = similarProducts.length > 0;

  const { amazonUrl, rakutenUrl } = getProductLinks({
    amazon_url: product.amazon_url,
    amazon_model_number: product.amazon_model_number,
    name: product.name,
  });

  // 公式サイトURLかどうか判定（Amazon/楽天以外のURL）
  const isOfficialSite = product.amazon_url
    && !product.amazon_url.includes("amazon.co.jp")
    && !product.amazon_url.includes("amazon.com")
    && !product.amazon_url.includes("rakuten.co.jp");

  const lastUpdated = product.updated_at || new Date().toISOString();

  const breadcrumbItems = [
    { name: "トップ", url: "/" },
    { name: "撮影機材", url: "/camera" },
    { name: product.category, url: `/camera/${correctCatSlug}` },
    ...(product.subcategory
      ? [{ name: product.subcategory, url: `/camera/${correctCatSlug}/${cameraSubcategoryToSlug(product.subcategory)}` }]
      : []),
    { name: product.name },
  ];
  const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbItems);

  const productData = generateProductStructuredData({
    name: product.name,
    brand: product.brand,
    image_url: product.amazon_image_url,
    description: product.all_comments?.[0]?.comment || `${product.name}の使用例・口コミ情報`,
    amazon_url: product.amazon_url,
    price: product.amazon_price,
    mention_count: product.mention_count,
    category: product.category,
  });

  let sectionNum = 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }}
      />

      <div className="product-page-header">
        <div className="product-detail-container">
          <div className="breadcrumb">
            <Link href="/">トップ</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href="/camera">撮影機材</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href={`/camera/${correctCatSlug}`}>{product.category}</Link>
            {product.subcategory && (
              <>
                <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
                <Link href={`/camera/${correctCatSlug}/${cameraSubcategoryToSlug(product.subcategory)}`}>{product.subcategory}</Link>
              </>
            )}
          </div>

          <div className="product-hero">
            <a href={isOfficialSite ? product.amazon_url! : amazonUrl} target="_blank" rel={isOfficialSite ? "noopener noreferrer" : "noopener noreferrer sponsored"} className="product-image">
              {product.amazon_image_url ? (
                <img src={product.amazon_image_url} alt={product.name} width={400} height={400} />
              ) : (
                <i className={`fa-solid ${getCameraCategoryIcon(product.category)} img-placeholder`}></i>
              )}
            </a>
            <div className="product-info">
              <h1 className="page-subtitle">
                {product.brand && `${product.brand} `}{product.name}の評判・ユーザーの口コミを紹介
              </h1>
              <p className="page-title">{product.brand && `${product.brand} `}{product.name}</p>

              <div className="product-stats">
                <div className="pstat">
                  <div className="pstat-label">
                    <Link href={`/camera/${correctCatSlug}`} className="pstat-sub">
                      {product.category}カテゴリ
                    </Link>
                  </div>
                  <div className="pstat-value">{product.category_rank || "-"}位</div>
                </div>
                <div className="pstat">
                  <div className="pstat-label">使用人数</div>
                  <div className="pstat-value">{product.mention_count}<span className="suffix">人</span></div>
                </div>
                <div className="pstat">
                  <div className="pstat-label">参考価格</div>
                  <div className="pstat-value">
                    {product.amazon_price ? `¥${product.amazon_price.toLocaleString()}` : "-"}
                  </div>
                  {product.updated_at && (
                    <div className="pstat-suffix">
                      {new Date(product.updated_at).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).replace(/\//g, ".")}取得
                    </div>
                  )}
                </div>
                <div className="pstat">
                  <div className="pstat-label">最終更新日</div>
                  <div className="pstat-value">
                    {new Date(lastUpdated).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit"
                    }).replace(/\//g, ".")}
                  </div>
                  <div className="pstat-suffix">
                    最新コメント追加日
                  </div>
                </div>
              </div>

              <div className="product-actions">
                {isOfficialSite ? (
                  <a href={product.amazon_url!} target="_blank" rel="noopener noreferrer" className="action-btn">
                    <i className="fa-solid fa-globe" style={{ marginRight: 6 }}></i>
                    公式サイトで見る
                  </a>
                ) : (
                  <>
                    <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                      <span className="icon-amazon">A</span>
                      Amazonで見る
                    </a>
                    <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                      <span className="icon-rakuten">R</span>
                      楽天で見る
                    </a>
                  </>
                )}
              </div>
              <span className="pr-note">（本ページにはPRを含みます）</span>
            </div>
          </div>
        </div>
      </div>

      <div className="product-detail-container">
        {hasComments && (
          <ProductReviews
            comments={product.all_comments!}
            productName={`${product.brand ? `${product.brand} ` : ""}${product.name}`}
            productId={product.id}
            sectionNumber={++sectionNum}
            domain="camera"
            mentionCount={product.mention_count}
          />
        )}

        {hasEnvironmentStats && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}が登場している撮影環境の傾向</h2>
            </div>
            <p className="section-summary">{product.brand && `${product.brand} `}{product.name}を使用している{product.occupation_breakdown?.[0]?.occupation_tag || "クリエイター"}を中心に、選ばれた理由や使用環境の傾向をまとめています。</p>
            <div className="trend-card">
              <div className={`trend-grid${hasChosenReasons ? " trend-grid-3col" : ""}`}>
                {product.occupation_breakdown && product.occupation_breakdown.length > 0 && (
                  <div className="trend-col">
                    <div className="trend-col-title">職種分布 (Occupation)</div>
                    {product.occupation_breakdown.slice(0, 3).map((stat) => {
                      const percentage = Math.round((stat.count / totalOccupation) * 100);
                      return (
                        <div key={stat.occupation_tag} className="trend-item">
                          <span className="trend-item-name">{stat.occupation_tag}</span>
                          <span className="trend-bar-wrap">
                            <span className="trend-bar-fill" style={{ width: `${percentage}%` }}></span>
                          </span>
                          <span className="trend-item-pct">{percentage}%</span>
                        </div>
                      );
                    })}
                    <div className="trend-note">{totalOccupation}人が使用</div>
                  </div>
                )}

                {hasChosenReasons && (
                  <div className="trend-col">
                    <div className="trend-col-title">選ばれている理由 (Why Chosen)</div>
                    <div className="trend-reasons">
                      {product.chosen_reasons!.map((reason, i) => (
                        <div key={i} className="trend-reason-item">
                          <span className="trend-reason-icon">
                            {i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : "\u{1F949}"}
                          </span>
                          <span className="trend-reason-text">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasFeatures && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}の特徴</h2>
            </div>
            <p className="section-summary">Amazon商品ページに掲載されている{product.brand && `${product.brand} `}{product.name}の主な特徴です。</p>
            <div className="feature-card">
              <ul className="feature-list">
                {product.amazon_features!.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {hasCoUsedProducts && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}と一緒に使われている撮影機材</h2>
            </div>
            <p className="section-summary">{product.brand && `${product.brand} `}{product.name}と同じ撮影環境で使われている機材を、共起回数順に紹介します。</p>
            <div className="related-grid">
              {coUsedProducts.filter(p => p.slug).map((coProduct) => (
                <Link key={coProduct.id} href={cameraProductUrl(coProduct)} className="related-item">
                  <div className="related-item-img">
                    {coProduct.amazon_image_url ? (
                      <img src={coProduct.amazon_image_url} alt={coProduct.name} width={120} height={120} loading="lazy" />
                    ) : (
                      <i className={`fa-solid ${getCameraCategoryIcon(coProduct.category || "")}`}></i>
                    )}
                  </div>
                  <div className="related-item-info">
                    <div className="related-item-cat">{coProduct.category || "PERIPHERAL"}</div>
                    <div className="related-item-name">{coProduct.name}</div>
                    <div className="related-item-usage">{coProduct.co_occurrence_count}人が使用</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {hasSimilarProducts && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}と同じカテゴリーの人気商品</h2>
            </div>
            <p className="section-summary">同じ{product.category}カテゴリでタグやスペックが近い商品です。別ブランドの選択肢を探す際の参考にどうぞ。</p>
            <div className="related-grid">
              {similarProducts.filter(p => p.slug).map((simProduct) => (
                <Link key={simProduct.id} href={cameraProductUrl(simProduct)} className="related-item">
                  <div className="related-item-img">
                    {simProduct.amazon_image_url ? (
                      <img src={simProduct.amazon_image_url} alt={simProduct.name} width={120} height={120} loading="lazy" />
                    ) : (
                      <i className={`fa-solid ${getCameraCategoryIcon(simProduct.category || "")}`}></i>
                    )}
                  </div>
                  <div className="related-item-info">
                    <div className="related-item-cat">{simProduct.brand || simProduct.category}</div>
                    <div className="related-item-name">{simProduct.name}</div>
                    <div className="related-item-usage">{simProduct.mention_count}回登場</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {hasProductInfo && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}の基本情報</h2>
            </div>
            <p className="section-summary">{product.brand && `${product.brand} `}{product.name}のスペック・仕様情報です。</p>
            <div className="specs-card">
              <table className="specs-table">
                <tbody>
                  {product.amazon_model_number && (
                    <tr><th>型番</th><td>{product.amazon_model_number}</td></tr>
                  )}
                  {product.amazon_manufacturer && (
                    <tr><th>メーカー</th><td>{product.amazon_manufacturer}</td></tr>
                  )}
                  {(product.brand || product.amazon_brand) && (
                    <tr>
                      <th>ブランド</th>
                      <td>
                        {product.brand ? (
                          <Link href={`/camera/brand/${cameraBrandToSlug(product.brand)}`} className="specs-link">
                            {product.brand}
                          </Link>
                        ) : (
                          product.amazon_brand
                        )}
                      </td>
                    </tr>
                  )}
                  {product.amazon_color && (
                    <tr><th>カラー</th><td>{product.amazon_color}</td></tr>
                  )}
                  {product.amazon_size && (
                    <tr><th>サイズ</th><td>{convertSize(product.amazon_size)}</td></tr>
                  )}
                  {product.amazon_weight && (
                    <tr><th>重量</th><td>{convertWeight(product.amazon_weight)}</td></tr>
                  )}
                  {product.amazon_release_date && (
                    <tr><th>発売日</th><td>{formatReleaseDate(product.amazon_release_date)}</td></tr>
                  )}
                  {product.asin && (
                    <tr><th>ASIN</th><td>{product.asin}</td></tr>
                  )}
                  {product.category && (
                    <tr>
                      <th>カテゴリー</th>
                      <td>
                        <Link href={`/camera/${correctCatSlug}`} className="specs-link">
                          {product.category}
                        </Link>
                      </td>
                    </tr>
                  )}
                  {product.subcategory && (
                    <tr><th>サブカテゴリー</th><td>{product.subcategory}</td></tr>
                  )}
                  {product.tags && product.tags.length > 0 && (
                    <tr>
                      <th>特徴</th>
                      <td>
                        <div className="specs-features">
                          {product.tags.map((tag, idx) => (
                            <span key={idx} className="specs-feature-tag">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {product.lens_tags && product.lens_tags.length > 0 && (
                    <tr>
                      <th>レンズ情報</th>
                      <td>
                        <div className="specs-features">
                          {product.lens_tags.map((tag, idx) => (
                            <span key={idx} className="specs-feature-tag">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {product.body_tags && product.body_tags.length > 0 && (
                    <tr>
                      <th>ボディ情報</th>
                      <td>
                        <div className="specs-features">
                          {product.body_tags.map((tag, idx) => (
                            <span key={idx} className="specs-feature-tag">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="content-section product-reveal">
          <div className="section-title">
            <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
            <h2>関連コンテンツ</h2>
          </div>
          <div className="related-content-grid">
            <Link href="/camera/category" className="related-content-card">
              <div className="related-content-icon">
                <i className="fa-solid fa-th"></i>
              </div>
              <div className="related-content-info">
                <div className="related-content-title">撮影機材カテゴリ</div>
                <div className="related-content-desc">カメラ、レンズ、照明など、カテゴリー別に人気機材を探す</div>
              </div>
              <div className="related-content-arrow">
                <i className="fa-solid fa-arrow-right"></i>
              </div>
            </Link>

            <Link href="/camera/sources" className="related-content-card">
              <div className="related-content-icon">
                <i className="fa-solid fa-video"></i>
              </div>
              <div className="related-content-info">
                <div className="related-content-title">撮影機材紹介動画・記事データベース</div>
                <div className="related-content-desc">{(stats.total_videos + stats.total_articles).toLocaleString()}本の撮影機材紹介を掲載。職業別に好みの機材セットアップが見つかります</div>
              </div>
              <div className="related-content-arrow">
                <i className="fa-solid fa-arrow-right"></i>
              </div>
            </Link>
          </div>
        </div>

        <div className="purchase-section product-reveal">
          <div className="purchase-card">
            <div className="purchase-title">{isOfficialSite ? "公式サイト" : "販売・在庫状況"}</div>
            <div className="purchase-buttons">
              {isOfficialSite ? (
                <a href={product.amazon_url!} target="_blank" rel="noopener noreferrer" className="purchase-btn amazon">
                  <i className="fa-solid fa-globe" style={{ marginRight: 8 }}></i>
                  公式サイトで詳細を見る
                </a>
              ) : (
                <>
                  <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn amazon">
                    <span className="icon-dot am">A</span>
                    Amazonで現在の価格を見る
                  </a>
                  <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn rakuten">
                    <span className="icon-dot rk">R</span>
                    楽天で在庫を確認する
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// デフォルトエクスポート — slug に応じてカテゴリ or 商品詳細を出し分け
// ============================================================

export default async function SlugPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug);
  if (category) {
    return <CategoryListPage params={params} searchParams={searchParams} />;
  }

  const product = await getCachedProductDetail(params.slug);
  if (product) {
    return <ProductDetailPage params={params} />;
  }

  notFound();
}
