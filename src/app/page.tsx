import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Pen, LayoutGrid, Tag } from "lucide-react";
import {
  getSiteStats,
  getProductCountByCategory,
  getOccupationTagCounts,
  getSetupTagCounts,
  getTopProductImages,
  getTopProductByCategory,
  getTopBrandsByProductCount,
} from "@/lib/supabase";
import {
  PRODUCT_CATEGORIES,
  STYLE_TAGS,
  OCCUPATION_TAGS,
  categoryToSlug,
  occupationToSlug,
  styleTagToSlug,
} from "@/lib/constants";
import { HeroSlider } from "@/components/HeroSlider";

// 【最適化】ホームページのデータを5分間キャッシュ
// 統計データは頻繁に変わらないため、キャッシュで高速化
const getCachedHomeData = unstable_cache(
  async () => {
    const [stats, categoryCounts, occupationCounts, setupCounts, productImages, topProducts, topBrands] = await Promise.all([
      getSiteStats(),
      getProductCountByCategory(),
      getOccupationTagCounts(),
      getSetupTagCounts(),
      getTopProductImages(24),
      getTopProductByCategory(),
      getTopBrandsByProductCount(5), // 5件に変更
    ]);
    return { stats, categoryCounts, occupationCounts, setupCounts, productImages, topProducts, topBrands };
  },
  ["home-page-data"],
  { revalidate: 300 } // 5分間キャッシュ
);

// 3カラムカードデータ（職業別・スタイル別）
// 【最適化】Font Awesome → lucide-react に統一（外部CDN削除）
const SECTION_CARD_DATA = {
  occupation: {
    icon: Pen,
    title: "職業別",
    description: "エンジニア、デザイナーなど、同じ職業の人がどんなデスク環境を構築しているか参考にできます。",
  },
  style: {
    icon: LayoutGrid,
    title: "スタイル別",
    description: "ミニマリスト、ゲーミングなど、デスクの雰囲気やテイストから商品を探せます。",
  },
  brand: {
    icon: Tag,
    title: "ブランド別",
    description: "デスクツアーで紹介された商品数が多い人気ブランドから探せます。",
  },
};

// トップページから除外するカテゴリー
const EXCLUDED_CATEGORIES = [
  "タブレット",
  "モニター台",
  "USBハブ",
  "HDD/SSD",
  "ペンタブ",
  "左手デバイス",
  "その他デスクアクセサリー",
];

