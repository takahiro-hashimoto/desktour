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

  const title = `撮影機材紹介に登場するブランド一覧【${brandCount}ブランド】`;
  const description = `Sony・Canon・DJIなど${brandCount}ブランドの商品を撮影機材紹介から分析。ブランド別の人気商品と使用者レビューを掲載しています。`;

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
  "Sony": "ミラーレスカメラのリーディングブランド。動画・写真の両立で多くのクリエイターに支持されている。",
  "Canon": "一眼レフ・ミラーレスで長い歴史を持つカメラメーカー。映像制作でも定番。",
  "Nikon": "高品質な光学技術で知られるカメラメーカー。",
  "Fujifilm": "独自のフィルムシミュレーションで人気のミラーレスカメラブランド。",
  "Panasonic": "LUMIX シリーズで動画撮影に強いカメラメーカー。",
  "DJI": "ドローンやジンバルで有名なメーカー。映像制作の定番ブランド。",
  "GoPro": "アクションカメラの代名詞。過酷な環境での撮影に強い。",
  "RODE": "高品質なマイクで知られるオーストラリアのオーディオメーカー。",
  "Sennheiser": "プロフェッショナル向けマイクやワイヤレスシステムの老舗。",
  "Aputure": "映像制作向けLEDライトのトップブランド。",
  "Godox": "コスパの良い照明機材で人気のブランド。",
  "ZHIYUN": "カメラ用ジンバルの大手メーカー。",
  "Manfrotto": "三脚や雲台で世界的に有名なイタリアのブランド。",
  "Blackmagic Design": "シネマカメラや映像制作ソフトで知られるメーカー。",
  "SIGMA": "高品質なレンズで人気の日本メーカー。",
  "TAMRON": "コスパの良いズームレンズで人気のレンズメーカー。",
  "Hollyland": "ワイヤレスマイクやビデオトランスミッターを展開するブランド。",
  "SmallRig": "カメラリグやアクセサリーで人気のブランド。",
  "Peak Design": "カメラストラップやバッグで人気のブランド。",
  "TILTA": "シネマカメラ用アクセサリーの専門ブランド。",
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
        title="撮影機材紹介に登場する人気ブランド一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、ブランド別に人気の撮影機材を掲載。全ブランドの総合ランキングは
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
