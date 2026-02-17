import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { getProductDetailBySlug, getCoOccurrenceProducts, getSimilarProducts, getBrandPopularProducts, getSiteStats } from "@/lib/supabase";
import {
  PRODUCT_CATEGORIES,
  TYPE_TAGS,
  slugToCategory,
  categoryToSlug,
  desktourSubcategoryToSlug,
  brandToSlug,
  STYLE_TAGS,
  productUrl,
} from "@/lib/constants";
import { getBrandSlugMap } from "@/lib/supabase/queries-brands";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { ProductReviews } from "@/components/product/ProductReviews";
import { generateBreadcrumbStructuredData, generateProductStructuredData } from "@/lib/structuredData";
import { getCategoryIcon } from "@/lib/category-icons";
import { convertSize, convertWeight, formatReleaseDate } from "@/lib/format-utils";
import { getProductLinks } from "@/lib/affiliateLinks";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import "../../detail-styles.css";
import "../../product-detail-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: {
    type?: string;
    sort?: string;
    page?: string;
  };
}

// ============================================================
// ユーティリティ
// ============================================================

function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCategory(slug);
  return category && PRODUCT_CATEGORIES.includes(category) ? category : null;
}


const getCachedProductDetail = cache(async (slug: string) => {
  return getProductDetailBySlug(slug);
});

// ============================================================
// generateMetadata — カテゴリ or 商品詳細
// ============================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // カテゴリslugの場合はリダイレクトされるのでメタデータ不要
  const category = getCategoryFromSlug(params.slug);
  if (category) return {};

  const product = await getCachedProductDetail(params.slug);
  if (!product) {
    return { title: "ページが見つかりません | Creator Clip" };
  }

  const commentsCount = product.all_comments?.length || 0;
  const shouldNoIndex = commentsCount < 3;
  const canonicalUrl = `/desktour/${params.slug}`;

  const title = `${product.brand ? product.brand + " " : ""}${product.name}の評判・ユーザーの口コミを紹介`;
  const description = `${product.name}を実際に使っている${product.mention_count}人のリアルな声を集約。使用者コメント${commentsCount}件と、どんな職業・環境の人に選ばれているかを掲載。`;

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
// 商品詳細ページ
// ============================================================

