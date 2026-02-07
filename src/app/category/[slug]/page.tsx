import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { slugToCategory, SUBCATEGORIES } from "@/lib/constants";
import { SortSelect } from "@/components/SortSelect";
import { SubcategoryFilter } from "@/components/SubcategoryFilter";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumb } from "@/components/Breadcrumb";

interface PageProps {
  params: { slug: string };
  searchParams: { sort?: string; subcategory?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = slugToCategory(params.slug);
  if (!category) {
    return { title: "Not Found" };
  }

  return {
    title: `デスク環境構築におすすめの${category} | デスクツアーDB`,
    description: `デスク環境構築におすすめの${category}。実際に使用しているユーザーのコメント付き。`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const category = slugToCategory(params.slug);

  if (!category) {
    notFound();
  }

  const sort = searchParams.sort || "mention_count";
  const subcategory = searchParams.subcategory;

  // このカテゴリのサブカテゴリ一覧を取得
  const subcategories = SUBCATEGORIES[category] || [];

  const { products, total } = await searchProducts({
    category,
    subcategory,
    sortBy: sort as "mention_count" | "price_asc" | "price_desc",
    limit: 50,
  });

  const stats = await getSiteStats();

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: "商品カテゴリー", href: "/category" }, { label: category }]} />

      {/* タイトルセクション（SEO最適化） */}
      <div className="mb-8">
        <p className="text-sm text-blue-600 font-medium tracking-wider mb-2">
          DATABASE REPORT
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          デスク環境構築におすすめの{category}
        </h1>
        <p className="text-gray-600">
          {stats.total_videos}件の
          <Link href="/sources" className="text-blue-600 hover:underline">
            デスクツアー動画・記事
          </Link>
          から分析した、デスク環境でよく使用されている{category}一覧です。
        </p>
      </div>

      {/* サブカテゴリフィルター */}
      {subcategories.length > 0 && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <SubcategoryFilter
            subcategories={subcategories}
            currentSubcategory={subcategory}
          />
        </div>
      )}

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
          <Link href="/" className="text-blue-600 hover:underline">
            トップページへ戻る
          </Link>
        </div>
      )}

      {/* FAQ */}
      <section className="mt-12 bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          よくある質問
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">
              このデータはどこから収集していますか？
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              YouTubeのデスクツアー動画およびブログ記事から、実際に使用されている商品情報を収集しています。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">
              「使用者数」とは何ですか？
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              その商品を使用しているデスクツアーの数を示しています。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
