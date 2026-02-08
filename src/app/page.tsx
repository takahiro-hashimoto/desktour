import { unstable_cache } from "next/cache";
import {
  getSiteStats,
  getProductCountByCategory,
  getOccupationTagCounts,
  getSetupTagCounts,
  getTopBrandsByProductCount,
  getLatestVideos,
} from "@/lib/supabase";
import {
  PRODUCT_CATEGORIES,
  STYLE_TAGS,
  OCCUPATION_TAGS,
  categoryToSlug,
  occupationToSlug,
  styleTagToSlug,
  brandToSlug,
  getDbValue,
} from "@/lib/constants";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoryGridSection } from "@/components/home/CategoryGridSection";
import { ExploreSection } from "@/components/home/ExploreSection";
import { FeaturedSection } from "@/components/home/FeaturedSection";
import { AboutSection } from "@/components/home/AboutSection";

// ホームページのデータを5分間キャッシュ
const getCachedHomeData = unstable_cache(
  async () => {
    const [stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos] = await Promise.all([
      getSiteStats(),
      getProductCountByCategory(),
      getOccupationTagCounts(),
      getSetupTagCounts(),
      getTopBrandsByProductCount(10),
      getLatestVideos(3),
    ]);
    return { stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos };
  },
  ["home-page-data"],
  { revalidate: 300 }
);

// カテゴリアイコンマッピング（Font Awesome）
const CATEGORY_ICONS: Record<string, string> = {
  "デスク": "fa-solid fa-table",
  "ディスプレイ・モニター": "fa-solid fa-desktop",
  "チェア": "fa-solid fa-chair",
  "キーボード": "fa-solid fa-keyboard",
  "マウス": "fa-solid fa-computer-mouse",
  "マイク": "fa-solid fa-microphone",
  "スピーカー": "fa-solid fa-volume-high",
  "照明・ライト": "fa-solid fa-lightbulb",
  "PC本体": "fa-solid fa-computer",
  "ヘッドホン・イヤホン": "fa-solid fa-headphones",
  "ウェブカメラ": "fa-solid fa-video",
  "モニターアーム": "fa-solid fa-desktop",
  "ドッキングステーション": "fa-solid fa-ethernet",
  "ケーブル・ハブ": "fa-solid fa-plug",
  "収納・整理": "fa-solid fa-box",
  "充電器・電源": "fa-solid fa-charging-station",
  "HDD・SSD": "fa-solid fa-hard-drive",
};

const SUB_CATEGORY_ICONS: Record<string, string> = {
  "マイク": "fa-solid fa-microphone",
  "スピーカー": "fa-solid fa-volume-high",
  "照明・ライト": "fa-solid fa-lightbulb",
  "PC本体": "fa-solid fa-computer",
  "ヘッドホン・イヤホン": "fa-solid fa-headphones",
  "オーディオインターフェース": "fa-solid fa-sliders",
  "モニターアーム": "fa-solid fa-desktop",
  "ドッキングステーション": "fa-solid fa-ethernet",
  "ウェブカメラ": "fa-solid fa-video",
  "ケーブル・ハブ": "fa-solid fa-plug",
  "収納・整理": "fa-solid fa-box",
  "充電器・電源": "fa-solid fa-charging-station",
  "HDD・SSD": "fa-solid fa-hard-drive",
};

export default async function HomePage() {
  const { stats, categoryCounts, occupationCounts, setupCounts, topBrands, latestVideos } = await getCachedHomeData();

  // メインカテゴリ（上位5件）
  const mainCategories = ["デスク", "ディスプレイ・モニター", "チェア", "キーボード", "マウス"].map(cat => ({
    name: cat,
    count: categoryCounts[getDbValue(cat)] || 0,
    icon: CATEGORY_ICONS[cat] || "📦",
  }));

  // サブカテゴリ
  const subCategories = [
    "マイク", "スピーカー", "照明・ライト", "PC本体", "ヘッドホン・イヤホン",
    "オーディオインターフェース", "モニターアーム", "ドッキングステーション",
    "ウェブカメラ", "ケーブル・ハブ", "収納・整理", "充電器・電源", "HDD・SSD"
  ].map(cat => ({
    name: cat,
    count: categoryCounts[getDbValue(cat)] || 0,
    icon: SUB_CATEGORY_ICONS[cat] || "📦",
    slug: categoryToSlug(cat),
  }));

  // 職業別データ
  const occupations = OCCUPATION_TAGS
    .map(label => ({
      name: label,
      count: occupationCounts[label] || 0,
      href: `/occupation/${occupationToSlug(label)}`,
    }))
    .sort((a, b) => b.count - a.count);

  // スタイル別データ
  const styles = STYLE_TAGS
    .map(label => ({
      name: label,
      count: setupCounts[label] || 0,
      href: `/style/${styleTagToSlug(label)}`,
    }))
    .sort((a, b) => b.count - a.count);

  // ブランド別データ
  const brands = topBrands.map(item => ({
    name: item.brand,
    count: item.count,
    href: `/brand/${item.slug}`,
  }));

  // 注目のデスクツアー（実際のデータを使用）
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
      href: `/sources#video-${video.video_id}`,
      thumbnail_url: video.thumbnail_url,
      product_count: (video as any).product_count || 0,
    };
  });

  // 構造化データ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "デスクツアーDB",
    "description": "デスクツアー動画・記事から本当に選ばれているデスク周りガジェットをデータ分析。職業・スタイル・ブランド別に人気商品を探せるデータベース。",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com",
    "mainEntity": {
      "@type": "ItemList",
      "name": "デスク周りガジェット カテゴリー一覧",
      "description": `${stats.total_videos + stats.total_articles}件以上のデスクツアーから収集した人気ガジェット`,
      "numberOfItems": mainCategories.length,
      "itemListElement": mainCategories.map((cat, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": cat.name,
        "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com"}/category/${categoryToSlug(cat.name)}`,
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

      <HeroSection stats={stats} />
      <CategoryGridSection mainCategories={mainCategories} subCategories={subCategories} />
      <ExploreSection occupations={occupations} styles={styles} brands={brands} />
      <FeaturedSection items={featured} />
      <AboutSection />
    </div>
  );
}
