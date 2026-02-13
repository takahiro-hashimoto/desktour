import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, getCameraOccupationTagCounts } from "@/lib/supabase/queries-camera";
import { CAMERA_OCCUPATION_TAGS, cameraOccupationToSlug } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const [stats, occupationCounts] = await Promise.all([
    getCameraSiteStats(),
    getCameraOccupationTagCounts(),
  ]);
  const totalSources = stats.total_videos + stats.total_articles;
  const occupationCount = CAMERA_OCCUPATION_TAGS.filter(t => (occupationCounts[t] || 0) > 0).length;

  const title = `職業別カメラバッグの中身まとめ【${occupationCount}職種】`;
  const description = `映像クリエイター・フォトグラファー・YouTuberなど${occupationCount}職種のカメラバッグの中身を${totalSources}件の機材紹介から分析。職業ごとの愛用機材やセットアップ構成がわかります。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/occupation" },
    openGraph: { title, description, url: "/camera/occupation", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// 職業ごとのアイコン（Font Awesome）
const OCCUPATION_ICONS: Record<string, string> = {
  "映像クリエイター": "fa-solid fa-film",
  "フォトグラファー": "fa-solid fa-camera",
  "配信者": "fa-solid fa-microphone-lines",
  "Vlogger": "fa-solid fa-video",
  "映画監督": "fa-solid fa-clapperboard",
  "ウェディング": "fa-solid fa-ring",
  "報道・ジャーナリスト": "fa-solid fa-newspaper",
  "YouTuber": "fa-brands fa-youtube",
  "エンジニア": "fa-solid fa-laptop-code",
  "デザイナー": "fa-solid fa-pen-ruler",
};

// 職業ごとの説明文
const OCCUPATION_DESCRIPTIONS: Record<string, string> = {
  "映像クリエイター": "映像クリエイターのカバンの中身・愛用機材セットアップを紹介。カメラ・レンズ・周辺機器まで。",
  "フォトグラファー": "フォトグラファーのカバンの中身・愛用機材を紹介。カメラ・レンズ・アクセサリーまで。",
  "配信者": "配信者のカバンの中身・愛用機材セットアップを紹介。カメラ・マイク・周辺機器まで。",
  "Vlogger": "Vloggerのカバンの中身・愛用機材を紹介。YouTube機材セットアップの参考に。",
  "映画監督": "映画監督のカバンの中身・愛用機材セットアップを紹介。シネマカメラから周辺機器まで。",
  "ウェディング": "ウェディング撮影のカバンの中身・愛用機材を紹介。カメラ・レンズ・アクセサリーまで。",
  "報道・ジャーナリスト": "報道・ジャーナリストのカバンの中身・愛用機材を紹介。カメラから周辺機器まで。",
  "YouTuber": "YouTuberのカバンの中身・愛用機材を紹介。YouTube機材セットアップの参考に。",
  "エンジニア": "エンジニアのカバンの中身・愛用機材を紹介。ガジェットレビュー機材からアクセサリーまで。",
  "デザイナー": "デザイナーのカバンの中身・愛用機材を紹介。カメラ・周辺機器のセットアップ事例。",
};

export default async function OccupationIndexPage() {
  const [stats, occupationCounts] = await Promise.all([
    getCameraSiteStats(),
    getCameraOccupationTagCounts(),
  ]);

  // 撮影機材紹介数でソート（多い順）、0件は除外
  const sortedOccupations = CAMERA_OCCUPATION_TAGS
    .map((occupation) => ({ occupation, count: occupationCounts[occupation] || 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

  const listingItems = sortedOccupations.map(({ occupation, count }) => ({
    href: `/camera/occupation/${cameraOccupationToSlug(occupation)}`,
    icon: OCCUPATION_ICONS[occupation] || "fa-solid fa-user",
    title: occupation,
    count,
    description: OCCUPATION_DESCRIPTIONS[occupation] || "撮影機材紹介で紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
    { name: "職業別" },
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
        title="職業別カメラバッグの中身まとめ"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、職業別にカバンの中身・愛用機材を掲載。全職業の総合ランキングは
            <Link href="/camera/category" className="link">
              撮影機材
            </Link>
            で紹介しています。
          </>
        }
        breadcrumbCurrent="職業別"
        icon="fa-briefcase"
      />
      <ListingGrid items={listingItems} />
    </>
  );
}
