import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats, findBrandInDatabase } from "@/lib/supabase";
import { inferBrandFromSlug, slugToCategory, PRODUCT_CATEGORIES, TYPE_TAGS, productUrl, DESKTOUR_SUBCATEGORY_SLUG_MAP } from "@/lib/constants";
import { getBrandBySlug } from "@/lib/supabase/queries-brands";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import { generateItemListStructuredData } from "@/lib/structuredData";
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
  const brandRow = await getBrandBySlug(params.slug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferBrandFromSlug(params.slug);
    return findBrandInDatabase(inferred);
  })();
  const category = slugToCategory(params.category);

  if (!brand || !category || !PRODUCT_CATEGORIES.includes(category)) {
    return { title: "ページが見つかりません" };
  }

  const { total } = await searchProducts({ category, brand, limit: 1 });

  const title = `デスクツアーで人気の${brand} ${category}まとめ`;
  const description = `${brand}の${category}を実際に使っている人の声をもとに採用数順にランキング。使用者コメント付きで比較できます。【${total}件掲載】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/brand/${params.slug}/${params.category}` },
    openGraph: { title, description, url: `/desktour/brand/${params.slug}/${params.category}` },
  };
}

export default async function BrandCategoryPage({ params, searchParams }: PageProps) {
  const brandRow = await getBrandBySlug(params.slug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferBrandFromSlug(params.slug);
    return findBrandInDatabase(inferred);
  })();
  const category = slugToCategory(params.category);

  if (!brand || !category || !PRODUCT_CATEGORIES.includes(category)) {
    notFound();
  }

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchProducts({
    category,
    brand,
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

  // ItemList構造化データ
  const itemListData = generateItemListStructuredData(
    formattedProducts.slice(0, 20).map((p, i) => ({
      name: p.name,
      url: productUrl(p),
      image_url: p.image_url,
      position: i + 1,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーで人気の${brand} ${category}まとめ`}
        description={
          <>
            {totalSources}件の<Link href="/desktour/sources" className="link">デスクツアー</Link>で実際に使用されている{brand}の{category}を使用者のコメント付きで紹介。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: brand, href: `/desktour/brand/${params.slug}` }}
      />

      <div className="detail-container">
        {typeTags.length > 0 && (
          <FilterSection
            label="種類別に絞り込み"
            filterKey="type"
            tags={typeTags}
            currentFilter={typeTagFilter}
            basePath={`/desktour/brand/${params.slug}/${params.category}`}
            tagSlugMap={DESKTOUR_SUBCATEGORY_SLUG_MAP}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
