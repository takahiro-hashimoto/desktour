import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { STYLE_TAGS, styleTagToSlug, slugToStyleTag, PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { formatPriceDate } from "@/lib/format-utils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string>;
}

// スタイル名を取得
function getStyleFromSlug(slug: string): string | null {
  const style = slugToStyleTag(slug);
  return style && (STYLE_TAGS as readonly string[]).includes(style) ? style : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const style = getStyleFromSlug(params.slug);
  if (!style) return { title: "スタイルが見つかりません" };

  const { total } = await searchProducts({ setupTag: style, limit: 1 });

  const title = `${style}スタイルのデスクツアー登場商品一覧【登録数${total}件】`;
  const description = `${style}スタイルのデスクツアーに登場した商品をカテゴリー別にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/style/${params.slug}` },
    openGraph: { title, description, url: `/desktour/style/${params.slug}` },
  };
}

export default async function StyleDetailPage({ params }: PageProps) {
  const style = getStyleFromSlug(params.slug);
  if (!style) notFound();

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
        category,
        setupTag: style,
        sortBy: "mention_count",
        limit: 3,
      });

      return {
        category,
        products: products.map((product) => ({
          id: product.id || "",
          asin: product.asin,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          image_url: product.amazon_image_url,
          amazon_url: product.amazon_url,
          rakuten_url: product.rakuten_url,
          price: product.amazon_price,
          price_updated_at: product.updated_at,
          mention_count: product.mention_count,
          user_comment: product.comments?.[0]?.comment,
        })),
        total,
      };
    })
  );

  // 商品があるカテゴリーのみ表示
  const filteredCategories = categoryProducts.filter((cat) => cat.products.length > 0);

  return (
    <>
      <PageHeaderSection
        label="Database Report"
        title={`${style}スタイルのデスクツアーに登場した商品一覧`}
        description={
          <>
            {style}スタイルの
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            {totalSources}件で実際に使用されている商品をカテゴリー別に掲載。全スタイルの総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={style}
        breadcrumbMiddle={{ label: "スタイル別", href: "/desktour/style" }}
        icon="fa-palette"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>このスタイルにはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
            <div key={category} style={{ marginBottom: "60px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
                <Link
                  href={`/desktour/style/${params.slug}/${categoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              </div>
              <div className="detail-product-grid">
                {products.map((product) => (
                  <div key={product.id} className="detail-product-card">
                    <a
                      href={product.amazon_url || product.rakuten_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="detail-product-img"
                    >
                      <div className="detail-product-img-inner">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} width={200} height={200} loading="lazy" />
                        ) : (
                          <i className="fa-solid fa-cube img-placeholder"></i>
                        )}
                      </div>
                    </a>
                    <div className="detail-product-body">
                      <div className="detail-product-brand">{product.brand || "ブランド不明"}</div>
                      <div className="detail-product-name">{product.name}</div>
                      <div className="detail-product-meta">
                        <span className="detail-mention-badge">
                          <i className="fa-solid fa-circle-check"></i> {product.mention_count}回登場
                        </span>
                        {product.price && (
                          <div className="detail-product-price">
                            <div className="price">¥{product.price.toLocaleString("ja-JP")}</div>
                            {product.price_updated_at && (
                              <div className="price-date">{formatPriceDate(product.price_updated_at)}</div>
                            )}
                          </div>
                        )}
                      </div>
                      {product.user_comment && (
                        <div className="detail-product-comment">
                          <span className="detail-product-comment-label">
                            <i className="fa-solid fa-comment"></i> 使用者の声
                          </span>
                          <p className="detail-product-desc">{product.user_comment}</p>
                        </div>
                      )}
                      {product.slug && (
                        <Link href={`/desktour/product/${product.slug}`} className="detail-product-cta">
                          詳細を見る <i className="fa-solid fa-arrow-right"></i>
                        </Link>
                      )}
                      {(product.amazon_url || product.rakuten_url) && (
                        <div className="detail-product-links">
                          {product.amazon_url && (
                            <a href={product.amazon_url} target="_blank" rel="noopener noreferrer sponsored" className="amazon">
                              Amazonで見る
                            </a>
                          )}
                          {product.rakuten_url && (
                            <a href={product.rakuten_url} target="_blank" rel="noopener noreferrer sponsored" className="rakuten">
                              楽天で見る
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
