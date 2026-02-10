import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraOccupationTagCounts } from "@/lib/supabase/queries-camera";
import { CAMERA_OCCUPATION_TAGS, cameraOccupationToSlug, slugToCameraOccupation, CAMERA_PRODUCT_CATEGORIES, cameraCategoryToSlug } from "@/lib/camera/constants";
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

// 職業名を取得
function getOccupationFromSlug(slug: string): string | null {
  const occupation = slugToCameraOccupation(slug);
  return occupation && (CAMERA_OCCUPATION_TAGS as readonly string[]).includes(occupation) ? occupation : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) return { title: "職業が見つかりません" };

  const occupationCounts = await getCameraOccupationTagCounts();
  const sourceCount = occupationCounts[occupation] || 0;

  const title = `${occupation}の撮影機材紹介に登場した商品一覧【${sourceCount}件の撮影機材紹介を分析】`;
  const description = `${sourceCount}件の${occupation}の撮影機材紹介から収集した商品をカテゴリー別にまとめています。${occupation}に人気の機材が一目でわかります。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/occupation/${params.slug}` },
    openGraph: { title, description, url: `/camera/occupation/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function OccupationDetailPage({ params }: PageProps) {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) notFound();

  // 職業タグ別の撮影機材紹介数を取得
  const occupationCounts = await getCameraOccupationTagCounts();
  const occupationSourceCount = occupationCounts[occupation] || 0;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    CAMERA_PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchCameraProducts({
        category,
        occupationTag: occupation,
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
        domain="camera"
        label="Database Report"
        title={`${occupation}の撮影機材紹介に登場した商品一覧`}
        description={
          <>
            {occupation}の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            {occupationSourceCount}件で実際に使用されている商品をカテゴリー別に掲載。全職業の総合ランキングは
            <Link href="/camera/category" className="link">
              撮影機材
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={occupation}
        breadcrumbMiddle={{ label: "職業別", href: "/camera/occupation" }}
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
                href={`/camera/occupation/${params.slug}/${cameraCategoryToSlug(category)}`}
                style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
              </Link>
            </div>
            <ProductGrid products={products} domain="camera" />
          </div>
          ))
        )}
      </div>
    </>
  );
}
