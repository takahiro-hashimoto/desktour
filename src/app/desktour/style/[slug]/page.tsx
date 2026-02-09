import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSetupTagCounts } from "@/lib/supabase";
import { STYLE_TAGS, styleTagToSlug, slugToStyleTag, PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
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
    openGraph: { title, description, url: `/desktour/style/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function StyleDetailPage({ params }: PageProps) {
  const style = getStyleFromSlug(params.slug);
  if (!style) notFound();

  const setupCounts = await getSetupTagCounts();
  const styleSourceCount = setupCounts[style] || 0;

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
        products: products.map(formatProductForDisplay),
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
            {styleSourceCount}件の{style}スタイルの
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            で実際に使用されている商品をカテゴリー別に掲載。全スタイルの総合ランキングは
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
              <ProductGrid products={products} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