export default async function HomePage() {
  // 【最適化】キャッシュされたデータを取得
  const { stats, categoryCounts, occupationCounts, setupCounts, productImages, topProducts, topBrands } = await getCachedHomeData();

  // 主要カテゴリ（写真付きで固定表示）
  const mainCategories = [
    "デスク",
    "ディスプレイ/モニター",
    "チェア",
    "キーボード",
    "マウス",
  ];

  // その他のカテゴリ（主要・除外以外を商品数順でソート）
  const subCategories = [...PRODUCT_CATEGORIES]
    .filter((cat) => !mainCategories.includes(cat) && !EXCLUDED_CATEGORIES.includes(cat))
    .sort((a, b) => (categoryCounts[b] || 0) - (categoryCounts[a] || 0));

  // 職業別：OCCUPATION_TAGSに含まれるもののみ、カウント順で上位5件
  const topOccupations = OCCUPATION_TAGS
    .map((label) => ({ label, count: occupationCounts[label] || 0, slug: occupationToSlug(label) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // スタイル別：STYLE_TAGSに含まれるもののみ、カウント順で上位5件
  const topStyles = STYLE_TAGS
    .map((label) => ({ label, count: setupCounts[label] || 0, slug: styleTagToSlug(label) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div>
      {/* Hero Section */}
      <HeroSlider stats={stats} productImages={productImages} />

      <div className="max-w-[1080px] mx-auto px-4 py-12 space-y-12">

        {/* カテゴリセクション - 縦長カード風 */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-900">
              商品カテゴリから探す
            </h2>
            <Link href="/category" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              全て見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            キーボード、マウス、モニターなど、デスク周りの商品をカテゴリ別に閲覧できます。
          </p>

          {/* 主要カテゴリ（縦長カード）- 5つ固定 */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {mainCategories.map((category) => {
              const topProduct = topProducts[category];
              return (
                <Link
                  key={category}
                  href={`/category/${categoryToSlug(category)}`}
                  className="relative aspect-[4/5] rounded overflow-hidden bg-gray-200 group"
                >
                  {/* 背景画像またはグラデーション */}
                  {topProduct?.imageUrl ? (
                    <img
                      src={topProduct.imageUrl}
                      alt={topProduct.name || category}
                      className="absolute inset-0 w-full h-full object-contain bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`absolute inset-0 ${getCategoryGradient(category)}`} />
                  )}
                  {/* オーバーレイ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {/* テキスト */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <div className="font-bold text-sm">{category}</div>
                    <div className="text-xs text-white/80">{categoryCounts[category] || 0}件</div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* サブカテゴリ（タグ風） */}
          <div className="grid grid-cols-4 gap-2">
            {subCategories.map((category) => (
              <Link
                key={category}
                href={`/category/${categoryToSlug(category)}`}
                className="flex justify-between items-center bg-white border border-gray-200 rounded-md px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>{category}</span>
                <span className="text-gray-400 text-xs">{categoryCounts[category] || 0}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 職業別・スタイル別・ブランド別 - 3カラムカード */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 職業別カード */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <SECTION_CARD_DATA.occupation.icon className="w-4 h-4 text-gray-500" />
                <h3 className="text-lg font-extrabold text-gray-900">{SECTION_CARD_DATA.occupation.title}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                {SECTION_CARD_DATA.occupation.description}
              </p>
              <div className="flex flex-col gap-2">
                {topOccupations.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/occupation/${item.slug}`}
                    className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <span>{item.label}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded text-[0.65rem] border border-gray-200">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/occupation"
                className="block mt-4 pt-3 border-t border-gray-200 text-center text-sm text-blue-600 hover:text-blue-700"
              >
                全て見る →
              </Link>
            </div>

            {/* スタイル別カード */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <SECTION_CARD_DATA.style.icon className="w-4 h-4 text-gray-500" />
                <h3 className="text-lg font-extrabold text-gray-900">{SECTION_CARD_DATA.style.title}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                {SECTION_CARD_DATA.style.description}
              </p>
              <div className="flex flex-col gap-2">
                {topStyles.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/style/${item.slug}`}
                    className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <span>{item.label}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded text-[0.65rem] border border-gray-200">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/style"
                className="block mt-4 pt-3 border-t border-gray-200 text-center text-sm text-blue-600 hover:text-blue-700"
              >
                全て見る →
              </Link>
            </div>

            {/* ブランド別カード（動的に上位5件表示） */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <SECTION_CARD_DATA.brand.icon className="w-4 h-4 text-gray-500" />
                <h3 className="text-lg font-extrabold text-gray-900">{SECTION_CARD_DATA.brand.title}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                {SECTION_CARD_DATA.brand.description}
              </p>
              <div className="flex flex-col gap-2">
                {topBrands.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/brand/${item.slug}`}
                    className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <span>{item.brand}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded text-[0.65rem] border border-gray-200">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/brand"
                className="block mt-4 pt-3 border-t border-gray-200 text-center text-sm text-blue-600 hover:text-blue-700"
              >
                全て見る →
              </Link>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="bg-white border border-gray-200 rounded p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            このサイトについて
          </h2>
          <div className="space-y-6 text-sm">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">
                デスクツアーDBとは
              </h3>
              <p className="text-gray-600">
                デスクツアーDBは、YouTubeのデスクツアー動画やブログ記事から、
                実際に使用されている商品情報を収集・整理したデータベースサイトです。
                「この職業の人はどんなキーボードを使っているのか」
                「ミニマリストのデスクにはどんな商品があるのか」といった疑問に、
                データで答えます。
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2">
                データソース
              </h3>
              <p className="text-gray-600 mb-2">
                商品情報は、以下のソースから収集しています：
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>YouTubeのデスクツアー動画（字幕・概要欄から抽出）</li>
                <li>ブログ記事（デスクツアー、使用機材紹介など）</li>
              </ul>
              <p className="text-gray-600 mt-2">
                価格情報はAmazon Product Advertising APIから取得しており、
                実際の販売価格と異なる場合があります。
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2">
                免責事項
              </h3>
              <p className="text-gray-600">
                本サイトは商品の評価やおすすめを行うものではありません。
                掲載情報は事実に基づいたデータの集計結果であり、
                購入を推奨するものではありません。
                商品の購入はご自身の判断でお願いいたします。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// カテゴリごとの背景グラデーション
function getCategoryGradient(category: string): string {
  const gradients: Record<string, string> = {
    "キーボード": "bg-gradient-to-br from-gray-600 to-gray-800",
    "マウス": "bg-gradient-to-br from-blue-500 to-blue-700",
    "ディスプレイ/モニター": "bg-gradient-to-br from-indigo-500 to-purple-600",
    "デスク": "bg-gradient-to-br from-amber-600 to-orange-700",
    "チェア": "bg-gradient-to-br from-green-500 to-teal-600",
    "マイク": "bg-gradient-to-br from-red-500 to-pink-600",
  };
  return gradients[category] || "bg-gradient-to-br from-gray-400 to-gray-600";
}
