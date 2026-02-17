import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, getCameraTopBrandsByProductCount } from "@/lib/supabase/queries-camera";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

const MIN_PRODUCT_COUNT = 3;

export async function generateMetadata(): Promise<Metadata> {
  const brands = await getCameraTopBrandsByProductCount(999, MIN_PRODUCT_COUNT);
  const brandCount = brands.length;

  const title = `撮影機材紹介で人気のブランド一覧【${brandCount}ブランド】`;
  const description = `Sony・Canon・DJIなど${brandCount}ブランドの愛用機材をカバンの中身・撮影機材紹介から分析。カメラ・レンズ・周辺機器をブランド別に掲載。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/brand" },
    openGraph: { title, description, url: "/camera/brand", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrandIndexPage() {
  const [brands, stats] = await Promise.all([
    getCameraTopBrandsByProductCount(999, MIN_PRODUCT_COUNT),
    getCameraSiteStats(),
  ]);

  const listingItems = brands.map(({ brand, count, slug, icon, description }) => ({
    href: `/camera/brand/${slug}`,
    icon: icon || "fa-solid fa-tag",
    title: brand,
    count,
    description: description || "撮影機材紹介で紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
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
        domain="camera"
        label="Database Report"
        title="撮影機材紹介で人気のブランド一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、ブランド別に愛用機材を掲載。カメラ・レンズ・アクセサリーの総合ランキングは
            <Link href="/camera/category" className="link">
              撮影機材
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
