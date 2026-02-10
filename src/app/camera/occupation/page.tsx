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

  const title = `職業別撮影機材セットアップ一覧【${occupationCount}職種】`;
  const description = `映像クリエイター・フォトグラファー・配信者など${occupationCount}職種の撮影機材を${totalSources}件の撮影機材紹介から分析。職業ごとに人気の機材がわかります。`;

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
  "映像クリエイター": "映像制作を主な仕事とするクリエイターがよく使っている撮影機材を紹介。",
  "フォトグラファー": "写真撮影を行うフォトグラファーがよく使っている撮影機材を紹介。",
  "配信者": "ライブ配信やストリーミングを行う配信者がよく使っている撮影機材を紹介。",
  "Vlogger": "日常をVlogで発信するクリエイターがよく使っている撮影機材を紹介。",
  "映画監督": "映画やショートフィルムの制作を行う映画監督がよく使っている撮影機材を紹介。",
  "ウェディング": "ウェディング撮影を手がけるクリエイターがよく使っている撮影機材を紹介。",
  "報道・ジャーナリスト": "報道やドキュメンタリー制作を行うジャーナリストがよく使っている撮影機材を紹介。",
  "YouTuber": "YouTube動画制作を行うYouTuberがよく使っている撮影機材を紹介。",
  "エンジニア": "ガジェットレビューなどを行うエンジニアがよく使っている撮影機材を紹介。",
  "デザイナー": "クリエイティブ制作を行うデザイナーがよく使っている撮影機材を紹介。",
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
        title="職業別撮影機材セットアップ"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、職業別に人気の撮影機材を掲載。全職業の総合ランキングは
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
