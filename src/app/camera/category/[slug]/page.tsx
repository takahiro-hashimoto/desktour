import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats, getCameraSubcategories } from "@/lib/supabase/queries-camera";
import { CAMERA_PRODUCT_CATEGORIES, slugToCameraCategory, cameraSubcategoryToSlug } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import { getCameraCategoryIcon } from "@/lib/camera/category-icons";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: {
    sort?: string;
    page?: string;
  };
}

// カテゴリー名を取得
function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCameraCategory(slug);
  return category && (CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category) ? category : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getCategoryFromSlug(params.slug);
  if (!category) return { title: "カテゴリーが見つかりません" };

  const { total } = await searchCameraProducts({ category, limit: 1 });

  const title = `撮影機材紹介に登場した${category}一覧【登録数${total}件】`;
  const description = `撮影機材紹介動画・記事で実際に使用されている${category}を登場回数順にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/category/${params.slug}` },
    openGraph: { title, description, url: `/camera/category/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug);
  if (!category) notFound();

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
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
    { name: "カテゴリ", url: "/camera/category" },
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
          limit: 3,
        });

        return {
          subcategory: sub,
          products: products.map(formatProductForDisplay),
          total,
        };
      })
    );

    const filteredSubs = subcategoryProducts.filter((s) => s.products.length > 0);
    const { total: totalInCategory } = await searchCameraProducts({ category, limit: 1 });

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
        />
        <PageHeaderSection
          domain="camera"
          label="Database Report"
          title={`撮影機材紹介に登場した${category}一覧`}
          description={
            <>
              {totalSources}件の
              <Link href="/camera/sources" className="link">
                撮影機材紹介
              </Link>
              で実際に使用されている{category}{totalInCategory}件をサブカテゴリー別に掲載。その他カテゴリーが気になる方は
              <Link href="/camera/category" className="link">
                撮影機材
              </Link>
              をご覧ください。
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
            filteredSubs.map(({ subcategory, products, total }) => (
              <div key={subcategory} style={{ marginBottom: "60px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{subcategory}</h2>
                  {total > 3 && (
                    <Link
                      href={`/camera/category/${params.slug}/${cameraSubcategoryToSlug(subcategory)}`}
                      style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                    </Link>
                  )}
                </div>
                <ProductGrid products={products} domain="camera" />
              </div>
            ))
          )}

          <FAQSection items={[...COMMON_FAQ_ITEMS]} />
        </div>
      </>
    );
  }

  // ===== サブカテゴリーなし：フラット表示 =====
  const { products, total } = await searchCameraProducts({
    category,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  const formattedProducts = products.map(formatProductForDisplay);
  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PageHeaderSection
        domain="camera"
        label="Database Report"
        title={`撮影機材紹介に登場した${category}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">撮影機材紹介</Link>
            で実際に使用されている{category}を使用者のコメント付きで紹介。その他カテゴリーが気になる方は
            <Link href="/camera/category" className="link">撮影機材</Link>
            をご覧ください。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: "カテゴリ", href: "/camera/category" }}
        icon={getCameraCategoryIcon(category)}
      />

      <div className="detail-container">
        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} domain="camera" />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