async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = (await getCachedProductDetail(params.slug))!;

  const correctCatSlug = categoryToSlug(product.category);

  // product.tags から該当カテゴリのサブカテゴリ（TYPE_TAGS）を検出
  const categoryTypeTags = TYPE_TAGS[product.category] || [];
  const productSubcategory = product.tags?.find((tag: string) => categoryTypeTags.includes(tag)) || null;

  const [coUsedProducts, similarProducts, brandProducts, stats, brandSlugMap] = await Promise.all([
    getCoOccurrenceProducts(product.id, 4),
    getSimilarProducts({
      id: product.id,
      category: product.category,
      tags: product.tags,
      brand: product.brand,
      price_range: product.price_range,
    }, 4),
    getBrandPopularProducts({ id: product.id, brand: product.brand }, 4),
    getSiteStats(),
    getBrandSlugMap(),
  ]);

  const totalOccupation = product.occupation_breakdown?.reduce((sum, s) => sum + s.count, 0) || 1;

  const styleTagSet = new Set<string>(STYLE_TAGS as readonly string[]);
  const styleStats = product.desk_setup_stats?.filter((s) => styleTagSet.has(s.setup_tag)) || [];
  const totalStyle = styleStats.reduce((sum, s) => sum + s.count, 0) || 1;

  const hasProductInfo = product.amazon_model_number ||
    product.amazon_manufacturer ||
    product.amazon_brand ||
    product.amazon_color ||
    product.amazon_size ||
    product.amazon_weight ||
    product.amazon_release_date ||
    product.asin;

  const hasFeatures = product.amazon_features && product.amazon_features.length > 0 && !isLowQualityFeatures(product.amazon_features);

  const hasChosenReasons = product.chosen_reasons && product.chosen_reasons.length > 0;
  const hasEnvironmentStats = (product.occupation_breakdown && product.occupation_breakdown.length > 0) ||
    styleStats.length > 0 || hasChosenReasons;
  const hasComments = product.all_comments && product.all_comments.length > 0;
  const hasCoUsedProducts = coUsedProducts.length > 0;
  const hasSimilarProducts = similarProducts.length > 0;
  const hasBrandProducts = brandProducts.length > 0;

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

  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "カテゴリ一覧", url: "/desktour/category" },
    { name: product.category, url: `/desktour/category/${correctCatSlug}` },
    ...(productSubcategory
      ? [{ name: productSubcategory, url: `/desktour/category/${correctCatSlug}/${desktourSubcategoryToSlug(productSubcategory)}` }]
      : []),
    { name: product.name },
  ]);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }} />

      <div className="product-page-header">
        <div className="product-detail-container">
          <div className="breadcrumb">
            <Link href="/">トップ</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href="/desktour">PCデスク環境</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href="/desktour/category">カテゴリ一覧</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href={`/desktour/category/${correctCatSlug}`}>{product.category}</Link>
            {productSubcategory && (
              <>
                <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
                <Link href={`/desktour/category/${correctCatSlug}/${desktourSubcategoryToSlug(productSubcategory)}`}>{productSubcategory}</Link>
              </>
            )}
          </div>

          <div className="product-hero">
            <a href={isOfficialSite ? product.amazon_url! : amazonUrl} target="_blank" rel={isOfficialSite ? "noopener noreferrer" : "noopener noreferrer sponsored"} className="product-image">
              {product.amazon_image_url ? (
                <img src={product.amazon_image_url} alt={`${product.brand || ""} ${product.name}`.trim()} width={400} height={400} />
              ) : (
                <i className={`fa-solid ${getCategoryIcon(product.category)} img-placeholder`}></i>
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
                    <Link href={`/desktour/category/${correctCatSlug}`} className="pstat-sub">
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
                        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                      }).replace(/\//g, ".")}取得
                    </div>
                  )}
                </div>
                <div className="pstat">
                  <div className="pstat-label">最終更新日</div>
                  <div className="pstat-value">
                    {new Date(lastUpdated).toLocaleDateString("ja-JP", {
                      year: "numeric", month: "2-digit", day: "2-digit"
                    }).replace(/\//g, ".")}
                  </div>
                  <div className="pstat-suffix">最新コメント追加日</div>
                </div>
              </div>

              <div className="product-actions">
                {isOfficialSite ? (
                  <a href={product.amazon_url!} target="_blank" rel="noopener noreferrer" className="action-btn">
                    <i className="fa-solid fa-globe" style={{ marginRight: 6 }}></i>公式サイトで見る
                  </a>
                ) : (
                  <>
                    <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                      <span className="icon-amazon">A</span>Amazonで見る
                    </a>
                    <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                      <span className="icon-rakuten">R</span>楽天で見る
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
            mentionCount={product.mention_count}
          />
        )}

        {hasEnvironmentStats && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}が登場しているデスク環境の傾向</h2>
            </div>
            <p className="section-summary">{product.brand && `${product.brand} `}{product.name}を使用している{product.occupation_breakdown?.[0]?.occupation_tag || "クリエイター"}を中心に、選ばれた理由やデスクスタイルの傾向をまとめています。</p>
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
                          <span className="trend-bar-wrap"><span className="trend-bar-fill" style={{ width: `${percentage}%` }}></span></span>
                          <span className="trend-item-pct">{percentage}%</span>
                        </div>
                      );
                    })}
                    <div className="trend-note">{totalOccupation}人が使用</div>
                  </div>
                )}
                {styleStats.length > 0 && (
                  <div className="trend-col">
                    <div className="trend-col-title">デスクスタイル (Desk Style)</div>
                    {styleStats.slice(0, 3).map((stat) => {
                      const percentage = Math.round((stat.count / totalStyle) * 100);
                      return (
                        <div key={stat.setup_tag} className="trend-item">
                          <span className="trend-item-name">{stat.setup_tag}</span>
                          <span className="trend-bar-wrap"><span className="trend-bar-fill" style={{ width: `${percentage}%` }}></span></span>
                          <span className="trend-item-pct">{percentage}%</span>
                        </div>
                      );
                    })}
                    <div className="trend-note">{totalStyle}人が使用</div>
                  </div>
                )}
                {hasChosenReasons && (
                  <div className="trend-col">
                    <div className="trend-col-title">選ばれている理由 (Why Chosen)</div>
                    <div className="trend-reasons">
                      {product.chosen_reasons!.map((reason, i) => (
                        <div key={i} className="trend-reason-item">
                          <span className="trend-reason-icon">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
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
              <h2>{product.brand && `${product.brand} `}{product.name}と一緒に使われている周辺機器</h2>
            </div>
            <p className="section-summary">{product.brand && `${product.brand} `}{product.name}と同じデスクで使われている周辺機器を、共起回数順に紹介します。</p>
            <div className="related-grid">
              {coUsedProducts.filter(p => p.slug).map((coProduct) => (
                <Link key={coProduct.id} href={productUrl(coProduct)} className="related-item">
                  <div className="related-item-img">
                    {coProduct.amazon_image_url ? (
                      <img src={coProduct.amazon_image_url} alt={coProduct.name} width={120} height={120} loading="lazy" />
                    ) : (
                      <i className={`fa-solid ${getCategoryIcon(coProduct.category || "")}`}></i>
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
                <Link key={simProduct.id} href={productUrl(simProduct)} className="related-item">
                  <div className="related-item-img">
                    {simProduct.amazon_image_url ? (
                      <img src={simProduct.amazon_image_url} alt={simProduct.name} width={120} height={120} loading="lazy" />
                    ) : (
                      <i className={`fa-solid ${getCategoryIcon(simProduct.category || "")}`}></i>
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

        {hasBrandProducts && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand}の人気商品</h2>
            </div>
            <p className="section-summary">{product.brand}ブランドで人気のある他の商品を紹介します。</p>
            <div className="related-grid">
              {brandProducts.filter(p => p.slug).map((brandProduct) => (
                <Link key={brandProduct.id} href={productUrl(brandProduct)} className="related-item">
                  <div className="related-item-img">
                    {brandProduct.amazon_image_url ? (
                      <img src={brandProduct.amazon_image_url} alt={brandProduct.name} width={120} height={120} loading="lazy" />
                    ) : (
                      <i className={`fa-solid ${getCategoryIcon(brandProduct.category || "")}`}></i>
                    )}
                  </div>
                  <div className="related-item-info">
                    <div className="related-item-cat">{brandProduct.category || "PRODUCT"}</div>
                    <div className="related-item-name">{brandProduct.name}</div>
                    <div className="related-item-usage">{brandProduct.mention_count}回登場</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="related-more">
              <Link href={`/desktour/brand/${brandSlugMap.get(product.brand!.toLowerCase()) || brandToSlug(product.brand!)}`} className="related-more-link">
                {product.brand}の商品をすべて見る <i className="fa-solid fa-arrow-right"></i>
              </Link>
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
                  {product.amazon_model_number && <tr><th>型番</th><td>{product.amazon_model_number}</td></tr>}
                  {product.amazon_manufacturer && <tr><th>メーカー</th><td>{product.amazon_manufacturer}</td></tr>}
                  {product.amazon_brand && <tr><th>ブランド</th><td>{product.amazon_brand}</td></tr>}
                  {product.amazon_color && <tr><th>カラー</th><td>{product.amazon_color}</td></tr>}
                  {product.amazon_size && <tr><th>サイズ</th><td>{convertSize(product.amazon_size)}</td></tr>}
                  {product.amazon_weight && <tr><th>重量</th><td>{convertWeight(product.amazon_weight)}</td></tr>}
                  {product.amazon_release_date && <tr><th>発売日</th><td>{formatReleaseDate(product.amazon_release_date)}</td></tr>}
                  {product.asin && <tr><th>ASIN</th><td>{product.asin}</td></tr>}
                  {product.tags && product.tags.length > 0 && (
                    <tr><th>特徴</th><td><div className="specs-features">{product.tags.map((tag, idx) => (<span key={idx} className="specs-feature-tag">{tag}</span>))}</div></td></tr>
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
            <Link href={product.category === "その他デスクアクセサリー" ? "/desktour/category" : `/desktour/category/${correctCatSlug}`} className="related-content-card">
              <div className="related-content-icon"><i className={`fa-solid ${getCategoryIcon(product.category)}`}></i></div>
              <div className="related-content-info">
                <div className="related-content-title">{product.category === "その他デスクアクセサリー" ? "デスク周りの人気ガジェット一覧" : `${product.category}一覧`}</div>
                <div className="related-content-desc">デスクツアーに登場した{product.category === "その他デスクアクセサリー" ? "ガジェット" : product.category}を登場回数順にチェック</div>
              </div>
              <div className="related-content-arrow"><i className="fa-solid fa-arrow-right"></i></div>
            </Link>
            <Link href="/desktour/sources" className="related-content-card">
              <div className="related-content-icon"><i className="fa-solid fa-video"></i></div>
              <div className="related-content-info">
                <div className="related-content-title">デスクツアー動画・記事データベース</div>
                <div className="related-content-desc">{(stats.total_videos + stats.total_articles).toLocaleString()}本のデスクツアーを掲載。職業・環境別に好みのデスクセットアップが見つかります</div>
              </div>
              <div className="related-content-arrow"><i className="fa-solid fa-arrow-right"></i></div>
            </Link>
          </div>
        </div>

        <div className="purchase-section product-reveal">
          <div className="purchase-card">
            <div className="purchase-title">{isOfficialSite ? "公式サイト" : "販売・在庫状況"}</div>
            <div className="purchase-buttons">
              {isOfficialSite ? (
                <a href={product.amazon_url!} target="_blank" rel="noopener noreferrer" className="purchase-btn amazon">
                  <i className="fa-solid fa-globe" style={{ marginRight: 8 }}></i>公式サイトで詳細を見る
                </a>
              ) : (
                <>
                  <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn amazon">
                    <span className="icon-dot am">A</span>Amazonで現在の価格を見る
                  </a>
                  <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn rakuten">
                    <span className="icon-dot rk">R</span>楽天で在庫を確認する
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
  // 旧カテゴリURL → 新URLにリダイレクト
  const category = getCategoryFromSlug(params.slug);
  if (category) {
    if (searchParams.type) {
      const subSlug = desktourSubcategoryToSlug(searchParams.type);
      redirect(`/desktour/category/${params.slug}/${subSlug}`);
    }
    redirect(`/desktour/category/${params.slug}`);
  }

  const product = await getCachedProductDetail(params.slug);
  if (product) {
    return <ProductDetailPage params={params} />;
  }

  notFound();
}
