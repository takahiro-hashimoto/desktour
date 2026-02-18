import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import {
  PRODUCT_CATEGORIES,
  TYPE_TAGS,
  CATEGORY_FEATURE_TAGS,
  slugToCategory,
  categoryToSlug,
  desktourSubcategoryToSlug,
  productUrl,
} from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData, generateFAQStructuredData, generateItemListStructuredData } from "@/lib/structuredData";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: {
    type?: string;
    sort?: string;
    page?: string;
  };
}

function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCategory(slug);
  return category && PRODUCT_CATEGORIES.includes(category) ? category : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getCategoryFromSlug(params.slug);
  if (!category) return { title: "ページが見つかりません" };

  const { products: topProducts, total } = await searchProducts({ category, sortBy: "mention_count", limit: 1 });
  const topName = topProducts.length > 0 ? topProducts[0].name : null;

  const title = `デスクツアーで人気の${category}まとめ`;
  const description = topName
    ? `${total}件の${category}を使用者データから分析。最も人気は${topName}。実際にデスク環境で使われている${category}を採用数順にランキング。`
    : `実際のデスク環境で使われている${category}を採用数順にランキング。使用者コメント付き。【${total}件掲載】`;
  const canonical = `/desktour/category/${params.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategorySlugPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug);
  if (!category) notFound();

  // ?type= でのアクセスはサブカテゴリURLにリダイレクト
  if (searchParams.type) {
    const subSlug = desktourSubcategoryToSlug(searchParams.type);
    redirect(`/desktour/category/${params.slug}/${subSlug}`);
  }

  const sort = searchParams.sort || "mention";
  const { products, total } = await searchProducts({
    category,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    limit: 200,
  });

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const formattedProducts = products.map(formatProductForDisplay);
  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts)
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  const typeTags = TYPE_TAGS[category] || [];
  const featureTags = CATEGORY_FEATURE_TAGS[category] || [];
  const topProductName = sort === "mention" && products.length > 0 ? products[0].name : null;

  const breadcrumbItems = [
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "カテゴリ一覧", url: "/desktour/category" },
    { name: category },
  ];
  const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbItems);

  // 動的FAQ：人気商品ランキング（上位3件）
  const top3 = products.slice(0, 3);
  const rankingAnswer = top3.length > 0
    ? top3.map((p, i) => `${i + 1}位: ${p.brand ? p.brand + " " : ""}${p.name}（${p.mention_count}件のデスクツアーに登場）`).join("、") + "。実際のクリエイターが使用している商品を登場回数順にランキングしています。"
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${category}ではどんな商品が人気ですか？`, answer: rankingAnswer },
    ...COMMON_FAQ_ITEMS,
  ];
  const faqData = generateFAQStructuredData(allFaqItems);

  // ItemList構造化データ
  const itemListData = generateItemListStructuredData(
    formattedProducts.slice(0, 20).map((p, i) => ({
      name: p.name,
      url: productUrl(p),
      image_url: p.image_url,
      position: i + 1,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`デスクツアーで人気の${category}まとめ`}
        description={
          <>
            {totalSources}件の<Link href="/desktour/sources" className="link">デスクツアー</Link>で実際に使用されている{category}を使用者のコメント付きで紹介。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: "カテゴリ一覧", href: "/desktour/category" }}
        icon={getCategoryIcon(category)}
      />

      <div className="detail-container">
        {(typeTags.length > 0 || featureTags.length > 0) && (
          <div className="detail-filter-section">
            <div className="detail-filter-box">
              <div className="detail-filter-label">
                <i className="fa-solid fa-filter"></i>
                種類別に見る
              </div>
              <div className="detail-filter-tags">
                {typeTags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/desktour/category/${params.slug}/${desktourSubcategoryToSlug(tag)}`}
                    className="detail-filter-tag"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
              {featureTags.length > 0 && (
                <>
                  <div className="detail-filter-label" style={{ marginTop: 12 }}>
                    <i className="fa-solid fa-ruler-combined"></i>
                    スペック別に見る
                  </div>
                  <div className="detail-filter-tags">
                    {featureTags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/desktour/category/${params.slug}/${desktourSubcategoryToSlug(tag)}`}
                        className="detail-filter-tag"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} headingLevel="h2" />

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}
