import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { OCCUPATION_TAGS, slugToOccupation, slugToCategory, PRODUCT_CATEGORIES, SUBCATEGORIES } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string; category: string };
  searchParams: {
    subcategory?: string;
    sort?: string;
    page?: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const occupation = slugToOccupation(params.slug);
  const category = slugToCategory(params.category);

  if (!OCCUPATION_TAGS.includes(occupation) || !PRODUCT_CATEGORIES.includes(category)) {
    return { title: "ページが見つかりません" };
  }

  return {
    title: `${occupation}が使用している${category}一覧 | デスクツアーDB`,
    description: `${occupation}が実際に使用している${category}を、使用者のコメント付きでまとめています。`,
  };
}

export default async function OccupationCategoryPage({ params, searchParams }: PageProps) {
  const occupation = slugToOccupation(params.slug);
  const category = slugToCategory(params.category);

  if (!OCCUPATION_TAGS.includes(occupation) || !PRODUCT_CATEGORIES.includes(category)) {
    notFound();
  }

  const subcategoryFilter = searchParams.subcategory;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  const { products, total } = await searchProducts({
    category,
    occupationTag: occupation,
    subcategory: subcategoryFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const formattedProducts = products.map((product) => ({
    id: product.id || "",
    asin: product.asin,
          slug: product.slug,
    name: product.name,
    brand: product.brand,
    image_url: product.amazon_image_url,
    amazon_url: product.amazon_url,
    rakuten_url: product.rakuten_url,
    price: product.amazon_price,
    price_updated_at: product.updated_at,
    mention_count: product.mention_count,
    user_comment: product.comments?.[0]?.comment,
  }));

  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  const subcategories = SUBCATEGORIES[category] || [];

  const faqItems = [
    {
      question: "このデータはどこから収集していますか？",
      answer: "YouTubeのデスクツアー動画およびブログ記事から、実際に使用されている商品情報を収集しています。",
    },
    {
      question: "「使用者数」とは何ですか？",
      answer: "その商品を使用しているデスクツアーの数を示しています。",
    },
    {
      question: "価格情報は正確ですか？",
      answer: "価格情報はAmazon Product Advertising APIから取得しており、実際の販売価格と異なる場合があります。購入の際はリンク先で最新の価格をご確認ください。",
    },
  ];

  return (
    <>
      <PageHeaderSection
        label="Database Report"
        title={`${occupation}が使用している${category}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/sources" className="link">
              デスクツアー動画
            </Link>
            ・
            <Link href="/sources" className="link">
              記事
            </Link>
            で{occupation}が実際に使用している{category}を、使用者のコメント付きでまとめています。デスク環境構築の参考にご活用ください。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: occupation, href: `/occupation/${params.slug}` }}
      />

      <div className="detail-container">
        {subcategories.length > 0 && (
          <FilterSection
            label="種類別に絞り込み"
            filterKey="subcategory"
            tags={subcategories}
            currentFilter={subcategoryFilter}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} />

        <FAQSection items={faqItems} />
      </div>
    </>
  );
}
