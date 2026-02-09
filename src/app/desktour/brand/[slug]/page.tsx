import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { BRAND_TAGS, brandToSlug, slugToBrand, PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { formatPriceDate } from "@/lib/format-utils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string>;
}

// ブランド名を取得
function getBrandFromSlug(slug: string): string | null {
  const brand = slugToBrand(slug);
  return brand && (BRAND_TAGS as readonly string[]).includes(brand) ? brand : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brand = getBrandFromSlug(params.slug);
  if (!brand) return { title: "ブランドが見つかりません" };

  const { total } = await searchProducts({ brand, limit: 1 });

  const title = `${brand}のデスクツアー登場商品一覧【登録数${total}件】`;
  const description = `デスクツアーに登場した${brand}の商品をカテゴリー別にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/brand/${params.slug}` },
    openGraph: { title, description, url: `/desktour/brand/${params.slug}` },
  };
}

export default async function BrandDetailPage({ params }: PageProps) {
  const brand = getBrandFromSlug(params.slug);
  if (!brand) notFound();

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
        category,
        brand,
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
  const totalBrandProducts = filteredCategories.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <>
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーに登場した${brand}の商品一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            に登場した{brand}の商品{totalBrandProducts}件をカテゴリー別に掲載。全ブランドの総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={brand}
        breadcrumbMiddle={{ label: "ブランド別", href: "/desktour/brand" }}
        icon="fa-tag"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>このブランドにはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
          <div key={category} style={{ marginBottom: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
              <Link
                href={`/desktour/brand/${params.slug}/${categoryToSlug(category)}`}
                style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
              </Link>
            </div>
            <div className="detail-product-grid">
              {products.map((product, index) => (
                <div key={product.id} className="detail-product-card">
                  <a href={product.amazon_url || product.rakuten_url || "#"} target="_blank" rel="noopener noreferrer sponsored" className="detail-product-img">
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
