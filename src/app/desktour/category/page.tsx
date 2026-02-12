import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import { formatProductForDisplay } from "@/lib/format-utils";
import "../../detail-styles.css";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  const title = `デスクツアーに登場したPC周辺機器・ガジェット【${totalSources}件分析】`;
  const description = `${totalSources}件のデスクツアーを分析し、キーボード・マウス・モニターなどカテゴリー別に人気商品をまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: "/desktour/category" },
    openGraph: { title, description, url: "/desktour/category", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// カテゴリーごとのアイコン（Font Awesome）
const CATEGORY_ICONS: Record<string, string> = {
  "キーボード": "fa-solid fa-keyboard",
  "マウス": "fa-solid fa-computer-mouse",
  "ディスプレイ・モニター": "fa-solid fa-desktop",
  "モバイルモニター": "fa-solid fa-mobile-screen",
  "デスク": "fa-solid fa-table",
  "チェア": "fa-solid fa-chair",
  "マイク": "fa-solid fa-microphone",
  "ウェブカメラ": "fa-solid fa-video",
  "ヘッドホン・イヤホン": "fa-solid fa-headphones",
  "スピーカー": "fa-solid fa-volume-high",
  "照明・ライト": "fa-solid fa-lightbulb",
  "PCスタンド・ノートPCスタンド": "fa-solid fa-laptop",
  "モニターアーム": "fa-solid fa-up-down-left-right",
  "マイクアーム": "fa-solid fa-grip-lines-vertical",
  "USBハブ": "fa-solid fa-plug",
  "デスクマット": "fa-solid fa-border-all",
  "収納・整理": "fa-solid fa-box",
  "PC本体": "fa-solid fa-computer",
  "タブレット": "fa-solid fa-tablet-screen-button",
  "ペンタブ": "fa-solid fa-pen-nib",
  "充電器・電源タップ": "fa-solid fa-charging-station",
  "オーディオインターフェース": "fa-solid fa-sliders",
  "ドッキングステーション": "fa-solid fa-hard-drive",
  "左手デバイス": "fa-solid fa-gamepad",
  "HDD・SSD": "fa-solid fa-hard-drive",
  "コントローラー": "fa-solid fa-gamepad",
  "キャプチャーボード": "fa-solid fa-video",
  "NAS": "fa-solid fa-server",
  "デスクシェルフ・モニター台": "fa-solid fa-layer-group",
  "ケーブル": "fa-solid fa-link",
  "配線整理グッズ": "fa-solid fa-grip-lines",
  "その他デスクアクセサリー": "fa-solid fa-puzzle-piece",
};

export default async function CategoryIndexPage() {
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 各カテゴリーごとにトップ4商品を取得
  const categoryProducts = await Promise.all(
    PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchProducts({
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
    { name: "トップ", url: "/" }, { name: "PCデスク環境", url: "/desktour" },
    { name: "デスク周りのガジェット" },
  ]);

  return (
    <>
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PageHeaderSection
        label="Database Report"
        title="デスクツアーに登場した人気ガジェットまとめ"
        description={
          <>
            {totalSources}件の
            <Link href="/desktour/sources" className="link">
              デスクツアー
            </Link>
            から人気のデスク周りガジェットをカテゴリー別にまとめています。デスク環境構築の参考にご活用ください。
          </>
        }
        breadcrumbCurrent="デスク周りのガジェット"
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
                  href={`/desktour/${categoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              </div>
              <ProductGrid products={products} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
