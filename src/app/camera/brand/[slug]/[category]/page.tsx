import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import { CAMERA_BRAND_TAGS, slugToCameraBrand, slugToCameraCategory, CAMERA_PRODUCT_CATEGORIES, CAMERA_TYPE_TAGS } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../../../detail-styles.css";
import "../../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string; category: string };
  searchParams: {
    type?: string;
    sort?: string;
    page?: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brand = slugToCameraBrand(params.slug);
  const category = slugToCameraCategory(params.category);

  if (!brand || !category || !(CAMERA_BRAND_TAGS as readonly string[]).includes(brand) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    return { title: "ページが見つかりません" };
  }

  const { total } = await searchCameraProducts({ category, brand, limit: 1 });

  const title = `${brand}の${category}一覧【登録数${total}件】`;
  const description = `撮影機材紹介に登場した${brand}の${category}を登場回数順にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/brand/${params.slug}/${params.category}` },
    openGraph: { title, description, url: `/camera/brand/${params.slug}/${params.category}` },
  };
}

export default async function BrandCategoryPage({ params, searchParams }: PageProps) {
  const brand = slugToCameraBrand(params.slug);
  const category = slugToCameraCategory(params.category);

  if (!brand || !category || !(CAMERA_BRAND_TAGS as readonly string[]).includes(brand) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchCameraProducts({
    category,
    brand,
    typeTag: typeTagFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  const stats = await getCameraSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const formattedProducts = products.map(formatProductForDisplay);

  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  const typeTags = CAMERA_TYPE_TAGS[category] || [];

  return (
    <>
      <PageHeaderSection
        domain="camera"
        label="Database Report"
        title={`${brand}の${category}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介動画
            </Link>
            ・
            <Link href="/camera/sources" className="link">
              記事
            </Link>
            で{brand}の{category}が実際に使用されている様子を、使用者のコメント付きでまとめています。機材選びの参考にご活用ください。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: brand, href: `/camera/brand/${params.slug}` }}
      />

      <div className="detail-container">
        {typeTags.length > 0 && (
          <FilterSection
            label="種類別に絞り込み"
            filterKey="type"
            tags={typeTags}
            currentFilter={typeTagFilter}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} domain="camera" />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
