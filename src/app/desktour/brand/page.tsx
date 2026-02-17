import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, getTopBrandsByProductCount } from "@/lib/supabase";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

const MIN_PRODUCT_COUNT = 3;

export async function generateMetadata(): Promise<Metadata> {
  const brands = await getTopBrandsByProductCount(999, MIN_PRODUCT_COUNT);
  const brandCount = brands.length;

  const title = `デスク周りの人気ブランド一覧【${brandCount}ブランド比較】`;
  const description = `FlexiSpot・Logicool・Keychronなど${brandCount}ブランドの採用実績をリアルデータから分析。ブランド別の人気商品と使用者の声を掲載しています。`;

  return {
    title,
    description,
    alternates: { canonical: "/desktour/brand" },
    openGraph: { title, description, url: "/desktour/brand", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrandIndexPage() {
  const [brands, stats] = await Promise.all([
    getTopBrandsByProductCount(999, MIN_PRODUCT_COUNT),
    getSiteStats(),
  ]);

  const listingItems = brands.map(({ brand, count, slug, icon, description }) => ({
    href: `/desktour/brand/${slug}`,
    icon: icon || "fa-solid fa-tag",
    title: brand,
    count,
    description: description || "デスクツアーで紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "ブランド別" },
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
        title="デスク周りの人気ブランド一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            から、ブランド別に人気のガジェットを掲載。全ブランドの総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent="ブランド別"
        icon="fa-tags"
      />
      <ListingGrid items={listingItems} />
    </>
  );
}
