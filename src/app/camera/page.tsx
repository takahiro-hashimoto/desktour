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
  cameraSubjectToSlug,
} from "@/lib/camera/constants";
import { getCameraCategoryIcon } from "@/lib/camera/category-icons";
import { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoryGridSection } from "@/components/home/CategoryGridSection";
import { ExploreSection } from "@/components/home/ExploreSection";
import { FeaturedSection } from "@/components/home/FeaturedSection";

export async function generateMetadata(): Promise<Metadata> {
  const { stats } = await getCachedHomeData();
  const totalSources = stats.total_videos + stats.total_articles;

  const title = `撮影機材紹介・カメラバッグの中身データベース【${stats.total_products}件】`;
  const description = `${totalSources}件のYouTube機材紹介やカバンの中身動画を分析。カメラ・レンズ・周辺機器など${stats.total_products}件の愛用機材を職業・ブランド別に検索できます。`;

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
      href: `/camera/${cameraCategoryToSlug(cat)}`,
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
    "description": "カバンの中身・撮影機材紹介動画から本当に愛用されている撮影機材をデータ分析。YouTube機材セットアップを職業・ブランド別に探せるデータベース。",
    "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com"}/camera`,
    "mainEntity": {
      "@type": "ItemList",
      "name": "撮影機材 カテゴリー一覧",
      "description": `${stats.total_videos + stats.total_articles}件以上のカバンの中身・撮影機材紹介から収集した愛用機材`,
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

      <HeroSection
        stats={stats}
        config={{
          icon: "fa-solid fa-camera",
          titleLine1: "本当に使われている撮影機材を",
          subtitle: `${stats.total_videos + stats.total_articles}件の撮影機材紹介を独自に収集・整理。\n職業・ブランドから、本当に選ばれている撮影機材がわかります。`,
          primaryBtn: { label: "撮影機材データベース", href: "/camera/sources" },
          outlineBtn: { label: "機材カテゴリ", href: "/camera/category" },
          statLabels: { products: "掲載機材", sources: "機材紹介" },
        }}
      />
      <CategoryGridSection
        mainCategories={mainCategories}
        config={{
          titleIcon: "fa-camera",
          title: "機材カテゴリから探す",
          subtitle: "撮影機材紹介の動画・記事の中で登場した機材を登場回数が多い順に確認できます！",
          viewAllHref: "/camera/category",
        }}
      />
      <ExploreSection
        subtitle="職業・ブランド・被写体の切り口で人気の撮影機材を確認できます"
        cards={[
          {
            icon: "fas fa-briefcase",
            title: "職業別",
            description: "同じ職業の人がどんな撮影機材を使っているか参考にできます",
            items: occupations,
            viewAllHref: "/camera/occupation",
          },
          {
            icon: "fas fa-tags",
            title: "ブランド別",
            description: "紹介された機材数が多い人気ブランドから探せます",
            items: brands,
            viewAllHref: "/camera/brand",
          },
          {
            icon: "fas fa-crosshairs",
            title: "被写体別",
            description: "撮影対象ごとに、どんな機材が使われているか探せます",
            items: subjects,
            viewAllHref: "/camera/subject",
          },
        ]}
      />
      <FeaturedSection
        items={featured}
        config={{
          title: "注目の撮影機材紹介",
          subtitle: "最近追加された撮影機材紹介の動画、記事の中からおすすめを紹介",
          viewAllHref: "/camera/sources",
          placeholder: "CAMERA GEAR",
          productLabel: "紹介機材",
        }}
      />
    </div>
  );
}
