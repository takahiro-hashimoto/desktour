import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, searchCameraProducts } from "@/lib/supabase/queries-camera";
import { CAMERA_PRODUCT_CATEGORIES, cameraCategoryToSlug, cameraProductUrl } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { generateBreadcrumbStructuredData, generateFAQStructuredData, generateItemListStructuredData } from "@/lib/structuredData";
import { FAQSection } from "@/components/detail/FAQSection";
import { formatProductForDisplay, COMMON_FAQ_ITEMS } from "@/lib/format-utils";
import "../../detail-styles.css";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getCameraSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const title = `撮影機材紹介で人気のカメラ・レンズ・周辺機器まとめ【${totalSources}件分析】`;
  const description = `${totalSources}件のYouTube機材紹介・カバンの中身動画を分析。カメラ・レンズ・アクセサリーなどカテゴリ別に愛用機材をまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/category" },
    openGraph: { title, description, url: "/camera/category", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryIndexPage() {
  const stats = await getCameraSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ4商品を取得
  const categoryProducts = await Promise.all(
    CAMERA_PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchCameraProducts({
        category,
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

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
    { name: "カテゴリ" },
  ]);

  // 動的FAQ：カテゴリ横断の人気商品ランキング（上位3カテゴリの1位を集約）
  const topByCategory = filteredCategories
    .filter(c => c.products[0])
    .slice(0, 3)
    .map((c, i) => `${i + 1}位: ${c.products[0].brand ? c.products[0].brand + " " : ""}${c.products[0].name}（${c.category}、${c.products[0].mention_count}件の撮影機材紹介に登場）`);
  const rankingAnswer = topByCategory.length > 0
    ? topByCategory.join("、") + "。各カテゴリごとに実際のクリエイターが愛用している機材をランキングしています。"
    : "まだデータがありません。";

  const categoryListAnswer = filteredCategories.map(c => `${c.category}（${c.total}件）`).join("、") + "など、幅広い撮影機材カテゴリを掲載しています。";

  const allFaqItems = [
    { question: "撮影機材紹介で最も人気の機材は何ですか？", answer: rankingAnswer },
    { question: "どのような撮影機材カテゴリがありますか？", answer: categoryListAnswer },
    ...COMMON_FAQ_ITEMS,
  ];
  const faqData = generateFAQStructuredData(allFaqItems);

  // ItemList構造化データ：全カテゴリの人気商品
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
      {/* 構造化データ */}
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
        domain="camera"
        label="Database Report"
        title="撮影機材紹介で人気のカメラ・レンズ・周辺機器まとめ"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            からクリエイターの愛用機材をカテゴリー別にまとめています。YouTube機材セットアップの参考にどうぞ。
          </>
        }
        breadcrumbCurrent="カテゴリ"
        icon="fa-layer-group"
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>商品がまだ登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
            <div key={category} style={{ marginBottom: "60px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
                <Link
                  href={`/camera/${cameraCategoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              </div>
              <p style={{ fontSize: "13px", color: "#6e7a8a", marginBottom: "16px", lineHeight: "1.6" }}>
                {category}の人気ランキング（全{total}件）。{products[0] && `1位は${products[0].name}（${products[0].mention_count}件の撮影機材紹介に登場）。`}詳細ページではクリエイターのコメントや引用元の動画・記事がわかります。
              </p>
              <ProductGrid products={products} domain="camera" />
            </div>
          ))
        )}

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}
