import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchCameraProducts, getCameraSourceTagCounts } from "@/lib/supabase/queries-camera";
import { CAMERA_SUBJECT_TAGS, slugToCameraSubject, CAMERA_PRODUCT_CATEGORIES, cameraCategoryToSlug, cameraProductUrl } from "@/lib/camera/constants";
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

// 被写体名を取得
function getSubjectFromSlug(slug: string): string | null {
  const subject = slugToCameraSubject(slug);
  return subject && (CAMERA_SUBJECT_TAGS as readonly string[]).includes(subject) ? subject : null;
}

// 被写体ごとのアイコン
const SUBJECT_ICONS: Record<string, string> = {
  "人物": "fa-user",
  "商品": "fa-box",
  "風景": "fa-mountain-sun",
  "動物": "fa-paw",
  "乗り物": "fa-car",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const subject = getSubjectFromSlug(params.slug);
  if (!subject) return { title: "被写体が見つかりません" };

  const tagCounts = await getCameraSourceTagCounts();
  const sourceCount = tagCounts[subject] || 0;

  const title = `${subject}撮影の愛用撮影機材・カメラバッグの中身まとめ`;
  const description = `${subject}撮影のカバンの中身・撮影機材紹介${sourceCount}件を分析。愛用カメラ・レンズ・周辺機器をカテゴリ別にまとめました。セットアップ構成の参考に。`;

  return {
    title,
    description,
    alternates: { canonical: `/camera/subject/${params.slug}` },
    openGraph: { title, description, url: `/camera/subject/${params.slug}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SubjectDetailPage({ params }: PageProps) {
  const subject = getSubjectFromSlug(params.slug);
  if (!subject) notFound();

  // 被写体タグ別の撮影機材紹介数を取得
  const tagCounts = await getCameraSourceTagCounts();
  const subjectSourceCount = tagCounts[subject] || 0;

  // 各カテゴリーごとにトップ3商品を取得
  const categoryProducts = await Promise.all(
    CAMERA_PRODUCT_CATEGORIES.map(async (category) => {
      const { products, total } = await searchCameraProducts({
        category,
        setupTag: subject,
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

  // 動的FAQ：各カテゴリの1位を集約
  const topByCategory = filteredCategories
    .filter(c => c.products[0])
    .slice(0, 3)
    .map((c, i) => `${i + 1}位: ${c.products[0].brand ? c.products[0].brand + " " : ""}${c.products[0].name}（${c.category}、${c.products[0].mention_count}件の撮影機材紹介に登場）`);
  const rankingAnswer = topByCategory.length > 0
    ? topByCategory.join("、") + `。${subject}撮影で愛用されている機材を登場回数順にランキングしています。`
    : "まだデータがありません。";

  const allFaqItems = [
    { question: `${subject}撮影に人気の撮影機材は何ですか？`, answer: rankingAnswer },
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
        title={`${subject}撮影の愛用撮影機材・カメラバッグの中身まとめ`}
        description={
          <>
            {subject}撮影の
            <Link href="/camera/sources" className="link">
              撮影機材紹介
            </Link>
            {subjectSourceCount}件を分析。愛用カメラ・レンズ・周辺機器をカテゴリ別にまとめました。セットアップ構成の参考にどうぞ。
          </>
        }
        breadcrumbCurrent={subject}
        breadcrumbMiddle={{ label: "被写体別", href: "/camera/subject" }}
        icon={SUBJECT_ICONS[subject] || "fa-crosshairs"}
      />

      <div className="detail-container" style={{ paddingTop: "48px" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-sub)" }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}></i>
            <p style={{ fontSize: "15px" }}>この被写体にはまだ商品が登録されていません。</p>
          </div>
        ) : (
          filteredCategories.map(({ category, products, total }) => (
          <div key={category} style={{ marginBottom: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{category}</h2>
              {total > 3 && (
                <Link
                  href={`/camera/subject/${params.slug}/${cameraCategoryToSlug(category)}`}
                  style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  全て見る ({total}件) <i className="fa-solid fa-arrow-right" style={{ fontSize: "11px" }}></i>
                </Link>
              )}
            </div>
            <ProductGrid products={products} domain="camera" />
          </div>
          ))
        )}

        <FAQSection items={allFaqItems} />
      </div>
    </>
  );
}
