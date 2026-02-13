import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { getVideos, getArticles, getSourceTagCounts, getSiteStats, supabase } from "@/lib/supabase";
import { STYLE_TAGS, ENVIRONMENT_TAGS, OCCUPATION_TAGS } from "@/lib/constants";
import { SourcesClient } from "./SourcesClient";
import { PageHeaderSection } from "@/components/PageHeaderSection";
import "../../listing-styles.css";

// 【最適化】ソースページのデータをキャッシュ（5分間）
const getCachedSourcesData = unstable_cache(
  async () => {
    const [videosResult, articlesResult, tagCounts, siteStats, influencersResult] = await Promise.all([
      getVideos({ page: 1, limit: 1000 }),
      getArticles({ page: 1, limit: 1000 }),
      getSourceTagCounts(),
      getSiteStats(),
      supabase.from("influencers").select("channel_id, author_id, occupation_tags"),
    ]);

    return {
      videosResult,
      articlesResult,
      tagCounts,
      siteStats,
      influencersData: influencersResult.data || [],
    };
  },
  ["sources-page-data"],
  { revalidate: 300 } // 5分間キャッシュ
);

interface PageProps {
  searchParams: {
    tags?: string;
    page?: string;
    occupation?: string;
    environment?: string;
    style?: string;  // スタイルフィルター（単一選択）
    sort?: string; // "newest" | "oldest"
  };
}

// 【SEO最適化】フィルター適用時の動的メタデータ生成（単一フィルターのみ対応）
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const occupation = searchParams.occupation;
  const environment = searchParams.environment;
  const style = searchParams.style;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

  const { siteStats, videosResult, articlesResult } = await getCachedSourcesData();
  const videoCount = videosResult.total;
  const articleCount = articlesResult.total;
  const totalSources = videoCount + articleCount;

  let title = `デスクツアー動画・ブログ記事まとめ【登録数${totalSources}件】`;
  let description = `YouTube動画${videoCount}件・ブログ記事${articleCount}件のデスクツアーを一覧で紹介。再生数5,000回以上の厳選コンテンツを職業・スタイル別に絞り込めます。`;
  let canonicalUrl = `${baseUrl}/sources`;

  // 職業フィルターが適用されている場合
  if (occupation && OCCUPATION_TAGS.includes(occupation as typeof OCCUPATION_TAGS[number])) {
    title = `${occupation}のデスクツアー動画・記事まとめ【登録数${totalSources}件】`;
    description = `${occupation}が公開しているデスクツアー動画・記事を一覧で紹介。${occupation}のデスク環境やおすすめガジェットの参考にどうぞ。`;
    canonicalUrl = `${baseUrl}/sources?occupation=${encodeURIComponent(occupation)}`;
  }
  // 環境フィルターが適用されている場合
  else if (environment && ENVIRONMENT_TAGS.includes(environment as typeof ENVIRONMENT_TAGS[number])) {
    title = `${environment}のデスクツアー動画・記事まとめ【登録数${totalSources}件】`;
    description = `${environment}環境のデスクツアー動画・記事を一覧で紹介。${environment}のデスクセットアップの参考にどうぞ。`;
    canonicalUrl = `${baseUrl}/sources?environment=${encodeURIComponent(environment)}`;
  }
  // スタイルフィルターが適用されている場合
  else if (style && STYLE_TAGS.includes(style as typeof STYLE_TAGS[number])) {
    title = `${style}スタイルのデスクツアー動画・記事まとめ【登録数${totalSources}件】`;
    description = `${style}スタイルのデスクツアー動画・記事を一覧で紹介。${style}なデスクセットアップの参考にどうぞ。`;
    canonicalUrl = `${baseUrl}/sources?style=${encodeURIComponent(style)}`;
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
};

