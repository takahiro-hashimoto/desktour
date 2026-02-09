import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, searchProducts } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, categoryToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../detail-styles.css";
import "../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "デスク環境セットアップの商品カテゴリーまとめ",
  description: "キーボード、マウス、モニター、デスク、チェアなどカテゴリー別にデスクツアーで紹介された商品を確認できます。",
  alternates: { canonical: "/category" },
  openGraph: {
    title: "デスク環境セットアップの商品カテゴリーまとめ",
    description: "キーボード、マウス、モニター、デスク、チェアなどカテゴリー別にデスクツアーで紹介された商品を確認できます。",
    url: "/category",
  },
};

// カテゴリーごとのアイコン（Font Awesome）
const CATEGORY_ICONS: Record<string, string> = {
  "キーボード": "fa-solid fa-keyboard",
  "マウス": "fa-solid fa-computer-mouse",
  "ディスプレイ/モニター": "fa-solid fa-desktop",
  "デスク": "fa-solid fa-table",
  "チェア": "fa-solid fa-chair",
  "マイク": "fa-solid fa-microphone",
  "ウェブカメラ": "fa-solid fa-video",
  "ヘッドホン/イヤホン": "fa-solid fa-headphones",
  "スピーカー": "fa-solid fa-volume-high",
  "照明・ライト": "fa-solid fa-lightbulb",
  "PCスタンド/ノートPCスタンド": "fa-solid fa-laptop",
  "モニターアーム": "fa-solid fa-up-down-left-right",
  "モニター台": "fa-solid fa-display",
  "ケーブル/ハブ": "fa-solid fa-plug",
  "USBハブ": "fa-solid fa-plug",
  "デスクマット": "fa-solid fa-border-all",
  "収納/整理": "fa-solid fa-box",
  "PC本体": "fa-solid fa-computer",
  "タブレット": "fa-solid fa-tablet-screen-button",
  "ペンタブ": "fa-solid fa-pen-nib",
  "充電器/電源": "fa-solid fa-charging-station",
  "オーディオインターフェース": "fa-solid fa-sliders",
  "ドッキングステーション": "fa-solid fa-hard-drive",
  "左手デバイス": "fa-solid fa-gamepad",
  "HDD/SSD": "fa-solid fa-hard-drive",
  "コントローラー": "fa-solid fa-gamepad",
  "キャプチャーボード": "fa-solid fa-video",
  "NAS": "fa-solid fa-server",
  "その他デスクアクセサリー": "fa-solid fa-puzzle-piece",
};

// カテゴリーごとの説明文
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "キーボード": "タイピングの快適さと生産性を左右する重要なデバイス。",
  "マウス": "作業効率を上げるポインティングデバイス。",
  "ディスプレイ/モニター": "作業領域を広げる大画面・高解像度ディスプレイ。",
  "デスク": "作業の土台となるワークスペース。",
  "チェア": "長時間の作業を支える快適なオフィスチェア。",
  "マイク": "会議や配信で活躍する高音質マイク。",
  "ウェブカメラ": "オンライン会議や配信に必須のカメラ。",
  "ヘッドホン/イヤホン": "集中力を高める高品質オーディオ。",
  "スピーカー": "デスクで楽しむ高音質サウンド。",
  "照明・ライト": "デスク周りを照らすライティング。",
  "PCスタンド/ノートPCスタンド": "姿勢改善と放熱に効果的なスタンド。",
  "モニターアーム": "モニターを自由に配置できるアーム。",
  "モニター台": "モニターの高さ調整と収納を兼ねた台。",
  "ケーブル/ハブ": "デバイス接続と配線整理。",
  "USBハブ": "ポート拡張でデバイス接続を便利に。",
  "デスクマット": "デスクを保護し作業を快適に。",
  "収納/整理": "デスク周りをすっきり整理。",
  "PC本体": "作業の中心となるコンピュータ。",
  "タブレット": "サブディスプレイやメモに活躍。",
  "ペンタブ": "イラストやデザイン作業に必須。",
  "充電器/電源": "デバイスの電源供給。",
  "オーディオインターフェース": "高品質な音声入出力。",
  "ドッキングステーション": "ノートPCの拡張性を高める。",
  "左手デバイス": "ショートカットを効率化。",
  "HDD/SSD": "データ保存とバックアップ。",
  "コントローラー": "ゲームプレイを快適にするコントローラー。",
  "キャプチャーボード": "ゲーム配信や録画に必須のキャプチャーデバイス。",
  "NAS": "ネットワーク経由でアクセスできる大容量ストレージ。",
  "その他デスクアクセサリー": "デスクをより便利に。",
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
        products: products.map((product) => ({
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
        })),
        total,
      };
    })
  );

  // 商品があるカテゴリーのみ表示
  const filteredCategories = categoryProducts.filter((cat) => cat.products.length > 0);

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "ホーム", url: "/" },
    { name: "商品カテゴリー" },
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
        title="デスクツアーに登場する人気のガジェットまとめ"
        description={
          <>
            {totalSources}件の
            <Link href="/sources" className="link">
              デスクツアー動画・記事
            </Link>
            から人気のデスク周りガジェットをカテゴリー別にまとめています。デスク環境構築の参考にご活用ください。
          </>
        }
        breadcrumbCurrent="カテゴリー"
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
                  href={`/category/${categoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              </div>
              <div className="detail-product-grid">
                {products.map((product) => (
                  <div key={product.id} className="detail-product-card">
                    <a
                      href={product.amazon_url || product.rakuten_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="detail-product-img"
                    >
                      <div className="detail-product-img-inner">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} width={200} height={200} loading="lazy" />
                        ) : (
                          <i className="fa-solid fa-cube img-placeholder"></i>
                        )}
                      </div>
                    </a>
                    <div className="detail-product-body">
                      <div className="detail-product-brand">{product.brand || "ブランド不明"}</div>
                      <div className="detail-product-name">{product.name}</div>
                      <div className="detail-product-meta">
                        <span className="detail-mention-badge">
                          <i className="fa-solid fa-circle-check"></i> {product.mention_count}回登場
                        </span>
                        {product.price && (
                          <div className="detail-product-price">
                            <div className="price">¥{product.price.toLocaleString("ja-JP")}</div>
                          </div>
                        )}
                      </div>
                      {product.user_comment && <p className="detail-product-desc">{product.user_comment}</p>}
                      {product.slug && (
                        <Link href={`/product/${product.slug}`} className="detail-product-cta">
                          詳細を見る
                        </Link>
                      )}
                      <div className="detail-product-links">
                        {product.amazon_url && (
                          <a href={product.amazon_url} target="_blank" rel="noopener noreferrer" className="amazon">
                            <i className="fa-brands fa-amazon"></i> Amazonで探す
                          </a>
                        )}
                        {product.rakuten_url && (
                          <a href={product.rakuten_url} target="_blank" rel="noopener noreferrer" className="rakuten">
                            楽天で探す
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
