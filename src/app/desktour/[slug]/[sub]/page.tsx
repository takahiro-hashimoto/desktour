import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import {
  PRODUCT_CATEGORIES,
  slugToCategory,
  categoryToSlug,
  slugToDesktourSubcategory,
  desktourSubcategoryToSlug,
} from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string; sub: string };
  searchParams: {
    sort?: string;
    page?: string;
  };
}

function resolveCategory(slug: string): string | null {
  const category = slugToCategory(slug);
  return category && PRODUCT_CATEGORIES.includes(category) ? category : null;
}

/** サブカテゴリ名にカテゴリ名が含まれている場合、重複を除去して結合する
 *  例: subcategory="メカニカルキーボード", category="キーボード" → "メカニカルキーボード"
 *      subcategory="60%・65%", category="キーボード" → "60%・65%キーボード"
 */
function formatSubcategoryTitle(subcategory: string, category: string): string {
  if (subcategory.includes(category)) return subcategory;
  return `${subcategory}${category}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = resolveCategory(params.slug);
  if (!category) return { title: "ページが見つかりません" };

  const subcategory = slugToDesktourSubcategory(params.sub);
  if (!subcategory) return { title: "ページが見つかりません" };

  const { total } = await searchProducts({ category, typeTag: subcategory, limit: 1 });

  const title = `デスクツアーで人気の${formatSubcategoryTitle(subcategory, category)}一覧【${total}件】`;
  const description = `デスクツアーで実際に使用されている${subcategory}を登場回数順にまとめました。使用者コメント付き。【${total}件】`;
  const canonical = `/desktour/${params.slug}/${params.sub}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SubcategoryPage({ params, searchParams }: PageProps) {
  const category = resolveCategory(params.slug);
  if (!category) notFound();

  const subcategory = slugToDesktourSubcategory(params.sub);
  if (!subcategory) notFound();

  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchProducts({
    category,
    typeTag: subcategory,
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

  const categorySlug = categoryToSlug(category);
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" },
    { name: "PCデスク環境", url: "/desktour" },
    { name: category, url: `/desktour/${categorySlug}` },
    { name: subcategory },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーで人気の${formatSubcategoryTitle(subcategory, category)}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">デスクツアー</Link>
            で実際に使用されている{subcategory}を使用者のコメント付きで紹介。
            <Link href={`/desktour/${categorySlug}`} className="link">{category}一覧</Link>
            に戻る。
          </>
        }
        breadcrumbCurrent={subcategory}
        breadcrumbMiddle={{ label: category, href: `/desktour/${categorySlug}` }}
        icon={getCategoryIcon(category)}
      />

      <div className="detail-container">
        <ResultsBar total={total} currentSort={sort} />
        <ProductGrid products={productsWithRank} />
        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
