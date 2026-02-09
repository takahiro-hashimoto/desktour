import { Metadata } from "next";
import Link from "next/link";
import { getSiteStats, supabase } from "@/lib/supabase";
import { BRAND_TAGS, brandToSlug } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export const metadata: Metadata = {
  title: "デスクツアーに登場する人気ブランド一覧",
  description: "FlexiSpot、Logicool、Keychron、HHKBなど人気ブランドの商品をデスクツアーから分析。各ブランドの人気商品やレビューが確認できます。",
  alternates: { canonical: "/brand" },
  openGraph: {
    title: "デスクツアーに登場する人気ブランド一覧",
    description: "FlexiSpot、Logicool、Keychron、HHKBなど人気ブランドの商品をデスクツアーから分析。各ブランドの人気商品やレビューが確認できます。",
    url: "/brand",
  },
};

// ブランドごとのアイコン（Font Awesome）
const BRAND_ICONS: Record<string, string> = {
  "FlexiSpot": "fa-solid fa-table",
  "COFO": "fa-solid fa-chair",
  "Logicool": "fa-solid fa-computer-mouse",
  "Keychron": "fa-solid fa-keyboard",
  "HHKB": "fa-solid fa-keyboard",
  "Herman Miller": "fa-solid fa-chair",
  "BenQ": "fa-solid fa-desktop",
  "DELL": "fa-solid fa-desktop",
  "Apple": "fa-brands fa-apple",
  "Anker": "fa-solid fa-charging-station",
  "REALFORCE": "fa-solid fa-keyboard",
  "Razer": "fa-solid fa-gamepad",
  "Elgato": "fa-solid fa-microphone",
  "SHURE": "fa-solid fa-microphone",
  "Audio-Technica": "fa-solid fa-headphones",
  "Sony": "fa-solid fa-headphones",
  "LG": "fa-solid fa-desktop",
  "Samsung": "fa-solid fa-mobile-screen",
  "IKEA": "fa-solid fa-house",
  "ASUS": "fa-solid fa-desktop",
};

// ブランドごとの説明文
const BRAND_DESCRIPTIONS: Record<string, string> = {
  "FlexiSpot": "電動昇降デスクの人気メーカー。コスパの良いスタンディングデスクが多くのデスクツアーで紹介されている。",
  "COFO": "人間工学に基づいたオフィスチェアやデスク周辺機器を展開するブランド。",
  "Logicool": "マウス、キーボード、ウェブカメラなど幅広い周辺機器を展開する定番ブランド。",
  "Keychron": "Mac対応のメカニカルキーボードで人気のブランド。",
  "HHKB": "静電容量無接点方式の高級キーボード。独自のキー配列でプログラマーに愛されている。",
  "Herman Miller": "アーロンチェアで有名な高級オフィス家具メーカー。",
  "BenQ": "モニターやモニターライト「ScreenBar」で人気のブランド。",
  "DELL": "モニターやPC本体で定番のブランド。",
  "Apple": "MacやiPadなどデスクツアーの定番デバイス。",
  "Anker": "充電器やケーブルなどの周辺機器で人気のブランド。",
  "REALFORCE": "静電容量無接点方式の高級キーボード。",
  "Razer": "ゲーミングデバイスの代表的ブランド。",
  "Elgato": "配信者向け機材のリーディングブランド。",
  "SHURE": "プロ品質のマイクで知られる老舗オーディオメーカー。",
  "Audio-Technica": "ヘッドホンやマイクで人気の日本メーカー。",
  "Sony": "ヘッドホンやカメラで人気。",
  "LG": "モニターやディスプレイで人気のメーカー。",
  "Samsung": "モニターやSSDで人気のメーカー。",
  "IKEA": "コスパの良いデスクや収納で人気。",
  "ASUS": "モニターやPC本体で人気のメーカー。",
};

// ブランドごとのカテゴリタグ
const BRAND_CATEGORIES: Record<string, string[]> = {
  "FlexiSpot": ["デスク", "昇降デスク"],
  "COFO": ["チェア", "デスク"],
  "Logicool": ["マウス", "キーボード"],
  "Keychron": ["キーボード"],
  "HHKB": ["キーボード"],
  "Herman Miller": ["チェア"],
  "BenQ": ["モニター", "照明"],
  "DELL": ["モニター", "PC本体"],
  "Apple": ["PC本体", "タブレット"],
  "Anker": ["充電器", "ケーブル"],
  "REALFORCE": ["キーボード"],
  "Razer": ["キーボード", "マウス"],
  "Elgato": ["マイク", "照明"],
  "SHURE": ["マイク"],
  "Audio-Technica": ["ヘッドホン", "マイク"],
  "Sony": ["ヘッドホン", "カメラ"],
  "LG": ["モニター"],
  "Samsung": ["モニター", "SSD"],
  "IKEA": ["デスク", "収納"],
  "ASUS": ["モニター", "PC本体"],
};

interface BrandWithCount {
  brand: string;
  count: number;
}

export default async function BrandIndexPage() {
  const stats = await getSiteStats();

  // DBから人気ブランドと商品数を取得
  const { data: brandCounts } = await supabase
    .from("products")
    .select("brand")
    .not("brand", "is", null);

  // ブランドごとの商品数をカウント
  const brandCountMap = new Map<string, number>();
  for (const item of brandCounts || []) {
    if (item.brand) {
      const normalizedBrand = item.brand.trim();
      brandCountMap.set(normalizedBrand, (brandCountMap.get(normalizedBrand) || 0) + 1);
    }
  }

  // BRAND_TAGSに登録されているブランドの情報を取得
  const registeredBrands: BrandWithCount[] = BRAND_TAGS.map((brand) => ({
    brand,
    count: brandCountMap.get(brand) || 0,
  })).filter((b) => b.count > 0);

  // 商品数でソート（多い順）
  registeredBrands.sort((a, b) => b.count - a.count);

  const listingItems = registeredBrands.map(({ brand, count }) => ({
    href: `/brand/${brandToSlug(brand)}`,
    icon: BRAND_ICONS[brand] || "fa-solid fa-tag",
    title: brand,
    count,
    description: BRAND_DESCRIPTIONS[brand] || "デスクツアーで紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "デスクツアーDB", url: "/" },
    { name: "ブランド別" },
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
        title="デスクツアーに登場する人気ブランド一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/sources" className="link">
              デスクツアー
            </Link>
            から、ブランド別に人気のガジェットを掲載。全ブランドの総合ランキングは
            <Link href="/category" className="link">
              デスク周りのガジェット
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent="ブランド別"
        icon="fa-tags"
      />
      <ListingGrid items={listingItems} />
    </>
  );
}
