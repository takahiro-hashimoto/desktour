import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { OCCUPATION_TAGS, slugToOccupation, slugToCategory, PRODUCT_CATEGORIES, TYPE_TAGS } from "@/lib/constants";
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
  const occupation = slugToOccupation(params.slug);
  const category = slugToCategory(params.category);

  if (!occupation || !category || !(OCCUPATION_TAGS as readonly string[]).includes(occupation) || !PRODUCT_CATEGORIES.includes(category)) {
    return { title: "ページが見つかりません" };
  }

  const { total } = await searchProducts({ category, occupationTag: occupation, limit: 1 });

  const title = `${occupation}のデスク環境で人気の${category}まとめ`;
  const description = `${occupation}が実際にデスク環境で使っている${category}を採用数順にランキング。使用者のリアルなコメント付きで比較できます。【${total}件掲載】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/occupation/${params.slug}/${params.category}` },
    openGraph: { title, description, url: `/desktour/occupation/${params.slug}/${params.category}` },
  };
}

export default async function OccupationCategoryPage({ params, searchParams }: PageProps) {
  const occupation = slugToOccupation(params.slug);
  const category = slugToCategory(params.category);

  if (!occupation || !category || !(OCCUPATION_TAGS as readonly string[]).includes(occupation) || !PRODUCT_CATEGORIES.includes(category)) {
    notFound();
  }

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchProducts({
    category,
    occupationTag: occupation,
    typeTag: typeTagFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const formattedProducts = products.map(formatProductForDisplay);

  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  const typeTags = TYPE_TAGS[category] || [];

  return (
    <>
      <PageHeaderSection
        label="Database Report"
        title={`${occupation}のデスク環境で人気の${category}まとめ`}
        description={
          <>
            {total}件の<Link href="/desktour/sources" className="link">デスクツアー</Link>で{occupation}が実際に使用している{category}を使用者のコメント付きで紹介。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: occupation, href: `/desktour/occupation/${params.slug}` }}
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

        <ProductGrid products={productsWithRank} />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
