import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { getCameraVideos, getCameraArticles, getCameraSourceTagCounts, getCameraSiteStats, getCameraInfluencers, getCameraSourceBrands } from "@/lib/supabase/queries-camera";
import { CAMERA_OCCUPATION_TAGS, CAMERA_SOURCE_BRAND_FILTERS, CAMERA_SUBJECT_TAGS, CAMERA_PURPOSE_TAGS } from "@/lib/camera/constants";
import { SourcesClient } from "./SourcesClient";
import "../../listing-styles.css";

// 【最適化】ソースページのデータをキャッシュ（5分間）
const getCachedSourcesData = unstable_cache(
  async () => {
    const [videosResult, articlesResult, tagCounts, siteStats, influencersData, sourceBrands] = await Promise.all([
      getCameraVideos({ page: 1, limit: 1000 }),
      getCameraArticles({ page: 1, limit: 1000 }),
      getCameraSourceTagCounts(),
      getCameraSiteStats(),
      getCameraInfluencers(),
      getCameraSourceBrands(),
    ]);

    return {
      videosResult,
      articlesResult,
      tagCounts,
      siteStats,
      influencersData,
      sourceBrands,
    };
  },
  ["camera-sources-page-data-v2"],
  { revalidate: 300 } // 5分間キャッシュ
);

interface PageProps {
  searchParams: {
    page?: string;
    occupation?: string;
    brand?: string;
    tag?: string;
    sort?: string; // "newest" | "oldest"
  };
}

// 【SEO最適化】フィルター適用時の動的メタデータ生成（職業フィルターのみ）
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const occupation = searchParams.occupation;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

  const { siteStats, videosResult, articlesResult } = await getCachedSourcesData();
  const videoCount = videosResult.total;
  const articleCount = articlesResult.total;
  const totalSources = videoCount + articleCount;

  let title = `撮影機材紹介動画・記事一覧【${totalSources}件収録】`;
  let description = `YouTube動画${videoCount}件・ブログ記事${articleCount}件を収録。再生数5,000回以上の撮影機材紹介を職業別に絞り込めます。`;
  let canonicalUrl = `${baseUrl}/camera/sources`;

  // 職業フィルターが適用されている場合
  if (occupation && CAMERA_OCCUPATION_TAGS.includes(occupation as typeof CAMERA_OCCUPATION_TAGS[number])) {
    title = `${occupation}の撮影機材紹介動画・記事一覧`;
    description = `${occupation}が公開している撮影機材紹介動画・記事をまとめています。${occupation}の撮影機材やセットアップの参考にどうぞ。`;
    canonicalUrl = `${baseUrl}/camera/sources?occupation=${encodeURIComponent(occupation)}`;
  }

  const ogTitle = title.replace(/【.*】/, "");

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

// 混合アイテム型
export type SourceItem = {
  type: "video" | "article";
  id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string | null;
  summary: string;
  product_count?: number;
  tags?: string[];
  occupation_tags?: string[]; // 職業タグ
  // video用
  channel_title?: string;
  channel_id?: string;
  video_id?: string;
  subscriber_count?: number;
  // article用
  author?: string | null;
  url?: string;
  site_name?: string | null;
  // ブランドフィルター用
  brands?: string[];
};

