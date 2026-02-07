import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { OCCUPATION_TAGS, occupationToSlug } from "@/lib/constants";
import { Breadcrumb } from "@/components/Breadcrumb";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "職業別デスクセットアップ一覧 | デスクツアーDB",
  description: "エンジニア、デザイナー、クリエイターなど職業別にデスクツアーで紹介された商品を確認できます。各職業に最適なガジェットや周辺機器がわかります。",
};

// 職業ごとのアイコン
const OCCUPATION_ICONS: Record<string, string> = {
  "エンジニア": "💻",
  "デザイナー": "🎨",
  "クリエイター": "🎬",
  "イラストレーター": "✏️",
  "配信者": "🎙️",
  "ゲーマー": "🎮",
  "学生": "📚",
  "会社員": "💼",
  "経営者": "👔",
  "フォトグラファー": "📷",
};

// 職業ごとの説明文
const OCCUPATION_DESCRIPTIONS: Record<string, string> = {
  "エンジニア": "プログラミング作業を多くこなすエンジニアがよく使っているガジェットを紹介。",
  "デザイナー": "グラフィックやUIデザインを手がけるデザイナーがよく使っているガジェットを紹介。",
  "クリエイター": "動画編集やコンテンツ制作を行うクリエイターがよく使っているガジェットを紹介。",
  "イラストレーター": "デジタルイラストを描くイラストレーターがよく使っているガジェットを紹介。",
  "配信者": "ライブ配信やストリーミングを行う配信者がよく使っているガジェットを紹介。",
  "ゲーマー": "ゲームプレイを楽しむゲーマーがよく使っているガジェットを紹介。",
  "学生": "学習や課題制作に取り組む学生がよく使っているガジェットを紹介。",
  "会社員": "在宅ワークやリモートワークをする会社員がよく使っているガジェットを紹介。",
  "経営者": "ビジネスの意思決定を行う経営者がよく使っているガジェットを紹介。",
  "フォトグラファー": "写真撮影や編集を行うフォトグラファーがよく使っているガジェットを紹介。",
};

export default async function OccupationIndexPage() {
  const stats = await getSiteStats();

  // 各職業の商品数を取得
  const occupationCounts = await Promise.all(
    OCCUPATION_TAGS.map(async (occupation) => {
      const { total } = await searchProducts({
        occupationTag: occupation,
        limit: 1,
      });
      return { occupation, count: total };
    })
  );

  // 商品数でソート（多い順）、0件は除外
  const sortedOccupations = occupationCounts
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "職業別" }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          職業別デスクセットアップ
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件のデスクツアー動画から、{OCCUPATION_TAGS.length}種類の職業別に最適なガジェットを分析しました。
          あなたの職業に合ったデスク環境を見つけましょう。
        </p>
      </div>

      {/* Occupation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedOccupations.map(({ occupation, count }) => (
          <Link
            key={occupation}
            href={`/occupation/${occupationToSlug(occupation)}`}
            className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {OCCUPATION_ICONS[occupation] || "👤"}
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {occupation}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {count}件の商品
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3 line-clamp-2">
              {OCCUPATION_DESCRIPTIONS[occupation] || "デスクツアーで紹介された商品一覧"}
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
              職業はどのように判定していますか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアー動画やブログの自己紹介、概要欄などに記載されている情報を元に分類しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              自分の職業がない場合はどうすればいいですか？
            </h3>
            <p className="text-gray-600 text-sm">
              現在は{OCCUPATION_TAGS.length}種類の職業カテゴリを用意しています。
              近い職業のカテゴリを参考にするか、スタイル別やカテゴリ別から探すことをおすすめします。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              ランキングの基準は何ですか？
            </h3>
            <p className="text-gray-600 text-sm">
              各職業のデスクツアーで紹介された回数を基準にランキングを作成しています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
