import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProducts, getSiteStats } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, TYPE_TAGS, slugToCategory } from "@/lib/constants";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import { FilterSection } from "@/components/detail/FilterSection";
import { ResultsBar } from "@/components/detail/ResultsBar";
import { ProductGrid } from "@/components/detail/ProductGrid";
import { FAQSection } from "@/components/detail/FAQSection";
import { assignRanks } from "@/lib/rankUtils";
import { generateBreadcrumbStructuredData } from "@/lib/structuredData";
import "../../detail-styles.css";
import "../../listing-styles.css";

export const revalidate = 3600;

interface PageProps {
  params: { slug: string };
  searchParams: {
    type?: string;
    sort?: string;
    page?: string;
  };
}

// カテゴリー名を取得
function getCategoryFromSlug(slug: string): string | null {
  const category = slugToCategory(slug);
  return category && PRODUCT_CATEGORIES.includes(category) ? category : null;
}

// カテゴリーアイコンマッピング
function getCategoryIcon(category: string): string {
  const iconMap: { [key: string]: string } = {
    "キーボード": "fa-keyboard",
    "マウス": "fa-computer-mouse",
    "ディスプレイ・モニター": "fa-display",
    "デスク": "fa-table",
    "チェア": "fa-chair",
    "マイク": "fa-microphone",
    "ウェブカメラ": "fa-video",
    "ヘッドホン・イヤホン": "fa-headphones",
    "スピーカー": "fa-volume-high",
    "照明・ライト": "fa-lightbulb",
    "マイクアーム": "fa-grip-lines-vertical",
    "充電器・電源タップ": "fa-battery-full",
    "デスクシェルフ・モニター台": "fa-layer-group",
    "配線整理グッズ": "fa-grip-lines",
    "その他デスクアクセサリー": "fa-puzzle-piece",
  };
  return iconMap[category] || "fa-cube";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getCategoryFromSlug(params.slug);
  if (!category) return { title: "カテゴリーが見つかりません" };

  const title = `デスクツアーに登場した${category}一覧`;
  const description = `デスクツアー動画・記事で実際に使用されている${category}を、使用者のコメント付きでまとめています。`;

  return {
    title,
    description,
    alternates: { canonical: `/category/${params.slug}` },
    openGraph: { title, description, url: `/category/${params.slug}` },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const category = getCategoryFromSlug(params.slug);
  if (!category) notFound();

  const typeTagFilter = searchParams.type;
  const sort = searchParams.sort || "mention";
  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  // 商品データ取得
  const { products, total } = await searchProducts({
    category,
    typeTag: typeTagFilter,
    sortBy: sort === "price_asc" ? "price_asc" : sort === "price_desc" ? "price_desc" : "mention_count",
    page,
    limit,
  });

  // デスクツアー動画・記事の件数を取得
  const stats = await getSiteStats();
  const totalSources = stats.total_videos + stats.total_articles;

  // 商品データを整形
  const formattedProducts = products.map((product) => ({
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
  }));

  // ランク付け（mention_countソート時のみ、同じmention_countは同順位）
  const productsWithRank = sort === "mention"
    ? assignRanks(formattedProducts, { page, limit })
    : formattedProducts.map(p => ({ ...p, rank: undefined }));

  // 種類タグ一覧
  const typeTags = TYPE_TAGS[category] || [];

  // FAQデータ
  const faqItems = [
    {
      question: "このデータはどこから収集していますか？",
      answer: "YouTubeのデスクツアー動画およびブログ記事から、実際に使用されている商品情報を収集しています。",
    },
    {
      question: "「使用者数」とは何ですか？",
      answer: "その商品を使用しているデスクツアーの数を示しています。",
    },
    {
      question: "価格情報は正確ですか？",
      answer: "価格情報はAmazon Product Advertising APIから取得しており、実際の販売価格と異なる場合があります。購入の際はリンク先で最新の価格をご確認ください。",
    },
  ];

  // 構造化データ - パンくずリスト
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "デスクツアーDB", url: "/" },
    { name: "デスク周りのガジェット", url: "/category" },
    { name: category },
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
        title={`デスクツアーに登場した${category}一覧`}
        description={
          <>
            {totalSources}件の
            <Link href="/sources" className="link">
              デスクツアー
            </Link>
            で実際に使用されている{category}を使用者のコメント付きで紹介。その他カテゴリーが気になる方は
            <Link href="/category" className="link">
              デスク周りのガジェット
            </Link>
            をご覧ください。
          </>
        }
        breadcrumbCurrent={category}
        breadcrumbMiddle={{ label: "デスク周りのガジェット", href: "/category" }}
        icon={getCategoryIcon(category)}
      />

      <div className="detail-container">
        {typeTags.length > 0 && (
          <FilterSection
            label="種類別に絞り込み"
            filterKey="type"
            tags={typeTags}
            currentFilter={typeTagFilter}
          />
        )}

        <ResultsBar total={total} currentSort={sort} />

        <ProductGrid products={productsWithRank} />

        <FAQSection items={faqItems} />
      </div>
    </>
  );
}
