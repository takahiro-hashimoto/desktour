import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { getCameraProductDetailBySlug, getCameraCoOccurrenceProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import { cameraCategoryToSlug, cameraBrandToSlug, cameraSubcategoryToSlug, CAMERA_OCCUPATION_TAGS } from "@/lib/camera/constants";
import { CoUsedProduct } from "@/types";
import { getProductLinks } from "@/lib/affiliateLinks";
import { isLowQualityFeatures } from "@/lib/featureQuality";
import { ProductReviews } from "@/components/product/ProductReviews";
import { generateBreadcrumbStructuredData, generateProductStructuredData } from "@/lib/structuredData";
import { getCameraCategoryIcon } from "@/lib/camera/category-icons";
import "../../../product-detail-styles.css";

// 単位変換ユーティリティ
function convertSize(sizeStr: string): string {
  // インチをcmに変換 (1インチ = 2.54cm)
  return sizeStr.replace(/(\d+\.?\d*)インチ/g, (_, num) => {
    const cm = parseFloat(num) * 2.54;
    return `${cm.toFixed(1)}cm`;
  });
}

function convertWeight(weightStr: string): string {
  // ポンドをgに変換 (1ポンド = 453.592g)
  return weightStr.replace(/(\d+\.?\d*)ポンド/g, (_, num) => {
    const g = parseFloat(num) * 453.592;
    return g >= 1000 ? `${(g / 1000).toFixed(1)}kg` : `${Math.round(g)}g`;
  });
}

function formatReleaseDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // パースできない場合はそのまま
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

interface PageProps {
  params: { slug: string };
}

// 【最適化】React cacheでリクエスト内のデータ取得を重複排除
// generateMetadataとページ本体で同じslugの商品を取得する場合、1回のみDBアクセス
const getCachedProductDetail = cache(async (slug: string) => {
  return getCameraProductDetailBySlug(slug);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getCachedProductDetail(params.slug);

  if (!product) {
    return { title: "商品が見つかりません | 撮影機材DB" };
  }

  const commentsCount = product.all_comments?.length || 0;
  const shouldNoIndex = commentsCount < 3;

  const title = `${product.name}の使用例・口コミまとめ【${product.mention_count}件の撮影機材紹介に登場】`;
  const description = `${product.mention_count}件の撮影機材紹介に登場した${product.name}。使用者コメント${commentsCount}件と使用環境の傾向を掲載しています。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/product/${params.slug}` },
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: `/camera/product/${params.slug}`,
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

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getCachedProductDetail(params.slug);

  if (!product) {
    notFound();
  }

  const [coUsedProducts, stats] = await Promise.all([
    getCameraCoOccurrenceProducts(product.id, 4),
    getCameraSiteStats(),
  ]);

  // パーセント計算用の合計
  const totalOccupation = product.occupation_breakdown?.reduce((sum, s) => sum + s.count, 0) || 1;

  // 商品情報があるかチェック
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

  // 商品の特徴があるかチェック
  const hasFeatures = product.amazon_features && product.amazon_features.length > 0 && !isLowQualityFeatures(product.amazon_features);

  const hasChosenReasons = product.chosen_reasons && product.chosen_reasons.length > 0;
  const hasEnvironmentStats = (product.occupation_breakdown && product.occupation_breakdown.length > 0) ||
    hasChosenReasons;
  const hasComments = product.all_comments && product.all_comments.length > 0;
  const hasCoUsedProducts = coUsedProducts.length > 0;

  // アフィリエイトリンク生成
  const { amazonUrl, rakutenUrl } = getProductLinks({
    amazon_url: product.amazon_url,
    amazon_model_number: product.amazon_model_number,
    name: product.name,
  });

  // 最終更新日（最新のコメント追加日）を取得
  const lastUpdated = product.updated_at || new Date().toISOString();

  // 構造化データ - パンくずリスト
  const categorySlug = cameraCategoryToSlug(product.category);
  const breadcrumbItems = [
    { name: "トップ", url: "/" },
    { name: "撮影機材", url: "/camera" },
    { name: "カテゴリ", url: "/camera/category" },
    { name: product.category, url: `/camera/category/${categorySlug}` },
    ...(product.subcategory
      ? [{ name: product.subcategory, url: `/camera/category/${categorySlug}/${cameraSubcategoryToSlug(product.subcategory)}` }]
      : []),
    { name: product.name },
  ];
  const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbItems);

  // 構造化データ - 商品情報
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
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData) }}
      />

      {/* PAGE HEADER + PRODUCT HERO */}
      <div className="product-page-header">
        <div className="product-detail-container">
          <div className="breadcrumb">
            <Link href="/">トップ</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href="/camera">撮影機材</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href="/camera/category">カテゴリ</Link>
            <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
            <Link href={`/camera/category/${categorySlug}`}>{product.category}</Link>
            {product.subcategory && (
              <>
                <span className="sep"><i className="fa-solid fa-chevron-right"></i></span>
                <Link href={`/camera/category/${categorySlug}/${cameraSubcategoryToSlug(product.subcategory)}`}>{product.subcategory}</Link>
              </>
            )}
          </div>

          <div className="product-hero">
            <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="product-image">
              {product.amazon_image_url ? (
                <img src={product.amazon_image_url} alt={product.name} width={400} height={400} />
              ) : (
                <i className={`fa-solid ${getCameraCategoryIcon(product.category)} img-placeholder`}></i>
              )}
            </a>
            <div className="product-info">
              <h1 className="page-subtitle">
                {product.brand && `${product.brand} `}{product.name}の使用例・口コミ情報まとめ
              </h1>
              <p className="page-title">{product.brand && `${product.brand} `}{product.name}</p>

              <div className="product-stats">
                <div className="pstat">
                  <div className="pstat-label">
                    <Link href={`/camera/category/${cameraCategoryToSlug(product.category)}`} className="pstat-sub">
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
                <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                  <span className="icon-amazon">A</span>
                  Amazonで見る
                </a>
                <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="action-btn">
                  <span className="icon-rakuten">R</span>
                  楽天で見る
                </a>
              </div>
              <span className="pr-note">（本ページにはPRを含みます）</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="product-detail-container">
        {/* 01: REVIEWS */}
        {hasComments && (
          <ProductReviews
            comments={product.all_comments!}
            productName={`${product.brand ? `${product.brand} ` : ""}${product.name}`}
            productId={product.id}
            sectionNumber={++sectionNum}
            domain="camera"
          />
        )}

        {/* 02: TRENDS */}
        {hasEnvironmentStats && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}が登場している撮影環境の傾向</h2>
            </div>
            <div className="trend-card">
              <div className={`trend-grid${hasChosenReasons ? " trend-grid-3col" : ""}`}>
                {/* Occupation */}
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

                {/* 選ばれている理由 (Why Chosen) */}
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

        {/* 03: FEATURES */}
        {hasFeatures && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}の特徴</h2>
            </div>
            <div className="feature-card">
              <ul className="feature-list">
                {product.amazon_features!.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 04: RELATED PRODUCTS */}
        {hasCoUsedProducts && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}と一緒に使われている撮影機材</h2>
            </div>
            <div className="related-grid">
              {coUsedProducts.filter(p => p.slug).map((coProduct) => (
                <Link key={coProduct.id} href={`/camera/product/${coProduct.slug}`} className="related-item">
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

        {/* 05: SPECS */}
        {hasProductInfo && (
          <div className="content-section product-reveal">
            <div className="section-title">
              <span className="section-number">{String(++sectionNum).padStart(2, "0")}</span>
              <h2>{product.brand && `${product.brand} `}{product.name}の基本情報</h2>
            </div>
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
                        <Link href={`/camera/category/${cameraCategoryToSlug(product.category)}`} className="specs-link">
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

        {/* 06: RELATED CONTENT */}
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

        {/* PURCHASE */}
        <div className="purchase-section product-reveal">
          <div className="purchase-card">
            <div className="purchase-title">販売・在庫状況</div>
            <div className="purchase-buttons">
              <a href={amazonUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn amazon">
                <span className="icon-dot am">A</span>
                Amazonで現在の価格を見る
              </a>
              <a href={rakutenUrl} target="_blank" rel="noopener noreferrer sponsored" className="purchase-btn rakuten">
                <span className="icon-dot rk">R</span>
                楽天で在庫を確認する
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
