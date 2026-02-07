"use client";

import { Play, FileText, Package } from "lucide-react";
import type { Video, Article } from "@/lib/supabase";

// 拡張されたソースタイプ（商品数含む）
type ExtendedVideo = Video & { product_count?: number };
type ExtendedArticle = Article & { product_count?: number };

// 汎用的なソースタイプ（page.tsxのSourceItem用）
type GenericSource = {
  title: string;
  thumbnail_url?: string | null;
  summary?: string;
  tags?: string[];
  published_at?: string | null;
  product_count?: number;
  occupation_tags?: string[]; // 職業タグ
  // video用
  video_id?: string;
  channel_title?: string;
  subscriber_count?: number;
  // article用
  url?: string;
  author?: string | null;
  site_name?: string | null;
};

interface SourceCardProps {
  source: ExtendedVideo | ExtendedArticle | GenericSource;
  type: "video" | "article";
  onClick: () => void;
  highlightedTag?: string; // 選択中のフィルタータグ（先頭にハイライト表示）
}

export function SourceCard({ source, type, onClick, highlightedTag }: SourceCardProps) {
  const isVideo = type === "video";

  const title = source.title;
  const thumbnailUrl = source.thumbnail_url;
  const summary = source.summary;
  const tags = source.tags || [];
  const publishedAt = source.published_at;
  const productCount = source.product_count;
  const occupationTags = "occupation_tags" in source ? source.occupation_tags : undefined;

  // summaryをクリーンアップ（記事の場合、「この記事の著者...」部分を除去）
  let cleanSummary = summary;
  if (!isVideo && summary) {
    // 「この記事では、」以降を抽出
    const articleContentMatch = summary.match(/この記事では[、,]?\s*(.+)/s);
    if (articleContentMatch) {
      cleanSummary = articleContentMatch[1].trim();
    } else if (summary.startsWith("この記事の著者")) {
      // 「この記事の著者...」で始まるが「この記事では」がない場合は表示しない
      cleanSummary = undefined;
    }
  }

  // メディア名の取得（動画: チャンネル名、記事: サイト名）
  let mediaName: string | undefined | null;
  if (isVideo) {
    mediaName = "channel_title" in source ? source.channel_title : undefined;
  } else {
    mediaName = "site_name" in source ? source.site_name : undefined;
  }

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden text-left hover:border-blue-300 hover:shadow-md cursor-pointer transition-all w-full group"
    >
      {/* サムネイル */}
      <div className="relative aspect-video bg-gray-100">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {isVideo ? (
              <Play className="w-12 h-12" />
            ) : (
              <FileText className="w-12 h-12" />
            )}
          </div>
        )}
        {/* タイプバッジ */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white ${
          isVideo ? "bg-red-500" : "bg-blue-500"
        }`}>
          {isVideo ? "動画" : "記事"}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {/* タイトル */}
        <h2 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
          {title}
        </h2>

        {/* メディア名・職業タグ・日付 */}
        <p className="text-xs text-gray-500 mb-2">
          {mediaName && <span>{mediaName}</span>}
          {occupationTags && occupationTags.length > 0 && (
            <span className="ml-1.5 font-medium">
              {occupationTags[0]}
            </span>
          )}
          {(mediaName || (occupationTags && occupationTags.length > 0)) && publishedAt && <span> • </span>}
          {publishedAt && (
            <span>
              {new Date(publishedAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </p>

        {/* サマリー */}
        {cleanSummary && (
          <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">
            {cleanSummary}
          </p>
        )}

        {/* 商品数バッジ（新規追加） */}
        {productCount !== undefined && productCount > 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
              <Package className="w-3 h-3" />
              紹介商品: {productCount}件
            </span>
          </div>
        )}

        {/* タグ（SEO対策: 全タグをHTML出力、4個目以降は視覚的に非表示） */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={`text-xs px-2 py-0.5 rounded ${
                  index >= 3 ? "sr-only" : ""
                } ${
                  tag === highlightedTag
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-gray-400">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