export default async function SourcesPage({ searchParams }: PageProps) {
  // フィルター
  const selectedOccupation = searchParams.occupation || undefined;
  const selectedBrand = searchParams.brand || undefined;
  const selectedTag = searchParams.tag || undefined;
  const sortOrder = (searchParams.sort as "newest" | "oldest") || "newest";
  const page = parseInt(searchParams.page || "1", 10);
  const limit = 30;

  // 【最適化】キャッシュからデータ取得（5分間有効）
  const { videosResult, articlesResult, tagCounts, siteStats, influencersData, sourceBrands } = await getCachedSourcesData();

  // channel_id → occupation_tags のマップ（動画用）
  const channelToOccupation = new Map<string, string[]>(
    influencersData
      .filter((i: { channel_id?: string; occupation_tags?: string[] }) => i.channel_id && i.occupation_tags)
      .map((i: { channel_id: string; occupation_tags: string[] }) => [i.channel_id, i.occupation_tags])
  );

  // 記事用: influencersリストを保持（author_idからドメインを抽出してマッチング）
  const influencersList = influencersData.filter(
    (i: { author_id?: string; occupation_tags?: string[] }) => i.author_id && i.occupation_tags
  );

  // 動画・記事を混合してSourceItem型に変換
  const videoItems: SourceItem[] = videosResult.videos.map((v: any) => ({
    type: "video" as const,
    id: v.video_id,
    title: v.title,
    thumbnail_url: v.thumbnail_url,
    published_at: v.published_at,
    summary: v.summary,
    product_count: v.product_count,
    tags: v.tags,
    occupation_tags: channelToOccupation.get(v.channel_id) || [],
    channel_title: v.channel_title,
    channel_id: v.channel_id,
    video_id: v.video_id,
    subscriber_count: v.subscriber_count,
    brands: sourceBrands.videoBrands[v.video_id] || [],
  }));

  const articleItems: SourceItem[] = articlesResult.articles.map((a: any) => {
    // occupation_tagsを取得
    // author_idは "ドメイン:著者名" 形式なので、記事URLのドメイン部分でマッチング
    let occupationTags: string[] = [];
    const matchedInfluencer = influencersList.find((inf: any) => {
      if (!inf.author_id) return false;
      // author_idからドメイン部分を抽出（例: "ritalog0317.com:リタ" → "ritalog0317.com"）
      const domain = inf.author_id.split(":")[0];
      return a.url?.includes(domain);
    });

    if (matchedInfluencer?.occupation_tags) {
      occupationTags = matchedInfluencer.occupation_tags;
    }

    return {
      type: "article" as const,
      id: a.url,
      title: a.title,
      thumbnail_url: a.thumbnail_url,
      published_at: a.published_at,
      summary: a.summary,
      product_count: a.product_count,
      tags: a.tags,
      occupation_tags: occupationTags,
      author: a.author,
      url: a.url,
      site_name: a.site_name,
      brands: sourceBrands.articleBrands[a.url] || [],
    };
  });

  // 投稿日順でソート（sortOrderに応じて）
  let allItems = [...videoItems, ...articleItems].sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
  });

  // フィルター適用
  if (selectedOccupation) {
    allItems = allItems.filter((item) =>
      item.occupation_tags?.includes(selectedOccupation)
    );
  }
  if (selectedBrand) {
    allItems = allItems.filter((item) =>
      item.brands?.includes(selectedBrand)
    );
  }
  if (selectedTag) {
    allItems = allItems.filter((item) =>
      item.tags?.includes(selectedTag)
    );
  }

  // ページネーション
  const total = allItems.length;
  const offset = (page - 1) * limit;
  const paginatedItems = allItems.slice(offset, offset + limit);

  // JSON-LD 構造化データ（動画と記事を混合）
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";
  const topItems = allItems.slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "撮影機材紹介動画・記事まとめ",
    "description": "人気YouTuberやブロガーの撮影機材紹介動画・記事を一覧で紹介。フォトグラファー、映像クリエイター、YouTuberなど職業別の撮影機材セットアップから、おすすめカメラ・レンズ・周辺機材が見つかります。",
    "url": `${baseUrl}/camera/sources`,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": siteStats.total_videos + siteStats.total_articles,
      "itemListElement": topItems.map((item, index) => {
        if (item.type === "video") {
          return {
            "@type": "VideoObject",
            "position": index + 1,
            "name": item.title,
            "description": item.summary || "",
            "thumbnailUrl": item.thumbnail_url,
            "uploadDate": item.published_at,
            "contentUrl": `https://www.youtube.com/watch?v=${item.video_id}`,
          };
        } else {
          return {
            "@type": "Article",
            "position": index + 1,
            "headline": item.title,
            "description": item.summary || "",
            "image": item.thumbnail_url,
            "datePublished": item.published_at,
            "url": item.url,
            "author": {
              "@type": "Person",
              "name": item.author || "Unknown",
            },
          };
        }
      }),
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "トップ", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "撮影機材", "item": `${baseUrl}/camera` },
        { "@type": "ListItem", "position": 3, "name": "撮影機材紹介一覧", "item": `${baseUrl}/camera/sources` },
      ],
    },
  };

  // DB登録数（動画 + 記事）
  const dbCount = siteStats.total_videos + siteStats.total_articles;

  // 【SEO最適化】フィルター適用時の動的タイトル・説明文（職業フィルターのみ）
  let pageTitle = "撮影機材紹介動画・記事一覧";
  let pageDescription = (
    <>
      Youtubeで5,000回以上再生されている撮影機材紹介動画やnote、ブログなどの撮影機材紹介記事をまとめています。頻繁に登場するアイテムは
      <Link href="/camera/category" className="link">
        撮影機材カテゴリ
      </Link>
      で紹介中。
    </>
  );
  let breadcrumbCurrent = "撮影機材紹介";

  // 職業フィルターが適用されている場合
  if (selectedOccupation && CAMERA_OCCUPATION_TAGS.includes(selectedOccupation as typeof CAMERA_OCCUPATION_TAGS[number])) {
    pageTitle = `${selectedOccupation}の撮影機材紹介動画・記事一覧`;
    pageDescription = (
      <>
        {selectedOccupation}が公開している撮影機材紹介動画・記事をまとめています。{selectedOccupation}の撮影機材やおすすめ機材を参考にしましょう。
      </>
    );
    breadcrumbCurrent = selectedOccupation;
  }

  return (
    <>
      {/* JSON-LD 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Page Header - inline for camera breadcrumbs */}
      <div className="listing-page-header">
        <div className="listing-container">
          <div className="listing-breadcrumb">
            <Link href="/">トップ</Link>
            <span className="sep">
              <i className="fa-solid fa-chevron-right"></i>
            </span>
            <Link href="/camera">撮影機材</Link>
            <span className="sep">
              <i className="fa-solid fa-chevron-right"></i>
            </span>
            <span className="current">{breadcrumbCurrent}</span>
          </div>

          <div className="listing-header-inner">
            <div className="listing-header-icon">
              <i className="fa-solid fa-cube"></i>
            </div>
            <div className="listing-header-text">
              <div className="listing-page-label">Database Report</div>
              <h1>{pageTitle}</h1>
              <div className="listing-page-desc">
                {typeof pageDescription === "string" ? <p>{pageDescription}</p> : pageDescription}
                <span className="listing-pr-note">（本ページにはPRを含みます）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SourcesClient
        items={paginatedItems}
        total={total}
        tagCounts={tagCounts}
        occupationTags={[...CAMERA_OCCUPATION_TAGS]}
        selectedOccupation={selectedOccupation}
        allBrands={[...CAMERA_SOURCE_BRAND_FILTERS]}
        selectedBrand={selectedBrand}
        subjectTags={[...CAMERA_SUBJECT_TAGS]}
        purposeTags={[...CAMERA_PURPOSE_TAGS]}
        selectedTag={selectedTag}
        sortOrder={sortOrder}
        currentPage={page}
        limit={limit}
      />
    </>
  );
}
