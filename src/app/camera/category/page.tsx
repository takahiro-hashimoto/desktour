import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, searchCameraProducts } from "@/lib/supabase/queries-camera";
import { CAMERA_PRODUCT_CATEGORIES, cameraCategoryToSlug } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import { formatProductForDisplay } from "@/lib/format-utils";
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

  return (
    <>
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
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
      </div>
    </>
  );
}
