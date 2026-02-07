import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, supabase } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, SUBCATEGORIES, categoryToSlug } from "@/lib/constants";
import { Breadcrumb } from "@/components/Breadcrumb";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "商品カテゴリー一覧 | デスクツアーDB",
  description: "キーボード、マウス、モニター、デスク、チェアなどカテゴリー別にデスクツアーで紹介された商品を確認できます。",
};

// カテゴリーごとのアイコン
const CATEGORY_ICONS: Record<string, string> = {
  "キーボード": "⌨️",
  "マウス": "🖱️",
  "ディスプレイ/モニター": "🖥️",
  "デスク": "🪑",
  "チェア": "💺",
  "マイク": "🎙️",
  "ウェブカメラ": "📷",
  "ヘッドホン/イヤホン": "🎧",
  "スピーカー": "🔊",
  "照明・ライト": "💡",
  "PCスタンド/ノートPCスタンド": "📱",
  "モニターアーム": "🦾",
  "モニター台": "📺",
  "ケーブル/ハブ": "🔌",
  "USBハブ": "🔌",
  "デスクマット": "🖼️",
  "収納/整理": "📦",
  "PC本体": "💻",
  "タブレット": "📱",
  "ペンタブ": "✏️",
  "充電器/電源": "🔋",
  "オーディオインターフェース": "🎛️",
  "ドッキングステーション": "🔗",
  "左手デバイス": "🎮",
  "HDD/SSD": "💾",
  "その他デスクアクセサリー": "🧩",
};

// カテゴリーごとの説明文
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "キーボード": "タイピングの快適さと生産性を左右する重要なデバイス。",
  "マウス": "作業効率を上げるポインティングデバイス。",
  "ディスプレイ/モニター": "作業領域を広げる大画面・高解像度ディスプレイ。",
  "デスク": "作業の土台となるワークスペース。",
  "チェア": "長時間の作業を支える快適なオフィスチェア。",
  "マイク": "会議や配信で活躍する高音質マイク。",
  "ウェブカメラ": "オンライン会議や配信に必須のカメラ。",
  "ヘッドホン/イヤホン": "集中力を高める高品質オーディオ。",
  "スピーカー": "デスクで楽しむ高音質サウンド。",
  "照明・ライト": "デスク周りを照らすライティング。",
  "PCスタンド/ノートPCスタンド": "姿勢改善と放熱に効果的なスタンド。",
  "モニターアーム": "モニターを自由に配置できるアーム。",
  "モニター台": "モニターの高さ調整と収納を兼ねた台。",
  "ケーブル/ハブ": "デバイス接続と配線整理。",
  "USBハブ": "ポート拡張でデバイス接続を便利に。",
  "デスクマット": "デスクを保護し作業を快適に。",
  "収納/整理": "デスク周りをすっきり整理。",
  "PC本体": "作業の中心となるコンピュータ。",
  "タブレット": "サブディスプレイやメモに活躍。",
  "ペンタブ": "イラストやデザイン作業に必須。",
  "充電器/電源": "デバイスの電源供給。",
  "オーディオインターフェース": "高品質な音声入出力。",
  "ドッキングステーション": "ノートPCの拡張性を高める。",
  "左手デバイス": "ショートカットを効率化。",
  "HDD/SSD": "データ保存とバックアップ。",
  "その他デスクアクセサリー": "デスクをより便利に。",
};

interface CategoryWithCount {
  category: string;
  count: number;
}

export default async function CategoryIndexPage() {
  const stats = await getSiteStats();

  // DBから各カテゴリの商品数を取得
  const { data: categoryCounts } = await supabase
    .from("products")
    .select("category");

  // カテゴリごとの商品数をカウント
  const categoryCountMap = new Map<string, number>();
  for (const item of categoryCounts || []) {
    if (item.category) {
      categoryCountMap.set(item.category, (categoryCountMap.get(item.category) || 0) + 1);
    }
  }

  // PRODUCT_CATEGORIESに登録されているカテゴリの情報を取得
  const categories: CategoryWithCount[] = PRODUCT_CATEGORIES.map((category) => ({
    category,
    count: categoryCountMap.get(category) || 0,
  }));

  // 商品数でソート（多い順）、0件は除外
  const sortedCategories = [...categories]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "カテゴリー" }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          商品カテゴリー一覧
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件のデスクツアー動画から、{PRODUCT_CATEGORIES.length}種類のカテゴリー別に商品を分析しました。
          探している商品カテゴリーを選択してください。
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCategories.map(({ category, count }) => (
          <Link
            key={category}
            href={`/category/${categoryToSlug(category)}`}
            className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {CATEGORY_ICONS[category] || "📦"}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {category}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {count}件
                  </span>
                </div>
              </div>
            </div>
            {SUBCATEGORIES[category] && SUBCATEGORIES[category].length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {SUBCATEGORIES[category].slice(0, 2).map((sub) => (
                  <span
                    key={sub}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-3 line-clamp-2">
              {CATEGORY_DESCRIPTIONS[category] || "デスクツアーで紹介された商品一覧"}
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
              商品情報はどこから収集していますか？
            </h3>
            <p className="text-gray-600 text-sm">
              YouTubeのデスクツアー動画やブログ記事から、実際に使用されている商品情報を収集しています。
              動画内の説明や概要欄のリンクから商品を特定しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              カテゴリーはどのように分類されていますか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスク周りで使用される商品を{PRODUCT_CATEGORIES.length}のカテゴリーに分類しています。
              一部のカテゴリーにはサブカテゴリーがあり、より詳細な絞り込みが可能です。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              「使用者数」とは何ですか？
            </h3>
            <p className="text-gray-600 text-sm">
              その商品がデスクツアーで紹介された回数を示しています。
              多くの人に選ばれている商品ほど使用者数が多くなります。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
