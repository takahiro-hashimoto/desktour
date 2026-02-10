import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats, findCameraBrandInDatabase } from "@/lib/supabase/queries-camera";
import {
  inferCameraBrandFromSlug,
  slugToCameraCategory,
  cameraCategoryToSlug,
  cameraBrandToSlug,
} from "@/lib/camera/constants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { CategorySection } from "@/components/CategorySection";
import { ProductListSection } from "@/components/ProductListSection";
import { groupByCameraCategory, getCameraCategoryEnglish, sortCameraCategories } from "@/lib/camera/category-utils";

// 1時間キャッシュ
export const revalidate = 3600;

interface PageProps {
  params: { slug: string[] };
  searchParams: { sort?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [brandSlug, categorySlug] = params.slug;

  // スラッグからブランド名を推測し、DBに存在するか確認
  const inferredBrand = inferCameraBrandFromSlug(brandSlug);
  const brand = await findCameraBrandInDatabase(inferredBrand);

  if (!brand) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCameraCategory(categorySlug) : null;

  const slugPath = params.slug.join("/");

  if (category) {
    const title = `撮影機材紹介で人気の${brand}の${category}一覧`;
    const description = `撮影機材紹介動画・記事で実際に使用されている${brand}の${category}を掲載。使用者のコメントと掲載環境を確認できます。`;
    return {
      title,
      description,
      alternates: { canonical: `/camera/brand/${slugPath}` },
      openGraph: { title, description, url: `/camera/brand/${slugPath}` },
    };
  }

  const title = `撮影機材紹介で人気の${brand}の商品一覧`;
  const description = `撮影機材紹介動画・記事で実際に使用されている${brand}の商品をカテゴリ別に掲載。使用者のコメントと掲載環境を確認できます。`;
  return {
    title,
    description,
    alternates: { canonical: `/camera/brand/${slugPath}` },
    openGraph: { title, description, url: `/camera/brand/${slugPath}` },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const [brandSlug, categorySlug] = params.slug;

  // スラッグからブランド名を推測し、DBに存在するか確認
  const inferredBrand = inferCameraBrandFromSlug(brandSlug);
  const brand = await findCameraBrandInDatabase(inferredBrand);

  if (!brand) {
    notFound();
  }

  const category = categorySlug ? slugToCameraCategory(categorySlug) : undefined;

  if (categorySlug && !category) {
    notFound();
  }

  const stats = await getCameraSiteStats();

  // カテゴリが指定されている場合は従来のリストページ
  if (category) {
    const sort = searchParams.sort || "mention_count";
    const { products, total } = await searchCameraProducts({
      brand,
      category,
      sortBy: sort as "mention_count" | "price_asc" | "price_desc",
      limit: 50,
    });

    const pageTitle = `撮影機材紹介で人気の${brand}の${category}一覧`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: brand, href: `/camera/brand/${brandSlug}` },
            { label: category },
          ]}
        />

        {/* タイトルセクション（SEO最適化） */}
        <PageHeader
          title={pageTitle}
          subtitle={
            <>
              {stats.total_videos}件の
              <Link href="/camera/sources" className="text-blue-600 hover:underline">
                撮影機材紹介動画・記事
              </Link>
              で実際に使用されている{brand}の{category}を掲載しています。使用者のコメントと掲載環境を確認できます。
            </>
          }
        />

        <ProductListSection
          products={products}
          total={total}
          sort={sort}
          emptyLinkHref={`/camera/brand/${brandSlug}`}
          emptyLinkText={`${brand}の商品一覧へ戻る`}
        />
      </div>
    );
  }

  // カテゴリなし = ハブページ
  const { products } = await searchCameraProducts({
    brand,
    sortBy: "mention_count",
    limit: 100, // 多めに取得してカテゴリ別にグループ化
  });

  const productsByCategory = groupByCameraCategory(products);
  const sortedCategories = sortCameraCategories(productsByCategory);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "ブランド別", href: "/camera/brand" }, { label: brand }]} />

      {/* Hero Section */}
      <PageHeader
        title={`撮影機材紹介で人気の${brand}の商品一覧`}
        subtitle={
          <>
            {stats.total_videos}件の
            <Link href="/camera/sources" className="text-blue-600 hover:underline">
              撮影機材紹介動画・記事
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
              categoryEnglish={getCameraCategoryEnglish(categoryName)}
              products={categoryProducts}
              viewAllHref={`/camera/brand/${brandSlug}/${cameraCategoryToSlug(categoryName)}`}
              totalCount={categoryProducts.length}
            />
          );
        })}
      </div>

      {sortedCategories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 mb-4">{brand}の商品が見つかりませんでした</p>
          <Link href="/camera" className="text-blue-600 hover:underline">
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
                YouTubeやブログで撮影機材紹介を公開している方々が実際に使用している{brand}の商品データです。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">
                ランキングの基準は何ですか？
              </h3>
              <p className="text-gray-600 text-sm">
                撮影機材紹介で紹介された回数を基準にランキングを作成しています。
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
