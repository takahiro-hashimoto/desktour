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
import { getBrandBySlug } from "@/lib/supabase/queries-brands";
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [brandSlug, categorySlug] = params.slug;

  // slug完全一致でブランド検索、未登録はフォールバック
  const brandRow = await getBrandBySlug(brandSlug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferBrandFromSlug(brandSlug);
    return findBrandInDatabase(inferred);
  })();

  if (!brand) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCategory(categorySlug) : null;

  const slugPath = params.slug.join("/");

  if (category) {
    const title = `デスクツアーで人気の${brand} ${category}まとめ`;
    const description = `${brand}の${category}を実際に使っている人の声をもとに採用数順にランキング。使用者コメント付きで比較できます。`;
    return {
      title,
      description,
      alternates: { canonical: `/desktour/brand/${slugPath}` },
      openGraph: { title, description, url: `/desktour/brand/${slugPath}` },
    };
  }

  const title = `${brand}の評判と人気商品一覧`;
  const description = `${brand}の商品を実際にデスク環境で使っている人のリアルな声を集約。カテゴリ別の人気商品と使用者コメントを掲載。`;
  return {
    title,
    description,
    alternates: { canonical: `/desktour/brand/${slugPath}` },
    openGraph: { title, description, url: `/desktour/brand/${slugPath}` },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const [brandSlug, categorySlug] = params.slug;

  // slug完全一致でブランド検索、未登録はフォールバック
  const brandRow = await getBrandBySlug(brandSlug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferBrandFromSlug(brandSlug);
    return findBrandInDatabase(inferred);
  })();

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

    const pageTitle = `デスクツアーで人気の${brand} ${category}まとめ`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: brand, href: `/desktour/brand/${brandSlug}` },
            { label: category },
          ]}
        />

        {/* タイトルセクション（SEO最適化） */}
        <PageHeader
          title={pageTitle}
          subtitle={
            <>
              {total}件の<Link href="/desktour/sources" className="text-blue-600 hover:underline">デスクツアー</Link>で実際に使用されている{brand}の{category}を使用者のコメント付きで紹介。
            </>
          }
        />

        <ProductListSection
          products={products}
          total={total}
          sort={sort}
          emptyLinkHref={`/desktour/brand/${brandSlug}`}
          emptyLinkText={`${brand}の商品一覧へ戻る`}
        />
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
  const sortedCategories = sortCategories(productsByCategory);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "ブランド別", href: "/desktour/brand" }, { label: brand }]} />

      {/* Hero Section */}
      <PageHeader
        title={`${brand}の評判と人気商品一覧`}
        subtitle={
          <>
            {stats.total_videos}件の
            <Link href="/desktour/sources" className="text-blue-600 hover:underline">
              デスクツアー動画・記事
            </Link>
            で実際に使用されている{brand}の商品をカテゴリ別に掲載。使用者のコメントと掲載環境を確認できます。
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
              viewAllHref={`/desktour/brand/${brandSlug}/${categoryToSlug(categoryName)}`}
              totalCount={categoryProducts.length}
            />
          );
        })}
      </div>

      {sortedCategories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 mb-4">{brand}の商品が見つかりませんでした</p>
          <Link href="/desktour" className="text-blue-600 hover:underline">
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
