import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { searchCameraProducts, getCameraSiteStats, getCameraProductDetailBySlug } from "@/lib/supabase/queries-camera";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_ALL_LENS_TAGS,
  CAMERA_ALL_BODY_TAGS,
  slugToCameraCategory,
  slugToCameraSubcategory,
  cameraCategoryToSlug,
  cameraSubcategoryToSlug,
  CAMERA_OCCUPATION_TAGS,
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

// サブカテゴリーとして解決を試みる
function resolveAsSubcategory(slug: string, subSlug: string): { category: string; subcategory: string } | null {
  const category = slugToCameraCategory(slug);
  if (!category || !(CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(category)) return null;

  const subcategory = slugToCameraSubcategory(subSlug);
  if (!subcategory) return null;

  return { category, subcategory };
}

// 商品詳細データのキャッシュ
const getCachedProductDetail = cache(async (productSlug: string) => {
  return getCameraProductDetailBySlug(productSlug);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // 1) サブカテゴリーとして解決
  const resolved = resolveAsSubcategory(params.slug, params.sub);
  if (resolved) {
    const { category, subcategory } = resolved;
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

  // 2) 商品詳細として解決（フォールバック）→ リダイレクト先のメタデータ
  const product = await getCachedProductDetail(params.sub);
  if (!product) {
    return { title: "ページが見つかりません" };
  }

  // 商品詳細はドメイン直下 /camera/${slug} がcanonical
  return {
    title: `${product.name}の使用例・口コミまとめ`,
    alternates: { canonical: `/camera/${product.slug || product.id}` },
  };
}

export default async function SubOrProductPage({ params, searchParams }: PageProps) {
  // 1) サブカテゴリーとして解決を試みる
  const resolved = resolveAsSubcategory(params.slug, params.sub);
  if (resolved) {
    return <SubcategoryListPage params={params} searchParams={searchParams} resolved={resolved} />;
  }

  // 2) 商品詳細として解決 → ドメイン直下にリダイレクト
  const product = await getCachedProductDetail(params.sub);
  if (product) {
    redirect(`/camera/${product.slug || product.id}`);
  }

  notFound();
}

// =============================================================================
// サブカテゴリー一覧ページ
// =============================================================================

async function SubcategoryListPage({
  params,
  searchParams,
  resolved,
}: {
  params: PageProps["params"];
  searchParams: PageProps["searchParams"];
  resolved: { category: string; subcategory: string };
}) {
  const { category, subcategory } = resolved;
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
