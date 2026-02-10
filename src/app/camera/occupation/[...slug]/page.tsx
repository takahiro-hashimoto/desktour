import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats } from "@/lib/supabase/queries-camera";
import {
  slugToCameraOccupation,
  slugToCameraCategory,
  cameraCategoryToSlug,
  CAMERA_PRODUCT_CATEGORIES,
  cameraOccupationToSlug,
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
  const [occupationSlug, categorySlug] = params.slug;
  const occupation = slugToCameraOccupation(occupationSlug);

  if (!occupation) {
    return { title: "Not Found" };
  }

  const category = categorySlug ? slugToCameraCategory(categorySlug) : null;

  const slugPath = params.slug.join("/");

  if (category) {
    const title = `${occupation}の撮影環境で使われている${category}一覧`;
    const description = `撮影機材紹介で${occupation}が実際に使用している${category}を掲載。コメント付きで使用実態を確認できます。`;
    return {
      title,
      description,
      alternates: { canonical: `/camera/occupation/${slugPath}` },
      openGraph: { title, description, url: `/camera/occupation/${slugPath}` },
    };
  }

  const title = `${occupation}の撮影環境で使われている機材一覧`;
  const description = `撮影機材紹介で${occupation}が使用している機材をカテゴリ別に掲載。実際の使用例とコメントを確認できます。`;
  return {
    title,
    description,
    alternates: { canonical: `/camera/occupation/${slugPath}` },
    openGraph: { title, description, url: `/camera/occupation/${slugPath}` },
  };
}

export default async function OccupationPage({ params, searchParams }: PageProps) {
  const [occupationSlug, categorySlug] = params.slug;
  const occupation = slugToCameraOccupation(occupationSlug);

  if (!occupation) {
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
      occupationTag: occupation,
      category,
      sortBy: sort as "mention_count" | "price_asc" | "price_desc",
      limit: 50,
    });

    const pageTitle = `${occupation}の撮影環境で使われている${category}一覧`;

    return (
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: occupation, href: `/camera/occupation/${occupationSlug}` },
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
              から収集した、{occupation}が実際に使用している{category}を掲載しています。使用者のコメントと掲載環境を確認できます。
            </>
          }
        />

        <ProductListSection
          products={products}
          total={total}
          sort={sort}
          emptyLinkHref={`/camera/occupation/${occupationSlug}`}
          emptyLinkText={`${occupation}の商品一覧へ戻る`}
        />
      </div>
    );
  }

  // カテゴリなし = ハブページ
  const { products } = await searchCameraProducts({
    occupationTag: occupation,
    sortBy: "mention_count",
    limit: 100, // 多めに取得してカテゴリ別にグループ化
  });

  const productsByCategory = groupByCameraCategory(products);
  const sortedCategories = sortCameraCategories(productsByCategory);

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: "職業別", href: "/camera/occupation" }, { label: occupation }]} />

      {/* Hero Section */}
      <PageHeader
        title={`${occupation}の撮影環境で使われている機材一覧`}
        subtitle={
          <>
            {stats.total_videos}件の
            <Link href="/camera/sources" className="text-blue-600 hover:underline">
              撮影機材紹介動画・記事
            </Link>
            で{occupation}が実際に使用している機材をカテゴリ別に掲載。使用者のコメントと掲載環境を確認できます。
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
              viewAllHref={`/camera/occupation/${occupationSlug}/${cameraCategoryToSlug(categoryName)}`}
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
              YouTubeやブログで撮影機材紹介を公開している{occupation}の方々が実際に使用している商品データです。
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
              撮影機材紹介で紹介された回数（採用数）を基準にランキングを作成しています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
