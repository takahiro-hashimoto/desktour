import { Metadata } from "next";
import Link from "next/link";
import { getCameraSiteStats, getCameraSourceTagCounts } from "@/lib/supabase/queries-camera";
import { CAMERA_SUBJECT_TAGS, cameraSubjectToSlug } from "@/lib/camera/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../listing-styles.css";

export const revalidate = 3600; // 1時間キャッシュ

export async function generateMetadata(): Promise<Metadata> {
  const tagCounts = await getCameraSourceTagCounts();
  const subjectCount = CAMERA_SUBJECT_TAGS.filter(t => (tagCounts[t] || 0) > 0).length;

  const title = `被写体別の撮影機材一覧【${subjectCount}カテゴリ】`;
  const description = `人物・風景・商品・動物・乗り物など、被写体ごとに撮影機材紹介で使われている機材をまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: "/camera/subject" },
    openGraph: { title, description, url: "/camera/subject", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// 被写体ごとのアイコン（Font Awesome）
const SUBJECT_ICONS: Record<string, string> = {
  "人物": "fa-solid fa-user",
  "商品": "fa-solid fa-box",
  "風景": "fa-solid fa-mountain-sun",
  "動物": "fa-solid fa-paw",
  "乗り物": "fa-solid fa-car",
};

// 被写体ごとの説明文
const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  "人物": "ポートレートやウェディングなど、人物を撮影するクリエイターに人気の撮影機材を紹介。",
  "商品": "物撮りやレビュー動画など、商品撮影で使われている撮影機材を紹介。",
  "風景": "風景写真や旅行動画など、風景を撮影するクリエイターに人気の撮影機材を紹介。",
  "動物": "動物やペットを撮影するクリエイターがよく使っている撮影機材を紹介。",
  "乗り物": "車やバイクなど、乗り物を撮影するクリエイターに人気の撮影機材を紹介。",
};

export default async function SubjectIndexPage() {
  const [stats, tagCounts] = await Promise.all([
    getCameraSiteStats(),
    getCameraSourceTagCounts(),
  ]);

  // 撮影機材紹介数でソート（多い順）、0件は除外
  const sortedSubjects = [...CAMERA_SUBJECT_TAGS]
    .map((subject) => ({ subject, count: tagCounts[subject] || 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const listingItems = sortedSubjects.map(({ subject, count }) => ({
    href: `/camera/subject/${cameraSubjectToSlug(subject)}`,
    icon: SUBJECT_ICONS[subject] || "fa-solid fa-crosshairs",
    title: subject,
    count,
    description: SUBJECT_DESCRIPTIONS[subject] || "撮影機材紹介で紹介された商品一覧",
  }));

  const totalSources = stats.total_videos + stats.total_articles;

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "トップ", url: "/" }, { name: "撮影機材", url: "/camera" },
    { name: "被写体別" },
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
        title="被写体別の撮影機材一覧"
        description={
          <>
            {totalSources}件の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            から、被写体別に人気の撮影機材を掲載。全カテゴリーの総合ランキングは
            <Link href="/camera/category" className="link">
              撮影機材
            </Link>
            で紹介中。
          </>
        }
        breadcrumbCurrent="被写体別"
        icon="fa-crosshairs"
      />
      <ListingGrid items={listingItems} />
    </>
  );
}
