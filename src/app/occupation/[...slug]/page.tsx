import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import {
  slugToOccupation,
  slugToCategory,
  categoryToSlug,
  PRODUCT_CATEGORIES,
  occupationToSlug,
} from "@/lib/constants";
import { SortSelect } from "@/components/SortSelect";
import { ProductCard } from "@/components/ProductCard";
import { RankingProductCard } from "@/components/RankingProductCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import type { ProductWithStats } from "@/types";

// 1時間キャッシュ
export const revalidate = 3600;

interface PageProps {
  params: { slug: string[] };
  searchParams: { sort?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [occupationSlug, categorySlug] = params.slug;
  const occupation = slugToOccupation(occupationSlug);

  if (!occupation) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCategory(categorySlug) : null;

  if (category) {
    return {
      title: `${occupation}のデスク環境でよく使用されている${category}一覧 | デスクツアーDB`,
      description: `${occupation}がデスクツアーで紹介した${category}の一覧。実際に使用しているユーザーのコメント付き。`,
    };
  }

  return {
    title: `${occupation}のデスク環境でよく使用されているガジェット一覧 | デスクツアーDB`,
    description: `${occupation}がデスクツアーで紹介した商品の一覧。カテゴリ別ランキングで人気商品がわかります。`,
  };
}

// カテゴリ別にグループ化するヘルパー関数
function groupByCategory(products: ProductWithStats[]): Record<string, ProductWithStats[]> {
  const grouped: Record<string, ProductWithStats[]> = {};

  for (const product of products) {
    const category = product.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(product);
  }

  return grouped;
}

// カテゴリ名の英語表記を取得
function getCategoryEnglish(category: string): string {
  const mapping: Record<string, string> = {
    "キーボード": "KEYBOARDS",
    "マウス": "MICE",
    "ディスプレイ/モニター": "MONITORS",
    "デスク": "DESKS",
    "チェア": "CHAIRS",
    "マイク/オーディオ": "AUDIO",
    "照明": "LIGHTING",
    "PCスタンド/アーム": "STANDS",
    "ケーブル/ハブ": "CABLES",
    "デスクアクセサリー": "ACCESSORIES",
    "ヘッドホン/イヤホン": "HEADPHONES",
    "Webカメラ": "WEBCAMS",
    "スピーカー": "SPEAKERS",
    "その他": "OTHERS",
  };
  return mapping[category] || category.toUpperCase();
}

export default async function OccupationPage({ params, searchParams }: PageProps) {
  const [occupationSlug, categorySlug] = params.slug;
  const occupation = slugToOccupation(occupationSlug);

  if (!occupation) {
    notFound();
  }

  const category = categorySlug ? slugToCategory(categorySlug) : undefined;

  if (categorySlug && !category) {
    notFound();
  }

  const stats = await getSiteStats();

  // カテゴリが指定されている場合は従来のリストページ
  if (category) {
    const sort = searchParams.sort || "mention_count";
    const { products, total } = await searchProducts({
      occupationTag: occupation,
      category,
      sortBy: sort as "mention_count" | "price_asc" | "price_desc",
      limit: 50,
    });

    const pageTitle = `${occupation}のデスク環境でよく使用されている${category}一覧`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: occupation, href: `/occupation/${occupationSlug}` },
            { label: category },
          ]}
        />

        {/* タイトルセクション（SEO最適化） */}
        <div className="mb-8">
          <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
            DATABASE REPORT
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {pageTitle}
          </h1>
          <p className="text-gray-600">
            {stats.total_videos}件の
            <Link href="/sources" className="text-blue-600 hover:underline">
              デスクツアー動画・記事
            </Link>
            から分析した、{occupation}に実際に選ばれている{category}一覧です。
          </p>
        </div>

        {/* Sort */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">表示件数：{total}件</p>
          <SortSelect defaultValue={sort} />
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} maxComments={1} />
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 mb-4">該当する商品がありません</p>
            <Link href={`/occupation/${occupationSlug}`} className="text-blue-600 hover:underline">
              {occupation}の商品一覧へ戻る
            </Link>
          </div>
        )}
      </div>
    );
  }

  // カテゴリなし = ハブページ
  const { products } = await searchProducts({
    occupationTag: occupation,
    sortBy: "mention_count",
    limit: 100, // 多めに取得してカテゴリ別にグループ化
  });

  const productsByCategory = groupByCategory(products);

  // カテゴリの優先順序（主要カテゴリから表示）
  const CATEGORY_PRIORITY = [
    "キーボード",
    "マウス",
    "ディスプレイ/モニター",
    "デスク",
    "チェア",
    "マイク/オーディオ",
    "ヘッドホン/イヤホン",
    "Webカメラ",
    "スピーカー",
    "照明",
    "PCスタンド/アーム",
    "ケーブル/ハブ",
    "デスクアクセサリー",
    "その他",
  ];

  // 優先順序に従ってソート（存在するカテゴリのみ + 定義外は末尾）
  const sortedCategories = [
    ...CATEGORY_PRIORITY.filter((cat) => productsByCategory[cat]),
    ...Object.keys(productsByCategory).filter((cat) => !CATEGORY_PRIORITY.includes(cat)),
  ];

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "職業別", href: "/occupation" }, { label: occupation }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          {occupation}のデスク環境でよく使用されているガジェット一覧
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件の
          <Link href="/sources" className="text-blue-600 hover:underline">
            デスクツアー動画・記事
          </Link>
          から分析した、{occupation}に実際に選ばれているガジェット一覧です。
        </p>
      </div>

      {/* Category Sections */}
      <div className="space-y-16">
        {sortedCategories.map((categoryName) => {
          const categoryProducts = productsByCategory[categoryName];
          const top3 = categoryProducts.slice(0, 3);
          const totalInCategory = categoryProducts.length;

          return (
            <section key={categoryName}>
              {/* Category Header */}
              <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {getCategoryEnglish(categoryName)}
                  </h2>
                  <span className="text-sm text-gray-500">{categoryName}</span>
                </div>
                <Link
                  href={`/occupation/${occupationSlug}/${categoryToSlug(categoryName)}`}
                  className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
                >
                  View All
                  <span className="text-gray-400">({totalInCategory}件)</span>
                  <svg
                    className="w-4 h-4"
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
                </Link>
              </div>

              {/* Top 3 Products */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {top3.map((product, index) => (
                  <RankingProductCard
                    key={product.id}
                    product={product}
                    rank={index + 1}
                    adoptionText={`${product.mention_count}名の${occupation}が採用`}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* FAQ */}
      <section className="mt-20 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          よくある質問
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              どのような{occupation}のデータですか？
            </h3>
            <p className="text-gray-600 text-sm">
              YouTubeやブログでデスクツアーを公開している{occupation}の方々が実際に使用している商品データです。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              職業はどのように判定していますか？
            </h3>
            <p className="text-gray-600 text-sm">
              動画やブログの自己紹介、概要欄などに記載されている情報を元に分類しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              ランキングの基準は何ですか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアーで紹介された回数（採用数）を基準にランキングを作成しています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
