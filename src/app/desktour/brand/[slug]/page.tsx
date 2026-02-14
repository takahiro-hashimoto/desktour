import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { BRAND_TAGS, brandToSlug, slugToBrand, PRODUCT_CATEGORIES, categoryToSlug, productUrl } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import { FAQSection } from "@/components/detail/FAQSection";
import { generateFAQStructuredData, generateItemListStructuredData } from "@/lib/structuredData";
import "../../../detail-styles.css";
import "../../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string>;
}

// ブランド名を取得
function getBrandFromSlug(slug: string): string | null {
  const brand = slugToBrand(slug);
  return brand && (BRAND_TAGS as readonly string[]).includes(brand) ? brand : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brand = getBrandFromSlug(params.slug);
  if (!brand) return { title: "ブランドが見つかりません" };

  const { total } = await searchProducts({ brand, limit: 1 });

  const title = `${brand}の評判と人気商品一覧【${total}件掲載】`;
  const description = `${brand}の商品を実際にデスク環境で使っている人のリアルな声を集約。カテゴリ別の人気商品と使用者コメントを掲載。【${total}件】`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/brand/${params.slug}` },
    openGraph: { title, description, url: `/desktour/brand/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrandDetailPage({ params }: PageProps) {
  const brand = getBrandFromSlug(params.slug);
  if (!brand) notFound();

  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
        category,
        brand,
        sortBy: "mention_count",
        limit: 3,
      });

      return {
        category,
        products: products.map(formatProductForDisplay),
        total,
      };
    })
  );

  // 商品があるカテゴリーのみ表示
  const filteredCategories = categoryProducts.filter((cat) => cat.products.length > 0);
  const totalBrandProducts = filteredCategories.reduce((sum, cat) => sum + cat.total, 0);

  // 動的FAQ：各カテゴリの1位を集約
  const topByCategory = filteredCategories
    .filter(c => c.products[0])
    .slice(0, 3)
    .map((c, i) => `${i + 1}位: ${c.products[0].name}（${c.category}、${c.products[0].mention_count}件のデスクツアーに登場）`);
  const rankingAnswer = topByCategory.length > 0
    ? topByCategory.join("、") + `。${brand}のデスクガジェットを登場回数順にランキングしています。`
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${brand}で人気のデスクガジェットは何ですか？`, answer: rankingAnswer },
    ...COMMON_FAQ_ITEMS,
  ];
  const faqData = generateFAQStructuredData(allFaqItems);

  // ItemList構造化データ
  const allProducts = filteredCategories.flatMap(c => c.products);
  const itemListData = generateItemListStructuredData(
    allProducts.slice(0, 20).map((p, i) => ({
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title={`${brand}の評判と人気商品一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            に登場した{brand}の商品{totalBrandProducts}件をカテゴリー別に掲載。全ブランドの総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={brand}
        breadcrumbMiddle={{ label: "ブランド別", href: "/desktour/brand" }}
        icon="fa-tag"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>このブランドにはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
          <div key={category} style={{ marginBottom: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
              <Link
                href={`/desktour/brand/${params.slug}/${categoryToSlug(category)}`}
                style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
              </Link>
            </div>
            <ProductGrid products={products} />
          </div>
          ))
        )}

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}
