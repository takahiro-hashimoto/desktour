import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, getOccupationTagCounts } from "@/lib/supabase";
import { OCCUPATION_TAGS, occupationToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const [stats, occupationCounts] = await Promise.all([
    getSiteStats(),
    getOccupationTagCounts(),
  ]);
  const totalSources = stats.total_videos + stats.total_articles;
  const occupationCount = OCCUPATION_TAGS.filter(t => (occupationCounts[t] || 0) > 0).length;

  const title = `職業別デスクセットアップ一覧【${occupationCount}職種】`;
  const description = `エンジニア・デザイナー・配信者など${occupationCount}職種のデスク環境を${totalSources}件のデスクツアーから分析。職業ごとに人気のガジェットがわかります。`;

  return {
    title,
    description,
    alternates: { canonical: "/desktour/occupation" },
    openGraph: { title, description, url: "/desktour/occupation" },
  };
}

// 職業ごとのアイコン（Font Awesome）
const OCCUPATION_ICONS: Record<string, string> = {
  "エンジニア": "fa-solid fa-laptop-code",
  "デザイナー": "fa-solid fa-pen-ruler",
  "イラストレーター": "fa-solid fa-paintbrush",
  "配信者": "fa-solid fa-microphone-lines",
  "ゲーマー": "fa-solid fa-gamepad",
  "学生": "fa-solid fa-graduation-cap",
  "会社員": "fa-solid fa-briefcase",
  "経営者": "fa-solid fa-user-tie",
  "フォトグラファー": "fa-solid fa-camera",
};

// 職業ごとの説明文
const OCCUPATION_DESCRIPTIONS: Record<string, string> = {
  "エンジニア": "プログラミング作業を多くこなすエンジニアがよく使っているガジェットを紹介。",
  "デザイナー": "グラフィックやUIデザインを手がけるデザイナーがよく使っているガジェットを紹介。",
  "イラストレーター": "デジタルイラストを描くイラストレーターがよく使っているガジェットを紹介。",
  "配信者": "ライブ配信やストリーミングを行う配信者がよく使っているガジェットを紹介。",
  "ゲーマー": "ゲームプレイを楽しむゲーマーがよく使っているガジェットを紹介。",
  "学生": "学習や課題制作に取り組む学生がよく使っているガジェットを紹介。",
  "会社員": "在宅ワークやリモートワークをする会社員がよく使っているガジェットを紹介。",
  "経営者": "ビジネスの意思決定を行う経営者がよく使っているガジェットを紹介。",
  "フォトグラファー": "写真撮影や編集を行うフォトグラファーがよく使っているガジェットを紹介。",
};

export default async function OccupationIndexPage() {
  const [stats, occupationCounts] = await Promise.all([
    getSiteStats(),
    getOccupationTagCounts(),
  ]);

  // デスクツアー数でソート（多い順）、0件は除外
  const sortedOccupations = OCCUPATION_TAGS
    .map((occupation) => ({ occupation, count: occupationCounts[occupation] || 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

  const listingItems = sortedOccupations.map(({ occupation, count }) => ({
    href: `/desktour/occupation/${occupationToSlug(occupation)}`,
    icon: OCCUPATION_ICONS[occupation] || "fa-solid fa-user",
    title: occupation,
    count,
    description: OCCUPATION_DESCRIPTIONS[occupation] || "デスクツアーで紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
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
        label="Database Report"
        title="職業別デスクセットアップ"
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            から、職業別に人気のガジェットを掲載。全職業の総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
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
