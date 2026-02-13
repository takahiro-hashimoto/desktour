import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import { CAMERA_OCCUPATION_TAGS, slugToCameraOccupation, slugToCameraCategory, CAMERA_PRODUCT_CATEGORIES, CAMERA_TYPE_TAGS } from "@/lib/camera/constants";
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
  const occupation = slugToCameraOccupation(params.slug);
  const category = slugToCameraCategory(params.category);

  if (!occupation || !category || !(CAMERA_OCCUPATION_TAGS as readonly string[]).includes(occupation) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    return { title: "ページが見つかりません" };
  }

  const { total } = await searchCameraProducts({ category, occupationTag: occupation, limit: 1 });

  const title = `${occupation}の撮影機材紹介で人気の${category}まとめ`;
  const description = `${total}件のカバンの中身・撮影機材紹介で${occupation}が愛用している${category}をコメント付きで紹介。セットアップ事例も掲載。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/occupation/${params.slug}/${params.category}` },
    openGraph: { title, description, url: `/camera/occupation/${params.slug}/${params.category}` },
  };
}

export default async function OccupationCategoryPage({ params, searchParams }: PageProps) {
  const occupation = slugToCameraOccupation(params.slug);
  const category = slugToCameraCategory(params.category);

  if (!occupation || !category || !(CAMERA_OCCUPATION_TAGS as readonly string[]).includes(occupation) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchCameraProducts({
    category,
    occupationTag: occupation,
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
        title={`${occupation}の撮影機材紹介で人気の${category}まとめ`}
        description={
          <>
            {total}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            で{occupation}が愛用している{category}をコメント付きで紹介。セットアップ構成の参考にどうぞ。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: occupation, href: `/camera/occupation/${params.slug}` }}
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
