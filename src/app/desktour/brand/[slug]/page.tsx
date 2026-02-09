import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { BRAND_TAGS, brandToSlug, slugToBrand, PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { formatProductForDisplay } from "@/lib/format-utils";
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
    openGraph: { title, description, url: `/desktour/brand/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
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
        products: products.map(formatProductForDisplay),
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
            <ProductGrid products={products} />
          </div>
          ))
        )}
      </div>
    </>
  );
}
