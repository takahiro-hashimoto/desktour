import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { STYLE_TAGS, ENVIRONMENT_TAGS, styleTagToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const styleCounts = await Promise.all(
    ALL_SETUP_TAGS.map(async (style) => {
      const { total } = await searchProducts({ setupTag: style, limit: 1 });
      return total > 0 ? 1 : 0;
    })
  );
  const styleCount = styleCounts.reduce((a: number, b: number) => a + b, 0);

  const title = `スタイル別デスクセットアップ一覧【${styleCount}スタイル】`;
  const description = `ミニマリスト・ゲーミング・ホワイトなど${styleCount}スタイルのデスク環境を${totalSources}件のデスクツアーから分析。スタイル別の人気ガジェットを掲載しています。`;

  return {
    title,
    description,
    alternates: { canonical: "/desktour/style" },
    openGraph: { title, description, url: "/desktour/style" },
  };
}

// 全タグ一覧（スタイル + 環境）を表示対象にする
const ALL_SETUP_TAGS = [...STYLE_TAGS, ...ENVIRONMENT_TAGS];

// タグごとのアイコン（Font Awesome）
const STYLE_ICONS: Record<string, string> = {
  // スタイル
  "ミニマリスト": "fa-solid fa-minus",
  "ゲーミング": "fa-solid fa-gamepad",
  "ナチュラル・北欧": "fa-solid fa-leaf",
  "インダストリアル": "fa-solid fa-gears",
  "かわいい": "fa-solid fa-heart",
  "モノトーン": "fa-solid fa-square",
  "ホワイト": "fa-solid fa-circle",
  "ブラック": "fa-solid fa-circle",
  // モニター構成
  "シングルモニター": "fa-solid fa-desktop",
  "デュアルモニター": "fa-solid fa-display",
  "トリプルモニター": "fa-solid fa-display",
  "ウルトラワイド": "fa-solid fa-rectangle-wide",
  // デスク種類
  "通常デスク": "fa-solid fa-table",
  "昇降デスク": "fa-solid fa-arrows-up-down",
  "L字デスク": "fa-solid fa-vector-square",
  // メインOS
  "Mac": "fa-brands fa-apple",
  "Windows": "fa-brands fa-windows",
  "Linux": "fa-brands fa-linux",
  // 特徴
  "リモートワーク": "fa-solid fa-house-laptop",
  "配線整理": "fa-solid fa-plug",
  "クラムシェル": "fa-solid fa-laptop",
  "自作PC": "fa-solid fa-microchip",
  "iPad連携": "fa-solid fa-tablet-screen-button",
  "DIY": "fa-solid fa-screwdriver-wrench",
};

// タグごとの説明文
const STYLE_DESCRIPTIONS: Record<string, string> = {
  // スタイル
  "ミニマリスト": "必要最小限のアイテムで構成されたシンプルなセットアップで使用されているガジェットを紹介。",
  "ゲーミング": "RGB照明やゲーミングデバイスで構成されたセットアップで使用されているガジェットを紹介。",
  "ナチュラル・北欧": "木目・自然素材・北欧デザインを取り入れた温かみのあるセットアップで使用されているガジェットを紹介。",
  "インダストリアル": "アイアンや古材を使った無骨なセットアップで使用されているガジェットを紹介。",
  "かわいい": "パステルカラーや可愛いアイテムで構成されたセットアップで使用されているガジェットを紹介。",
  "モノトーン": "白と黒のコントラストで構成されたモダンなセットアップで使用されているガジェットを紹介。",
  "ホワイト": "白を基調とした清潔感のあるセットアップで使用されているガジェットを紹介。",
  "ブラック": "黒で統一されたシックなセットアップで使用されているガジェットを紹介。",
  // モニター構成
  "シングルモニター": "1台のモニターで構成されたデスク環境で使用されているガジェットを紹介。",
  "デュアルモニター": "2台のモニターを並べたデスク環境で使用されているガジェットを紹介。",
  "トリプルモニター": "3台以上のモニターで構成されたデスク環境で使用されているガジェットを紹介。",
  "ウルトラワイド": "ウルトラワイドモニターを使用したデスク環境で使用されているガジェットを紹介。",
  // デスク種類
  "通常デスク": "一般的なデスクで構成されたデスク環境で使用されているガジェットを紹介。",
  "昇降デスク": "電動・手動昇降デスクを使用した環境で使用されているガジェットを紹介。",
  "L字デスク": "L字型デスクで広い作業スペースを確保した環境で使用されているガジェットを紹介。",
  // メインOS
  "Mac": "Macをメインに使用しているデスク環境で使用されているガジェットを紹介。",
  "Windows": "Windowsをメインに使用しているデスク環境で使用されているガジェットを紹介。",
  "Linux": "Linuxをメインに使用しているデスク環境で使用されているガジェットを紹介。",
  // 特徴
  "リモートワーク": "在宅勤務・テレワーク向けのデスク環境で使用されているガジェットを紹介。",
  "配線整理": "ケーブル管理が行き届いたデスク環境で使用されているガジェットを紹介。",
  "クラムシェル": "ノートPCを閉じた状態で外部モニターに接続するスタイルで使用されているガジェットを紹介。",
  "自作PC": "自作PCを使ったデスク環境で使用されているガジェットを紹介。",
  "iPad連携": "iPadをサブディスプレイや液タブとして活用しているデスク環境のガジェットを紹介。",
  "DIY": "デスク天板やパーツを自作・カスタムしたデスク環境で使用されているガジェットを紹介。",
};

export default async function StyleIndexPage() {
  const stats = await getSiteStats();

  // 各スタイルの商品数を取得
  const styleCounts = await Promise.all(
    ALL_SETUP_TAGS.map(async (style) => {
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
