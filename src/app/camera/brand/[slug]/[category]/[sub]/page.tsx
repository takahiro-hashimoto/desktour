import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import { CAMERA_BRAND_TAGS, slugToCameraBrand, slugToCameraCategory, CAMERA_PRODUCT_CATEGORIES, CAMERA_TYPE_TAGS, cameraProductUrl, CAMERA_SUBCATEGORY_SLUG_MAP, slugToCameraSubcategory } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import { generateItemListStructuredData } from "@/lib/structuredData";
import "../../../../../detail-styles.css";
import "../../../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string; category: string; sub: string };
  searchParams: {
    sort?: string;
    page?: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brand = slugToCameraBrand(params.slug);
  const category = slugToCameraCategory(params.category);
  const subcategory = slugToCameraSubcategory(params.sub);

  if (!brand || !category || !subcategory || !(CAMERA_BRAND_TAGS as readonly string[]).includes(brand) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    return { title: "ページが見つかりません" };
  }

  const { total } = await searchCameraProducts({ category, brand, typeTag: subcategory, limit: 1 });

  const title = `撮影機材紹介で人気の${brand} ${subcategory}まとめ`;
  const description = `${total}件の撮影機材紹介で実際に使用されている${brand}の${subcategory}をコメント付きで紹介。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/brand/${params.slug}/${params.category}/${params.sub}` },
    openGraph: { title, description, url: `/camera/brand/${params.slug}/${params.category}/${params.sub}` },
  };
}

export default async function BrandCategorySubPage({ params, searchParams }: PageProps) {
  const brand = slugToCameraBrand(params.slug);
  const category = slugToCameraCategory(params.category);
  const subcategory = slugToCameraSubcategory(params.sub);

  if (!brand || !category || !subcategory || !(CAMERA_BRAND_TAGS as readonly string[]).includes(brand) || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) {
    notFound();
  }

  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchCameraProducts({
    category,
    brand,
    typeTag: subcategory,
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

  // ItemList構造化データ
  const itemListData = generateItemListStructuredData(
    formattedProducts.slice(0, 20).map((p, i) => ({
      name: p.name,
      url: cameraProductUrl(p),
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
        domain="camera"
        label="Database Report"
        title={`撮影機材紹介で人気の${brand} ${subcategory}まとめ`}
        description={
          <>
            {total}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            で実際に使用されている{brand}の{subcategory}をコメント付きで紹介。
          </>
        }
        breadcrumbCurrent={subcategory}
        breadcrumbMiddle={{ label: brand, href: `/camera/brand/${params.slug}` }}
      />

      <div className="detail-container">
        {typeTags.length > 0 && (
          <FilterSection
            label="種類別に絞り込み"
            filterKey="type"
            tags={typeTags}
            currentFilter={subcategory}
            basePath={`/camera/brand/${params.slug}/${params.category}`}
            tagSlugMap={CAMERA_SUBCATEGORY_SLUG_MAP}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} domain="camera" />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
