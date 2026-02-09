import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, TYPE_TAGS, slugToCategory } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
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
  params: { slug: string };
  searchParams: {
    type?: string;
    sort?: string;
    page?: string;
  };
}

// カテゴリー名を取得
function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCategory(slug);
  return category && PRODUCT_CATEGORIES.includes(category) ? category : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getCategoryFromSlug(params.slug);
  if (!category) return { title: "カテゴリーが見つかりません" };

  const { total } = await searchProducts({ category, limit: 1 });

  const title = `デスクツアーに登場した${category}一覧【登録数${total}件】`;
  const description = `デスクツアー動画・記事で実際に使用されている${category}を登場回数順にまとめています。使用者コメント付き。【登録数${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/category/${params.slug}` },
    openGraph: { title, description, url: `/desktour/category/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug);
  if (!category) notFound();

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  // 商品データ取得
  const { products, total } = await searchProducts({
    category,
    typeTag: typeTagFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  // デスクツアー動画・記事の件数を取得
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 商品データを整形
  const formattedProducts = products.map(formatProductForDisplay);

  // ランク付け（mention_countソート時のみ、同じmention_countは同順位）
  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  // 種類タグ一覧
  const typeTags = TYPE_TAGS[category] || [];

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "デスク周りのガジェット", url: "/desktour/category" },
    { name: category },
  ]);

  return (
    <>
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーに登場した${category}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            で実際に使用されている{category}を使用者のコメント付きで紹介。その他カテゴリーが気になる方は
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            をご覧ください。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: "デスク周りのガジェット", href: "/desktour/category" }}
        icon={getCategoryIcon(category)}
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
