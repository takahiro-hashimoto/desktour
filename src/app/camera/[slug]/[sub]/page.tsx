import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_ALL_LENS_TAGS,
  CAMERA_ALL_BODY_TAGS,
  slugToCameraCategory,
  slugToCameraSubcategory,
  cameraCategoryToSlug,
} from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
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
  params: { slug: string; sub: string };
  searchParams: {
    lens?: string;
    body?: string;
    sort?: string;
    page?: string;
  };
}

function resolveCategory(slug: string): string | null {
  const category = slugToCameraCategory(slug);
  return category && (CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category) ? category : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = resolveCategory(params.slug);
  if (!category) return { title: "ページが見つかりません" };

  const subcategory = slugToCameraSubcategory(params.sub);
  if (!subcategory) return { title: "ページが見つかりません" };

  const { total } = await searchCameraProducts({ category, typeTag: subcategory, limit: 1 });

  const title = `人気の${subcategory}一覧【${total}件】| 撮影機材`;
  const description = `撮影機材紹介動画・記事で実際に使用されている${subcategory}を登場回数順にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/${params.slug}/${params.sub}` },
    openGraph: { title, description, url: `/camera/${params.slug}/${params.sub}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SubcategoryPage({ params, searchParams }: PageProps) {
  const category = resolveCategory(params.slug);
  if (!category) notFound();

  const subcategory = slugToCameraSubcategory(params.sub);
  if (!subcategory) notFound();

  const lensTagFilter = searchParams.lens;
  const bodyTagFilter = searchParams.body;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const lensTags = category === "レンズ" ? CAMERA_ALL_LENS_TAGS : [];
  const bodyTags = category === "カメラ本体" ? CAMERA_ALL_BODY_TAGS : [];

  const { products, total } = await searchCameraProducts({
    category,
    typeTag: subcategory,
    lensTag: lensTagFilter,
    bodyTag: bodyTagFilter,
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

  const categorySlug = cameraCategoryToSlug(category);
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" },
    { name: "撮影機材", url: "/camera" },
    { name: category, url: `/camera/${categorySlug}` },
    { name: subcategory },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PageHeaderSection
        domain="camera"
        label="Database Report"
        title={`人気の${subcategory}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">撮影機材紹介</Link>
            で実際に使用されている{subcategory}を使用者のコメント付きで紹介。
            <Link href={`/camera/${categorySlug}`} className="link">{category}一覧</Link>
            に戻る。
          </>
        }
        breadcrumbCurrent={subcategory}
        breadcrumbMiddle={{ label: category, href: `/camera/${categorySlug}` }}
        icon={getCameraCategoryIcon(category)}
      />

      <div className="detail-container">
        {lensTags.length > 0 && (
          <FilterSection
            label="レンズスペックで絞り込み"
            filterKey="lens"
            tags={lensTags}
            currentFilter={lensTagFilter}
          />
        )}
        {bodyTags.length > 0 && (
          <FilterSection
            label="センサーサイズで絞り込み"
            filterKey="body"
            tags={bodyTags}
            currentFilter={bodyTagFilter}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} domain="camera" />

        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
