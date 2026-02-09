import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { STYLE_TAGS, styleTagToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "スタイル別デスクセットアップ一覧",
  description: "ミニマリスト、ゲーミング、おしゃれ、ホワイト、ブラックなどスタイル別にデスクツアーで紹介された商品を確認できます。",
  alternates: { canonical: "/style" },
  openGraph: {
    title: "スタイル別デスクセットアップ一覧",
    description: "ミニマリスト、ゲーミング、おしゃれ、ホワイト、ブラックなどスタイル別にデスクツアーで紹介された商品を確認できます。",
    url: "/style",
  },
};

// スタイルごとのアイコン（Font Awesome）
const STYLE_ICONS: Record<string, string> = {
  "ミニマリスト": "fa-solid fa-minus",
  "ゲーミング": "fa-solid fa-gamepad",
  "おしゃれ": "fa-solid fa-wand-magic-sparkles",
  "ホワイト": "fa-solid fa-circle",
  "ブラック": "fa-solid fa-circle",
  "モノトーン": "fa-solid fa-square",
  "ナチュラル": "fa-solid fa-leaf",
  "北欧風": "fa-solid fa-mountain",
  "インダストリアル": "fa-solid fa-gears",
  "かわいい": "fa-solid fa-heart",
};

// スタイルごとの説明文
const STYLE_DESCRIPTIONS: Record<string, string> = {
  "ミニマリスト": "必要最小限のアイテムで構成されたシンプルなセットアップで使用されているガジェットを紹介。",
  "ゲーミング": "RGB照明やゲーミングデバイスで構成されたセットアップで使用されているガジェットを紹介。",
  "おしゃれ": "インテリアとしても美しいデザイン性の高いセットアップで使用されているガジェットを紹介。",
  "ホワイト": "白を基調とした清潔感のあるセットアップで使用されているガジェットを紹介。",
  "ブラック": "黒で統一されたシックなセットアップで使用されているガジェットを紹介。",
  "モノトーン": "白と黒のコントラストで構成されたモダンなセットアップで使用されているガジェットを紹介。",
  "ナチュラル": "木目調や自然素材を取り入れた温かみのあるセットアップで使用されているガジェットを紹介。",
  "北欧風": "シンプルで機能的な北欧デザインのセットアップで使用されているガジェットを紹介。",
  "インダストリアル": "アイアンや古材を使った無骨なセットアップで使用されているガジェットを紹介。",
  "かわいい": "パステルカラーや可愛いアイテムで構成されたセットアップで使用されているガジェットを紹介。",
};

export default async function StyleIndexPage() {
  const stats = await getSiteStats();

  // 各スタイルの商品数を取得
  const styleCounts = await Promise.all(
    STYLE_TAGS.map(async (style) => {
      const { total } = await searchProducts({
        setupTag: style,
        limit: 1,
      });
      return { style, count: total };
    })
  );

  // 商品数でソート（多い順）、0件は除外
  const sortedStyles = styleCounts
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const listingItems = sortedStyles.map(({ style, count }) => ({
    href: `/style/${styleTagToSlug(style)}`,
    icon: STYLE_ICONS[style] || "fa-solid fa-palette",
    title: style,
    count,
    description: STYLE_DESCRIPTIONS[style] || "デスクツアーで紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "ホーム", url: "/" },
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
            <Link href="/sources" className="link">
              デスクツアー
            </Link>
            から、スタイル別に人気のガジェットを掲載。全スタイルの総合ランキングは
            <Link href="/category" className="link">
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
