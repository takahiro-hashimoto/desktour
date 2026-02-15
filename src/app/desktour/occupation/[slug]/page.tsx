import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getOccupationTagCounts } from "@/lib/supabase";
import { OCCUPATION_TAGS, occupationToSlug, slugToOccupation, PRODUCT_CATEGORIES, categoryToSlug, productUrl } from "@/lib/constants";
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

// 職業名を取得
function getOccupationFromSlug(slug: string): string | null {
  const occupation = slugToOccupation(slug);
  return occupation && (OCCUPATION_TAGS as readonly string[]).includes(occupation) ? occupation : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) return { title: "職業が見つかりません" };

  const occupationCounts = await getOccupationTagCounts();
  const sourceCount = occupationCounts[occupation] || 0;

  const title = `${occupation}のデスク環境で使われているガジェット一覧`;
  const description = `${sourceCount}人の${occupation}が実際に使っているデスク周りガジェットをカテゴリ別にまとめ。${occupation}に人気のおすすめアイテムが一目でわかります。`;

  return {
    title,
    description,
    alternates: { canonical: `/desktour/occupation/${params.slug}` },
    openGraph: { title, description, url: `/desktour/occupation/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function OccupationDetailPage({ params }: PageProps) {
  const occupation = getOccupationFromSlug(params.slug);
  if (!occupation) notFound();

  // 職業タグ別のデスクツアー数を取得
  const occupationCounts = await getOccupationTagCounts();
  const occupationSourceCount = occupationCounts[occupation] || 0;

  // 各カテゴリーごとにトップ4商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
        category,
        occupationTag: occupation,
        sortBy: "mention_count",
        limit: 4,
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

  // 動的FAQ：各カテゴリの1位を集約
  const topByCategory = filteredCategories
    .filter(c => c.products[0])
    .slice(0, 3)
    .map((c, i) => `${i + 1}位: ${c.products[0].brand ? c.products[0].brand + " " : ""}${c.products[0].name}（${c.category}、${c.products[0].mention_count}件のデスクツアーに登場）`);
  const rankingAnswer = topByCategory.length > 0
    ? topByCategory.join("、") + `。${occupation}が愛用しているアイテムを登場回数順にランキングしています。`
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${occupation}に人気のデスクガジェットは何ですか？`, answer: rankingAnswer },
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
        title={`${occupation}のデスク環境で使われているガジェット一覧`}
        description={
          <>
            {occupation}の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            {occupationSourceCount}件で実際に使用されている商品をカテゴリー別に掲載。全職業の総合ランキングは
            <Link href="/desktour/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent={occupation}
        breadcrumbMiddle={{ label: "職業別", href: "/desktour/occupation" }}
        icon="fa-user-tie"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>このカテゴリーにはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
          <div key={category} style={{ marginBottom: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
              <Link
                href={`/desktour/occupation/${params.slug}/${categoryToSlug(category)}`}
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
