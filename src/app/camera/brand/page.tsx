import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, getCameraBrandProductCounts } from "@/lib/supabase/queries-camera";
import { CAMERA_BRAND_TAGS, cameraBrandToSlug } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const brandCounts = await getCameraBrandProductCounts([...CAMERA_BRAND_TAGS]);

  const brandCount = Object.values(brandCounts).filter((count) => count > 0).length;

  const title = `撮影機材紹介で人気のブランド一覧【${brandCount}ブランド】`;
  const description = `Sony・Canon・DJIなど${brandCount}ブランドの愛用機材をカバンの中身・撮影機材紹介から分析。カメラ・レンズ・周辺機器をブランド別に掲載。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/brand" },
    openGraph: { title, description, url: "/camera/brand", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// ブランドごとのアイコン（Font Awesome）
const BRAND_ICONS: Record<string, string> = {
  "Sony": "fa-solid fa-camera",
  "Canon": "fa-solid fa-camera",
  "Nikon": "fa-solid fa-camera",
  "Fujifilm": "fa-solid fa-camera",
  "Panasonic": "fa-solid fa-video",
  "DJI": "fa-solid fa-helicopter",
  "GoPro": "fa-solid fa-video",
  "RODE": "fa-solid fa-microphone",
  "Sennheiser": "fa-solid fa-microphone",
  "Aputure": "fa-solid fa-lightbulb",
  "Godox": "fa-solid fa-lightbulb",
  "ZHIYUN": "fa-solid fa-rotate",
  "Manfrotto": "fa-solid fa-campground",
  "Blackmagic Design": "fa-solid fa-film",
  "SIGMA": "fa-solid fa-circle-dot",
  "TAMRON": "fa-solid fa-circle-dot",
  "Hollyland": "fa-solid fa-microphone",
  "SmallRig": "fa-solid fa-screwdriver-wrench",
  "Peak Design": "fa-solid fa-bag-shopping",
  "TILTA": "fa-solid fa-screwdriver-wrench",
};

// ブランドごとの説明文
const BRAND_DESCRIPTIONS: Record<string, string> = {
  "Sony": "ミラーレスカメラのリーディングブランド。多くのクリエイターのカバンの中身に登場する愛用機材。",
  "Canon": "一眼レフ・ミラーレスで長い歴史を持つカメラメーカー。映像制作セットアップの定番。",
  "Nikon": "高品質な光学技術で知られるカメラメーカー。愛用するフォトグラファー多数。",
  "Fujifilm": "独自のフィルムシミュレーションで人気。YouTubeの機材紹介でも愛用者多数。",
  "Panasonic": "LUMIX シリーズで動画撮影に強い。映像セットアップの定番カメラメーカー。",
  "DJI": "ドローンやジンバルなど周辺機器で有名。映像制作セットアップの定番ブランド。",
  "GoPro": "アクションカメラの代名詞。Vloggerのカバンの中身にも頻繁に登場。",
  "RODE": "高品質なマイクで知られるオーディオメーカー。YouTube機材セットアップの定番。",
  "Sennheiser": "プロ向けマイクやワイヤレスの老舗。撮影セットアップの愛用者多数。",
  "Aputure": "映像制作向けLEDライトのトップブランド。撮影セットアップに欠かせない周辺機器。",
  "Godox": "コスパの良い照明機材で人気。YouTube機材セットアップでも愛用者多数。",
  "ZHIYUN": "カメラ用ジンバルの大手メーカー。撮影セットアップの周辺機器として人気。",
  "Manfrotto": "三脚や雲台で世界的に有名。撮影セットアップのアクセサリーとして定番。",
  "Blackmagic Design": "シネマカメラや映像制作ソフトで知られるメーカー。愛用する映像クリエイター多数。",
  "SIGMA": "高品質なレンズで人気の日本メーカー。カバンの中身動画でも愛用者多数。",
  "TAMRON": "コスパの良いズームレンズで人気。撮影セットアップの定番レンズメーカー。",
  "Hollyland": "ワイヤレスマイクやビデオトランスミッターを展開。撮影セットアップの周辺機器。",
  "SmallRig": "カメラリグやアクセサリーで人気。撮影セットアップの周辺機器として定番。",
  "Peak Design": "カメラストラップやバッグで人気。カバンの中身動画でも頻繁に登場するアクセサリー。",
  "TILTA": "シネマカメラ用アクセサリーの専門ブランド。映像制作セットアップに人気。",
};

interface BrandWithCount {
  brand: string;
  count: number;
}

export default async function BrandIndexPage() {
  const stats = await getCameraSiteStats();

  // DBから人気ブランドと商品数を取得
  const brandCounts = await getCameraBrandProductCounts([...CAMERA_BRAND_TAGS]);

  // CAMERA_BRAND_TAGSに登録されているブランドの情報を取得
  const registeredBrands: BrandWithCount[] = CAMERA_BRAND_TAGS.map((brand) => ({
    brand,
    count: brandCounts[brand] || 0,
  })).filter((b) => b.count > 0);

  // 商品数でソート（多い順）
  registeredBrands.sort((a, b) => b.count - a.count);

  const listingItems = registeredBrands.map(({ brand, count }) => ({
    href: `/camera/brand/${cameraBrandToSlug(brand)}`,
    icon: BRAND_ICONS[brand] || "fa-solid fa-tag",
    title: brand,
    count,
    description: BRAND_DESCRIPTIONS[brand] || "撮影機材紹介で紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
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
        domain="camera"
        label="Database Report"
        title="撮影機材紹介で人気のブランド一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、ブランド別に愛用機材を掲載。カメラ・レンズ・アクセサリーの総合ランキングは
            <Link href="/camera/category" className="link">
              撮影機材
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
