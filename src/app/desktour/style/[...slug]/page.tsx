import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSetupTagCounts } from "@/lib/supabase";
import {
  slugToStyleTag,
  slugToCategory,
  categoryToSlug,
  styleTagToSlug,
  STYLE_TAGS,
} from "@/lib/constants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { CategorySection } from "@/components/CategorySection";
import { ProductListSection } from "@/components/ProductListSection";
import { groupByCategory, getCategoryEnglish, sortCategories } from "@/lib/category-utils";

// 1時間キャッシュ
export const revalidate = 3600;

interface PageProps {
  params: { slug: string[] };
  searchParams: { sort?: string };
}

// スタイルタグの英語表記を取得
function getStyleEnglish(style: string): string {
  const mapping: Record<string, string> = {
    "ミニマル": "MINIMAL",
    "ゲーミング": "GAMING",
    "おしゃれ": "STYLISH",
    "ホワイト": "WHITE",
    "ブラック": "BLACK",
    "ナチュラル/木目調": "NATURAL",
    "ケーブルレス/ワイヤレス": "WIRELESS",
  };
  return mapping[style] || style.toUpperCase();
}

// スタイルタグに合わせた自然な日本語タイトルを生成
function getStyleTitle(styleTag: string, category?: string | null): string {
  // 「の」を付けるべきタグ
  const withNo: string[] = [];
  // 「な」を付けるべきタグ
  const withNa = ["ミニマル", "おしゃれ", "ナチュラル", "ナチュラル/木目調", "かわいい"];

  const suffix = category ? category : "ガジェット";

  if (withNo.includes(styleTag)) {
    return `${styleTag}のデスク環境に登場する${suffix}一覧`;
  }
  if (withNa.includes(styleTag)) {
    return `${styleTag}なデスク環境に登場する${suffix}一覧`;
  }
  return `${styleTag}のデスク環境に登場する${suffix}一覧`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [styleSlug, categorySlug] = params.slug;
  const styleTag = slugToStyleTag(styleSlug);

  if (!styleTag) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCategory(categorySlug) : null;

  const slugPath = params.slug.join("/");

  if (category) {
    const title = `${styleTag}スタイルのPCデスク環境で人気の${category}まとめ`;
    const description = `${styleTag}スタイルのデスク環境で実際に使われている${category}を採用数順にランキング。使用者コメント付きで比較できます。`;
    return {
      title,
      description,
      alternates: { canonical: `/desktour/style/${slugPath}` },
      openGraph: { title, description, url: `/desktour/style/${slugPath}` },
    };
  }

  const title = `${styleTag}デスクのおすすめガジェット一覧`;
  const description = `${styleTag}スタイルのデスク環境で実際に使われているガジェットをカテゴリ別にまとめ。使用者のリアルなコメント付きで選び方の参考になります。`;
  return {
    title,
    description,
    alternates: { canonical: `/desktour/style/${slugPath}` },
    openGraph: { title, description, url: `/desktour/style/${slugPath}` },
  };
}

export default async function StylePage({ params, searchParams }: PageProps) {
  const [styleSlug, categorySlug] = params.slug;
  const styleTag = slugToStyleTag(styleSlug);

  if (!styleTag) {
    notFound();
  }

  const category = categorySlug ? slugToCategory(categorySlug) : undefined;

  if (categorySlug && !category) {
    notFound();
  }

  const setupCounts = await getSetupTagCounts();
  const styleSourceCount = setupCounts[styleTag] || 0;

  // カテゴリが指定されている場合は従来のリストページ
  if (category) {
    const sort = searchParams.sort || "mention_count";
    const { products, total } = await searchProducts({
      setupTag: styleTag,
      category,
      sortBy: sort as "mention_count" | "price_asc" | "price_desc",
      limit: 50,
    });

    const pageTitle = `${styleTag}スタイルのPCデスク環境で人気の${category}まとめ`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: styleTag, href: `/desktour/style/${styleSlug}` },
            { label: category },
          ]}
        />

        {/* タイトルセクション（SEO最適化） */}
        <PageHeader
          title={pageTitle}
          subtitle={
            <>
              {total}件の{styleTag}スタイルの<Link href="/desktour/sources" className="text-blue-600 hover:underline">デスクツアー</Link>で実際に使用されている{category}を使用者のコメント付きで紹介。
            </>
          }
        />

        <ProductListSection
          products={products}
          total={total}
          sort={sort}
          emptyLinkHref={`/desktour/style/${styleSlug}`}
          emptyLinkText={`${styleTag}の商品一覧へ戻る`}
        />
      </div>
    );
  }

  // カテゴリなし = ハブページ
  const { products } = await searchProducts({
    setupTag: styleTag,
    sortBy: "mention_count",
    limit: 100, // 多めに取得してカテゴリ別にグループ化
  });

  const productsByCategory = groupByCategory(products);
  const sortedCategories = sortCategories(productsByCategory);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "スタイル別", href: "/desktour/style" }, { label: styleTag }]} />

      {/* Hero Section */}
      <PageHeader
        title={`${styleTag}デスクのおすすめガジェット一覧`}
        subtitle={
          <>
            {styleSourceCount}件の{styleTag}スタイルの
            <Link href="/desktour/sources" className="text-blue-600 hover:underline">
              デスクツアー
            </Link>
            で実際に使われているガジェットをカテゴリ別に掲載。使用者のコメントと掲載環境を確認できます。
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
              viewAllHref={`/desktour/style/${styleSlug}/${categoryToSlug(categoryName)}`}
              totalCount={categoryProducts.length}
              adoptionTextFn={(product) => `${styleTag}デスクで${product.mention_count}件採用`}
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
              「{styleTag}」とはどのようなスタイルですか？
            </h3>
            <p className="text-gray-600 text-sm">
              デスクツアー動画の雰囲気や見た目から、{styleTag}の特徴に該当するセットアップを分類しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">
              スタイルタグはどのように付けられていますか？
            </h3>
            <p className="text-gray-600 text-sm">
              動画内で紹介されているデスクの見た目、配色、雰囲気などを元に自動分類しています。
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

      {/* Other Styles */}
      <section className="mt-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4">他のスタイル</h2>
        <div className="flex flex-wrap gap-2">
          {STYLE_TAGS.filter((tag) => tag !== styleTag).map((tag) => (
            <Link
              key={tag}
              href={`/desktour/style/${styleTagToSlug(tag)}`}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
