import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSiteStats, findCameraBrandInDatabase } from "@/lib/supabase/queries-camera";
import { CAMERA_PRODUCT_CATEGORIES, cameraCategoryToSlug, cameraProductUrl, inferCameraBrandFromSlug } from "@/lib/camera/constants";
import { getBrandBySlug } from "@/lib/supabase/queries-brands";
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const brandRow = await getBrandBySlug(params.slug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferCameraBrandFromSlug(params.slug);
    return findCameraBrandInDatabase(inferred);
  })();
  if (!brand) return { title: "ブランドが見つかりません" };

  const { total } = await searchCameraProducts({ brand, limit: 1 });

  const title = `撮影機材紹介で人気の${brand}の商品一覧`;
  const description = `撮影機材紹介に登場した${brand}の商品をカテゴリ別にまとめました。口コミ付き。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/brand/${params.slug}` },
    openGraph: { title, description, url: `/camera/brand/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrandDetailPage({ params }: PageProps) {
  const brandRow = await getBrandBySlug(params.slug);
  const brand = brandRow?.name ?? await (async () => {
    const inferred = inferCameraBrandFromSlug(params.slug);
    return findCameraBrandInDatabase(inferred);
  })();
  if (!brand) notFound();

  const stats = await getCameraSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    CAMERA_PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchCameraProducts({
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
    .map((c, i) => `${i + 1}位: ${c.products[0].name}（${c.category}、${c.products[0].mention_count}件の撮影機材紹介に登場）`);
  const rankingAnswer = topByCategory.length > 0
    ? topByCategory.join("、") + `。${brand}の撮影機材を登場回数順にランキングしています。`
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${brand}で人気の撮影機材は何ですか？`, answer: rankingAnswer },
    ...COMMON_FAQ_ITEMS,
  ];
  const faqData = generateFAQStructuredData(allFaqItems);

  // ItemList構造化データ
  const allProducts = filteredCategories.flatMap(c => c.products);
  const itemListData = generateItemListStructuredData(
    allProducts.slice(0, 20).map((p, i) => ({
      name: p.name,
      url: cameraProductUrl(p),
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
        domain="camera"
        label="Database Report"
        title={`撮影機材紹介で人気の${brand}の商品一覧`}
        description={
          <>
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            に登場した{brand}の商品をカテゴリ別にまとめました。口コミ付き。
          </>
        }
        breadcrumbCurrent={brand}
        breadcrumbMiddle={{ label: "ブランド別", href: "/camera/brand" }}
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
                href={`/camera/brand/${params.slug}/${cameraCategoryToSlug(category)}`}
                style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
              >
                全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
              </Link>
            </div>
            <ProductGrid products={products} domain="camera" headingLevel="h3" />
          </div>
          ))
        )}

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}
