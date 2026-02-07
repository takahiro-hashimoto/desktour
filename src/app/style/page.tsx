import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { STYLE_TAGS, styleTagToSlug } from "@/lib/constants";
import { Breadcrumb } from "@/components/Breadcrumb";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "スタイル別デスクセットアップ一覧 | デスクツアーDB",
  description: "ミニマリスト、ゲーミング、おしゃれ、ホワイト、ブラックなどスタイル別にデスクツアーで紹介された商品を確認できます。",
};

// スタイルごとのアイコン
const STYLE_ICONS: Record<string, string> = {
  "ミニマリスト": "✨",
  "ゲーミング": "🎮",
  "おしゃれ": "💫",
  "ホワイト": "🤍",
  "ブラック": "🖤",
  "モノトーン": "⬛",
  "ナチュラル": "🌿",
  "北欧風": "🏔️",
  "インダストリアル": "⚙️",
  "かわいい": "🎀",
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

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "スタイル別" }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          スタイル別デスクセットアップ
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件のデスクツアー動画から、{STYLE_TAGS.length}種類のスタイル別に商品を分析しました。
          あなたの好みに合ったデスク環境を見つけましょう。
        </p>
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedStyles.map(({ style, count }) => (
          <Link
            key={style}
            href={`/style/${styleTagToSlug(style)}`}
            className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {STYLE_ICONS[style] || "🖥️"}
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {style}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {count}件の商品
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3 line-clamp-2">
              {STYLE_DESCRIPTIONS[style] || "デスクツアーで紹介された商品一覧"}
            </p>
            <div className="mt-3 flex items-center text-sm text-blue-600 group-hover:text-blue-700">
              詳細を見る
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* FAQ Section */}
      <section className="mt-20 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          よくある質問
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              スタイルはどのように判定していますか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアー動画やブログの内容、デスクの見た目や配色を元に自動分類しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              同じ商品が複数のスタイルに含まれることはありますか？
            </h3>
            <p className="text-gray-600 text-sm">
              はい、同じ商品が異なるスタイルのデスクで使われている場合があります。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              ランキングの基準は何ですか？
            </h3>
            <p className="text-gray-600 text-sm">
              各スタイルのデスクツアーで紹介された回数を基準にランキングを作成しています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
