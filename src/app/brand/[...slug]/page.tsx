import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats, findBrandInDatabase } from "@/lib/supabase";
import {
  inferBrandFromSlug,
  slugToCategory,
  categoryToSlug,
  brandToSlug,
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
  const [brandSlug, categorySlug] = params.slug;

  // スラッグからブランド名を推測し、DBに存在するか確認
  const inferredBrand = inferBrandFromSlug(brandSlug);
  const brand = await findBrandInDatabase(inferredBrand);

  if (!brand) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCategory(categorySlug) : null;

  if (category) {
    return {
      title: `${brand}の${category}人気製品一覧 | デスクツアーDB`,
      description: `${brand}の${category}をデスクツアー動画から分析。実際に使用しているユーザーのコメント付き。`,
    };
  }

  return {
    title: `${brand}のデスク環境でよく使用されている人気製品一覧 | デスクツアーDB`,
    description: `${brand}のデスク環境でよく使用されている人気製品一覧。デスクツアー動画で紹介された${brand}製品をカテゴリ別に確認できます。`,
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

export default async function BrandPage({ params, searchParams }: PageProps) {
  const [brandSlug, categorySlug] = params.slug;

  // スラッグからブランド名を推測し、DBに存在するか確認
  const inferredBrand = inferBrandFromSlug(brandSlug);
  const brand = await findBrandInDatabase(inferredBrand);

  if (!brand) {
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
      brand,
      category,
      sortBy: sort as "mention_count" | "price_asc" | "price_desc",
      limit: 50,
    });

    const pageTitle = `${brand}の${category}人気製品一覧`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: brand, href: `/brand/${brandSlug}` },
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
            から分析した、{brand}の{category}人気製品一覧です。
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
            <Link href={`/brand/${brandSlug}`} className="text-blue-600 hover:underline">
              {brand}の商品一覧へ戻る
            </Link>
          </div>
        )}
      </div>
    );
  }

  // カテゴリなし = ハブページ
  const { products } = await searchProducts({
    brand,
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
      <Breadcrumb items={[{ label: "ブランド別", href: "/brand" }, { label: brand }]} />

      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {brand}のデスク環境でよく使用されている人気製品一覧
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {stats.total_videos}件の
          <Link href="/sources" className="text-blue-600 hover:underline">
            デスクツアー動画・記事
          </Link>
          から分析した、{brand}のデスク環境でよく使用されている人気製品一覧です。
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
                  href={`/brand/${brandSlug}/${categoryToSlug(categoryName)}`}
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
                    adoptionText={`${product.mention_count}回紹介`}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {sortedCategories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 mb-4">{brand}の商品が見つかりませんでした</p>
          <Link href="/" className="text-blue-600 hover:underline">
            トップページへ戻る
          </Link>
        </div>
      )}

      {/* FAQ */}
      {sortedCategories.length > 0 && (
        <section className="mt-20 bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            よくある質問
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">
                {brand}の商品はどのようなソースから収集していますか？
              </h3>
              <p className="text-gray-600 text-sm">
                YouTubeやブログでデスクツアーを公開している方々が実際に使用している{brand}の商品データです。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">
                ランキングの基準は何ですか？
              </h3>
              <p className="text-gray-600 text-sm">
                デスクツアーで紹介された回数を基準にランキングを作成しています。
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
