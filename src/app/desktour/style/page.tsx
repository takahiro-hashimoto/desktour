import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, getSetupTagCounts } from "@/lib/supabase";
import { STYLE_TAGS, styleTagToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const setupCounts = await getSetupTagCounts();
  const styleCount = ALL_SETUP_TAGS.filter((style) => (setupCounts[style] || 0) > 0).length;

  const title = `スタイル別デスクセットアップ一覧【${styleCount}スタイル】`;
  const description = `ミニマル・ゲーミング・ホワイトなど${styleCount}スタイルのデスク環境を${totalSources}件のデスクツアーから分析。スタイル別の人気ガジェットを掲載しています。`;

  return {
    title,
    description,
    alternates: { canonical: "/desktour/style" },
    openGraph: { title, description, url: "/desktour/style" },
  };
}

// スタイルタグのみ表示対象にする
const ALL_SETUP_TAGS = [...STYLE_TAGS];

// タグごとのアイコン（Font Awesome）
const STYLE_ICONS: Record<string, string> = {
  "ミニマル": "fa-solid fa-minus",
  "ゲーミング": "fa-solid fa-gamepad",
  "ナチュラル・北欧": "fa-solid fa-leaf",
  "インダストリアル": "fa-solid fa-gears",
  "かわいい": "fa-solid fa-heart",
  "モノトーン": "fa-solid fa-square",
  "ホワイト": "fa-solid fa-circle",
  "ブラック": "fa-solid fa-circle",
};

// タグごとの説明文
const STYLE_DESCRIPTIONS: Record<string, string> = {
  "ミニマル": "必要最小限のアイテムで構成されたシンプルなセットアップで使用されているガジェットを紹介。",
  "ゲーミング": "RGB照明やゲーミングデバイスで構成されたセットアップで使用されているガジェットを紹介。",
  "ナチュラル・北欧": "木目・自然素材・北欧デザインを取り入れた温かみのあるセットアップで使用されているガジェットを紹介。",
  "インダストリアル": "アイアンや古材を使った無骨なセットアップで使用されているガジェットを紹介。",
  "かわいい": "パステルカラーや可愛いアイテムで構成されたセットアップで使用されているガジェットを紹介。",
  "モノトーン": "白と黒のコントラストで構成されたモダンなセットアップで使用されているガジェットを紹介。",
  "ホワイト": "白を基調とした清潔感のあるセットアップで使用されているガジェットを紹介。",
  "ブラック": "黒で統一されたシックなセットアップで使用されているガジェットを紹介。",
};

export default async function StyleIndexPage() {
  const [stats, setupCounts] = await Promise.all([
    getSiteStats(),
    getSetupTagCounts(),
  ]);

  // 各スタイルの動画・記事数を取得
  const styleCounts = ALL_SETUP_TAGS.map((style) => ({
    style,
    count: setupCounts[style] || 0,
  }));

  // 件数でソート（多い順）、0件は除外
  const sortedStyles = styleCounts
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const listingItems = sortedStyles.map(({ style, count }) => ({
    href: `/desktour/style/${styleTagToSlug(style)}`,
    icon: STYLE_ICONS[style] || "fa-solid fa-palette",
    title: style,
    count,
    description: STYLE_DESCRIPTIONS[style] || "デスクツアーで紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "スタイル別" },
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
        title="スタイル別デスクセットアップ"
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            から、スタイル別に人気のガジェットを掲載。全スタイルの総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介しています。
          </>
        }
        breadcrumbCurrent="スタイル別"
        icon="fa-wand-magic-sparkles"
      />
      <ListingGrid items={listingItems} />
    </>
  );
}
