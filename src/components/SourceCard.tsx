"use client";

import type { Video, Article } from "@/lib/supabase";

type ExtendedVideo = Video & { product_count?: number };
type ExtendedArticle = Article & { product_count?: number };

type GenericSource = {
  title: string;
  thumbnail_url?: string | null;
  summary?: string;
  tags?: string[];
  published_at?: string | null;
  product_count?: number;
  occupation_tags?: string[];
  video_id?: string;
  channel_title?: string;
  subscriber_count?: number;
  url?: string;
  author?: string | null;
  site_name?: string | null;
};

interface SourceCardProps {
  source: ExtendedVideo | ExtendedArticle | GenericSource;
  type: "video" | "article";
  onClick: () => void;
  highlightedTag?: string;
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

  let cleanSummary = summary;
  if (!isVideo && summary) {
    const articleContentMatch = summary.match(/この記事では[、,]?\s*(.+)/s);
    if (articleContentMatch) {
      cleanSummary = articleContentMatch[1].trim();
    } else if (summary.startsWith("この記事の著者")) {
      cleanSummary = undefined;
    }
  }

  let mediaName: string | undefined | null;
  if (isVideo) {
    mediaName = "channel_title" in source ? source.channel_title : undefined;
  } else {
    mediaName = "site_name" in source ? source.site_name : undefined;
  }

  return (
    <button onClick={onClick} className="sources-card">
      {/* サムネイル */}
      <div className="sources-card__thumb">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="sources-card__img"
            loading="lazy"
          />
        ) : (
          <div className="sources-card__placeholder">
            <i className={`fas ${isVideo ? 'fa-play' : 'fa-file-text'} sources-card__placeholder-icon`}></i>
          </div>
        )}
        <span className={`sources-card__badge ${isVideo ? 'sources-card__badge--video' : 'sources-card__badge--article'}`}>
          {isVideo ? "動画" : "記事"}
        </span>
      </div>

      {/* コンテンツ */}
      <div className="sources-card__body">
        <h3 className="sources-card__title">{title}</h3>

        <div className="sources-card__meta">
          {mediaName && <span className="sources-card__author">{mediaName}</span>}
          {occupationTags && occupationTags.length > 0 && (
            <>
              {mediaName && <span className="sources-card__dot"></span>}
              <span className="sources-card__occupation">{occupationTags[0]}</span>
            </>
          )}
          {publishedAt && (
            <>
              {(mediaName || (occupationTags && occupationTags.length > 0)) && <span className="sources-card__dot"></span>}
              <span>{new Date(publishedAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })}</span>
            </>
          )}
        </div>

        {cleanSummary && (
          <p className="sources-card__excerpt">{cleanSummary}</p>
        )}

        {productCount !== undefined && productCount > 0 && (
          <div className="sources-card__products">
            <i className="fas fa-link"></i> 紹介商品: {productCount}件
          </div>
        )}

        {tags.length > 0 && (
          <div className="sources-card__tags">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`sources-card__tag ${tag === highlightedTag ? 'sources-card__tag--highlighted' : ''}`}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="sources-card__more">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