export default async function SourcesPage({ searchParams }: PageProps) {
  // フィルターは1つだけ有効（occupation, environment, style のいずれか）
  const selectedOccupation = searchParams.occupation || undefined;
  const selectedEnvironment = searchParams.environment || undefined;
  const selectedStyle = searchParams.style || undefined;
  const sortOrder = (searchParams.sort as "newest" | "oldest") || "newest";
  const page = parseInt(searchParams.page || "1", 10);
  const limit = 30;

  // 後方互換性のためtags対応は残すが、基本はstyleを使用
  const selectedTags = searchParams.tags ? searchParams.tags.split(",") : [];

  // 【最適化】キャッシュからデータ取得（5分間有効）
  const { videosResult, articlesResult, tagCounts, siteStats, influencersData } = await getCachedSourcesData();

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
  const videoItems: SourceItem[] = videosResult.videos.map((v) => ({
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
  }));

  const articleItems: SourceItem[] = articlesResult.articles.map((a) => {
    // occupation_tagsを取得
    // author_idは "ドメイン:著者名" 形式なので、記事URLのドメイン部分でマッチング
    let occupationTags: string[] = [];
    const matchedInfluencer = influencersList.find((inf) => {
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
    };
  });

  // 投稿日順でソート（sortOrderに応じて）
  let allItems = [...videoItems, ...articleItems].sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
  });

  // フィルターは1つだけ適用（優先順位: occupation > environment > style）
  if (selectedOccupation) {
    allItems = allItems.filter((item) =>
      item.occupation_tags?.includes(selectedOccupation)
    );
  } else if (selectedEnvironment) {
    allItems = allItems.filter((item) =>
      item.tags?.includes(selectedEnvironment)
    );
  } else if (selectedStyle) {
    allItems = allItems.filter((item) =>
      item.tags?.includes(selectedStyle)
    );
  }

  // ページネーション
  const total = allItems.length;
  const offset = (page - 1) * limit;
  const paginatedItems = allItems.slice(offset, offset + limit);

  // スタイルタグ（定義済みタグをすべて表示）
  const availableStyleTags = [...STYLE_TAGS];

  // 環境タグ（定義済みタグをすべて表示）
  const availableEnvironmentTags = [...ENVIRONMENT_TAGS];

  // JSON-LD 構造化データ（動画と記事を混合）
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";
  const topItems = allItems.slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "デスクツアー動画・記事まとめ",
    "description": "人気YouTuberやブロガーのデスクツアー動画・記事を一覧で紹介。エンジニア、デザイナー、ゲーマーなど職業別の素敵なデスク環境から、おすすめPC周辺機器やセットアップのヒントが見つかります。",
    "url": `${baseUrl}/sources`,
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
        { "@type": "ListItem", "position": 2, "name": "PCデスク環境", "item": `${baseUrl}/desktour` },
        { "@type": "ListItem", "position": 3, "name": "デスクツアー一覧", "item": `${baseUrl}/sources` },
      ],
    },
  };

  // DB登録数（動画 + 記事）
  const dbCount = siteStats.total_videos + siteStats.total_articles;

  // 【SEO最適化】フィルター適用時の動的タイトル・説明文（単一フィルターのみ）
  let pageTitle = "デスクツアー動画・ブログ記事まとめ";
  let pageDescription = (
    <>
      Youtubeで5,000回以上再生されているデスクツアー動画やnote、ブログなどのデスクツアー記事をまとめています。頻繁に登場するアイテムは
      <Link href="/desktour/category" className="link">
        デスク周りのガジェット
      </Link>
      で紹介中。
    </>
  );
  let breadcrumbCurrent = "デスクツアー";

  // 職業フィルターが適用されている場合
  if (selectedOccupation && OCCUPATION_TAGS.includes(selectedOccupation as typeof OCCUPATION_TAGS[number])) {
    pageTitle = `${selectedOccupation}のデスクツアー動画・記事まとめ`;
    pageDescription = (
      <>
        {selectedOccupation}が公開しているデスクツアー動画・記事をまとめています。{selectedOccupation}のデスク環境やおすすめガジェットを参考にしましょう。
      </>
    );
    breadcrumbCurrent = selectedOccupation;
  }
  // 環境フィルターが適用されている場合
  else if (selectedEnvironment && ENVIRONMENT_TAGS.includes(selectedEnvironment as typeof ENVIRONMENT_TAGS[number])) {
    pageTitle = `${selectedEnvironment}のデスクツアー動画・記事まとめ`;
    pageDescription = (
      <>
        {selectedEnvironment}環境のデスクツアー動画・記事をまとめています。{selectedEnvironment}のデスクセットアップを参考にしましょう。
      </>
    );
    breadcrumbCurrent = selectedEnvironment;
  }
  // スタイルフィルターが適用されている場合
  else if (selectedStyle && STYLE_TAGS.includes(selectedStyle as typeof STYLE_TAGS[number])) {
    pageTitle = `${selectedStyle}スタイルのデスクツアー動画・記事まとめ`;
    pageDescription = (
      <>
        {selectedStyle}スタイルのデスクツアー動画・記事をまとめています。{selectedStyle}なデスクセットアップを参考にしましょう。
      </>
    );
    breadcrumbCurrent = selectedStyle;
  }

  return (
    <>
      {/* JSON-LD 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeaderSection
        label="Database Report"
        title={pageTitle}
        description={pageDescription}
        breadcrumbCurrent={breadcrumbCurrent}
      />

      <SourcesClient
        items={paginatedItems}
        total={total}
        availableTags={availableStyleTags as string[]}
        tagCounts={tagCounts}
        selectedTags={selectedTags}
        occupationTags={[...OCCUPATION_TAGS]}
        selectedOccupation={selectedOccupation}
        environmentTags={[...ENVIRONMENT_TAGS]}
        selectedEnvironment={selectedEnvironment}
        selectedStyle={selectedStyle}
        sortOrder={sortOrder}
        currentPage={page}
        limit={limit}
      />
    </>
  );
}
