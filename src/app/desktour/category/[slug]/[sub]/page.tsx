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
  productUrl,
} from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData, generateItemListStructuredData } from "@/lib/structuredData";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../../../detail-styles.css";
import "../../../../listing-styles.css";

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

  const title = `デスクツアーで人気の${formatSubcategoryTitle(subcategory, category)}まとめ`;
  const description = `デスク環境で実際に使われている${formatSubcategoryTitle(subcategory, category)}を採用数順にランキング。使用者のリアルなコメント付き。【${total}件掲載】`;
  const canonical = `/desktour/category/${params.slug}/${params.sub}`;

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
    { name: "カテゴリ一覧", url: "/desktour/category" },
    { name: category, url: `/desktour/category/${categorySlug}` },
    { name: subcategory },
  ]);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーで人気の${formatSubcategoryTitle(subcategory, category)}まとめ`}
        description={
          <>
            {totalSources}件の<Link href="/desktour/sources" className="link">デスクツアー</Link>で実際に使用されている{subcategory}を使用者のコメント付きで紹介。
          </>
        }
        breadcrumbCurrent={subcategory}
        breadcrumbMiddle={[
          { label: "カテゴリ一覧", href: "/desktour/category" },
          { label: category, href: `/desktour/category/${categorySlug}` },
        ]}
        icon={getCategoryIcon(category)}
      />

      <div className="detail-container">
        <ResultsBar total={total} currentSort={sort} />
        <ProductGrid products={productsWithRank} headingLevel="h3" />
        <FAQSection items={[...COMMON_FAQ_ITEMS]} />
      </div>
    </>
  );
}
