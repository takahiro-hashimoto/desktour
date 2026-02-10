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

  const title = `撮影機材紹介に登場した撮影機材【${totalSources}件分析】`;
  const description = `${totalSources}件の撮影機材紹介を分析し、カメラ・レンズ・マイクなどカテゴリー別に人気商品をまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/category" },
    openGraph: { title, description, url: "/camera/category", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// カテゴリーごとのアイコン（Font Awesome）
const CATEGORY_ICONS: Record<string, string> = {
  "カメラ本体": "fa-solid fa-camera",
  "レンズ": "fa-solid fa-circle-dot",
  "三脚": "fa-solid fa-maximize",
  "ジンバル": "fa-solid fa-rotate",
  "マイク・音声": "fa-solid fa-microphone",
  "照明": "fa-solid fa-lightbulb",
  "ストレージ": "fa-solid fa-sd-card",
  "カメラ装着アクセサリー": "fa-solid fa-screwdriver-wrench",
  "収録・制御機器": "fa-solid fa-tv",
  "バッグ・収納": "fa-solid fa-bag-shopping",
  "ドローンカメラ": "fa-solid fa-helicopter",
};

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
        title="撮影機材紹介に登場した人気撮影機材まとめ"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から人気の撮影機材をカテゴリー別にまとめています。機材選びの参考にご活用ください。
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
                <Link
                  href={`/camera/category/${cameraCategoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              </div>
              <ProductGrid products={products} domain="camera" />
            </div>
          ))
        )}
      </div>
    </>
  );
}
