import { unstable_cache } from "next/cache";
import {
  getCameraSiteStats,
  getCameraProductCountByCategory,
  getCameraOccupationTagCounts,
  getCameraSetupTagCounts,
  getCameraTopBrandsByProductCount,
  getCameraLatestVideos,
  getCameraSourceTagCounts,
} from "@/lib/supabase/queries-camera";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_OCCUPATION_TAGS,
  CAMERA_SUBJECT_TAGS,
  cameraCategoryToSlug,
  cameraOccupationToSlug,
  cameraBrandToSlug,
  cameraSubjectToSlug,
} from "@/lib/camera/constants";
import { getCameraCategoryIcon } from "@/lib/camera/category-icons";
import { Metadata } from "next";
import { CameraHeroSection } from "@/components/camera-home/HeroSection";
import { CameraCategoryGridSection } from "@/components/camera-home/CategoryGridSection";
import { CameraExploreSection } from "@/components/camera-home/ExploreSection";
import { CameraFeaturedSection } from "@/components/camera-home/FeaturedSection";

export async function generateMetadata(): Promise<Metadata> {
  const { stats } = await getCachedHomeData();
  const totalSources = stats.total_videos + stats.total_articles;

  const title = `撮影機材紹介で使われている撮影機材データベース【${stats.total_products}件】`;
  const description = `${totalSources}件の撮影機材紹介動画・記事から収集した${stats.total_products}件の商品データベース。職業・ブランド別に、実際に使われている撮影機材を探せます。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera" },
    openGraph: { title, description, url: "/camera" },
  };
}

// ホームページのデータを5分間キャッシュ
const getCachedHomeData = unstable_cache(
  async () => {
    const [stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos, sourceTagCounts] = await Promise.all([
      getCameraSiteStats(),
      getCameraProductCountByCategory(),
      getCameraOccupationTagCounts(),
      getCameraSetupTagCounts(),
      getCameraTopBrandsByProductCount(10),
      getCameraLatestVideos(3),
      getCameraSourceTagCounts(),
    ]);
    return { stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos, sourceTagCounts };
  },
  ["camera-home-page-data"],
  { revalidate: 300 }
);

export default async function CameraPage() {
  const { stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos, sourceTagCounts } = await getCachedHomeData();

  // トップページに表示するカテゴリ（収録・制御機器を除く）
  const EXCLUDED_TOP_CATEGORIES = ["収録・制御機器"];
  const mainCategories = [...CAMERA_PRODUCT_CATEGORIES]
    .filter(cat => !EXCLUDED_TOP_CATEGORIES.includes(cat))
    .map(cat => ({
      name: cat,
      count: categoryCounts[cat] || 0,
      icon: `fa-solid ${getCameraCategoryIcon(cat)}`,
    }));

  // 職業別データ
  const occupations = CAMERA_OCCUPATION_TAGS
    .map(label => ({
      name: label,
      count: occupationCounts[label] || 0,
      href: `/camera/occupation/${cameraOccupationToSlug(label)}`,
    }))
    .sort((a, b) => b.count - a.count);

  // ブランド別データ
  const brands = topBrands.map(item => ({
    name: item.brand,
    count: item.count,
    href: `/camera/brand/${item.slug}`,
  }));

  // 被写体別データ
  const subjects = [...CAMERA_SUBJECT_TAGS]
    .map(tag => ({
      name: tag,
      count: sourceTagCounts[tag] || 0,
      href: `/camera/subject/${cameraSubjectToSlug(tag)}`,
    }))
    .sort((a, b) => b.count - a.count);

  // 注目の撮影機材紹介（実際のデータを使用）
  const featured = latestVideos.map((video, index) => {
    const occupationTags = (video as any).occupation_tags || [];
    const styleTags = video.tags || [];
    const allTags = [...occupationTags.slice(0, 1), ...styleTags.slice(0, 1)];

    return {
      id: video.video_id,
      title: video.title,
      description: video.summary || "",
      tags: allTags,
      badge: index === 0 ? "New" : undefined,
      href: `/camera/sources#video-${video.video_id}`,
      thumbnail_url: video.thumbnail_url,
      product_count: (video as any).product_count || 0,
    };
  });

  // 構造化データ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Creator Clip - 撮影機材",
    "description": "撮影機材紹介動画・記事から本当に選ばれている撮影機材をデータ分析。職業・ブランド別に人気商品を探せるデータベース。",
    "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com"}/camera`,
    "mainEntity": {
      "@type": "ItemList",
      "name": "撮影機材 カテゴリー一覧",
      "description": `${stats.total_videos + stats.total_articles}件以上の撮影機材紹介から収集した人気撮影機材`,
      "numberOfItems": mainCategories.length,
      "itemListElement": mainCategories.map((cat, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": cat.name,
        "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com"}/camera/${cameraCategoryToSlug(cat.name)}`,
      })),
    },
  };

  return (
    <div className="home-page">
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CameraHeroSection stats={stats} />
      <CameraCategoryGridSection mainCategories={mainCategories} />
      <CameraExploreSection occupations={occupations} brands={brands} subjects={subjects} />
      <CameraFeaturedSection items={featured} />
    </div>
  );
}
