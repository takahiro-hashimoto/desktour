import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { OCCUPATION_TAGS, occupationToSlug, slugToOccupation, PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import "../../detail-styles.css";
import "../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string>;
}

// 職業名を取得
function getOccupationFromSlug(slug: string): string | null {
  const occupation = slugToOccupation(slug);
  return occupation && (OCCUPATION_TAGS as readonly string[]).includes(occupation) ? occupation : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) return { title: "職業が見つかりません" };

  const title = `${occupation}のデスクツアーに登場した商品一覧`;
  const description = `${occupation}が実際に使用しているデスク環境の商品を、カテゴリー別にまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: `/occupation/${params.slug}` },
    openGraph: { title, description, url: `/occupation/${params.slug}` },
  };
}

export default async function OccupationDetailPage({ params }: PageProps) {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) notFound();

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
        category,
        occupationTag: occupation,
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
        title={`${occupation}のデスクツアーに登場した商品一覧`}
        description={
          <>
            {occupation}の
            <Link href="/sources" className="link">
              デスクツアー
            </Link>
            {totalSources}件で実際に使用されている商品をカテゴリー別に掲載。全職業の総合ランキングは
            <Link href="/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={occupation}
        breadcrumbMiddle={{ label: "職業別", href: "/occupation" }}
        icon="fa-user-tie"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>このカテゴリーにはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
          <div key={category} style={{ marginBottom: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
              <Link
                href={`/occupation/${params.slug}/${categoryToSlug(category)}`}
                style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
              </Link>
            </div>
            <div className="detail-product-grid">
              {products.map((product, index) => (
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
                        </div>
                      )}
                    </div>
                    {product.user_comment && <p className="detail-product-desc">{product.user_comment}</p>}
                    {product.slug && (
                      <Link href={`/product/${product.slug}`} className="detail-product-cta">
                        詳細を見る
                      </Link>
                    )}
                    <div className="detail-product-links">
                      {product.amazon_url && (
                        <a href={product.amazon_url} target="_blank" rel="noopener noreferrer" className="amazon">
                          <i className="fa-brands fa-amazon"></i> Amazonで探す
                        </a>
                      )}
                      {product.rakuten_url && (
                        <a href={product.rakuten_url} target="_blank" rel="noopener noreferrer" className="rakuten">
                          楽天で探す
                        </a>
                      )}
                    </div>
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
