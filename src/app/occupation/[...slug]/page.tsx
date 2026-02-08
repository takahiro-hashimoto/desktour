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
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { CategorySection } from "@/components/CategorySection";
import { ProductListSection } from "@/components/ProductListSection";
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
      title: `${occupation}のPCデスク環境で使われている${category}一覧`,
      description: `デスクツアーで${occupation}が実際に使用している${category}を掲載。コメント付きで使用実態を確認できます。`,
    };
  }

  return {
    title: `${occupation}のPCデスク環境で使われているガジェット一覧`,
    description: `デスクツアーで${occupation}が使用しているガジェットをカテゴリ別に掲載。実際の使用例とコメントを確認できます。`,
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

    const pageTitle = `${occupation}のPCデスク環境で使われている${category}一覧`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: occupation, href: `/occupation/${occupationSlug}` },
            { label: category },
          ]}
        />

        {/* タイトルセクション（SEO最適化） */}
        <PageHeader
          title={pageTitle}
          subtitle={
            <>
              {stats.total_videos}件の
              <Link href="/sources" className="text-blue-600 hover:underline">
                デスクツアー動画・記事
              </Link>
              から収集した、{occupation}が実際に使用している{category}を掲載しています。使用者のコメントと掲載環境を確認できます。
            </>
          }
        />

        <ProductListSection
          products={products}
          total={total}
          sort={sort}
          emptyLinkHref={`/occupation/${occupationSlug}`}
          emptyLinkText={`${occupation}の商品一覧へ戻る`}
        />
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
      <PageHeader
        title={`${occupation}のPCデスク環境で使われているガジェット一覧`}
        subtitle={
          <>
            {stats.total_videos}件の
            <Link href="/sources" className="text-blue-600 hover:underline">
              デスクツアー動画・記事
            </Link>
            で{occupation}が実際に使用しているガジェットをカテゴリ別に掲載。使用者のコメントと掲載環境を確認できます。
          </>
        }
      />

      {/* Category Sections */}
      <div className="space-y-16">
        {sortedCategories.map((categoryName) => {
          const categoryProducts = productsByCategory[categoryName];
          return (
            <CategorySection
              key={categoryName}
              categoryName={categoryName}
              categoryEnglish={getCategoryEnglish(categoryName)}
              products={categoryProducts}
              viewAllHref={`/occupation/${occupationSlug}/${categoryToSlug(categoryName)}`}
              totalCount={categoryProducts.length}
              adoptionTextFn={(product) => `${product.mention_count}名の${occupation}が採用`}
            />
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
