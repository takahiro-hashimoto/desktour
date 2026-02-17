"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SourceModal } from "@/components/SourceModal";
import type { SourceItem } from "./page";
import "./sources-styles.css";

interface SourcesClientProps {
  items: SourceItem[];
  total: number;
  availableTags: string[];
  tagCounts: Record<string, number>;
  selectedTags: string[];
  occupationTags: string[];
  selectedOccupation?: string;
  environmentTags: string[];
  selectedEnvironment?: string;
  selectedStyle?: string;
  sortOrder: "newest" | "oldest";
  currentPage: number;
  limit: number;
}

export function SourcesClient({
  items,
  total,
  availableTags,
  occupationTags,
  selectedOccupation,
  environmentTags,
  selectedEnvironment,
  selectedStyle,
  sortOrder,
  currentPage,
  limit,
}: SourcesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState<{
    type: "video" | "article";
    id: string;
  } | null>(null);

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#video-')) {
      const videoId = hash.replace('#video-', '');
      const video = items.find(item => item.type === 'video' && item.id === videoId);
      if (video) {
        openModal('video', videoId);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else if (hash.startsWith('#article-')) {
      const articleId = hash.replace('#article-', '');
      const article = items.find(item => item.type === 'article' && item.id === articleId);
      if (article) {
        openModal('article', articleId);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [items]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateUrl = (params: { style?: string | null; occupation?: string | null; environment?: string | null; sort?: "newest" | "oldest"; page?: number }, shouldScroll = false) => {
    const newParams = new URLSearchParams();
    const currentSort = searchParams.get("sort");
    if (params.sort !== undefined) {
      if (params.sort === "oldest") {
        newParams.set("sort", "oldest");
      }
    } else if (currentSort === "oldest") {
      newParams.set("sort", "oldest");
    }

    if (params.page !== undefined && params.page > 1) {
      newParams.set("page", params.page.toString());
    }

    if (params.style !== undefined && params.style !== null) {
      newParams.set("style", params.style);
    } else if (params.occupation !== undefined && params.occupation !== null) {
      newParams.set("occupation", params.occupation);
    } else if (params.environment !== undefined && params.environment !== null) {
      newParams.set("environment", params.environment);
    }

    const queryString = newParams.toString();
    router.push(queryString ? `/desktour/sources?${queryString}` : "/desktour/sources", { scroll: false });

    if (shouldScroll) {
      scrollToTop();
    }
  };

  const handleOccupationChange = (occupation: string) => {
    if (selectedOccupation === occupation) {
      updateUrl({ occupation: null, style: null, environment: null, page: 1 });
    } else {
      updateUrl({ occupation, page: 1 });
    }
  };

  const handleEnvironmentChange = (environment: string) => {
    if (selectedEnvironment === environment) {
      updateUrl({ environment: null, style: null, occupation: null, page: 1 });
    } else {
      updateUrl({ environment, page: 1 });
    }
  };

  const handleStyleChange = (style: string) => {
    if (selectedStyle === style) {
      updateUrl({ style: null, occupation: null, environment: null, page: 1 });
    } else {
      updateUrl({ style, page: 1 });
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value as "newest" | "oldest";
    const newParams = new URLSearchParams(searchParams.toString());
    if (sort === "oldest") {
      newParams.set("sort", "oldest");
    } else {
      newParams.delete("sort");
    }
    newParams.delete("page");
    const queryString = newParams.toString();
    router.push(queryString ? `/desktour/sources?${queryString}` : "/desktour/sources", { scroll: false });
    scrollToTop();
  };

  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    const currentSort = searchParams.get("sort");
    if (currentSort === "oldest") {
      newParams.set("sort", "oldest");
    }
    const queryString = newParams.toString();
    router.push(queryString ? `/desktour/sources?${queryString}` : "/desktour/sources", { scroll: false });
    scrollToTop();
  };

  const handlePageChange = (page: number) => {
    updateUrl({ page }, true);
  };

  const openModal = (type: "video" | "article", id: string) => {
    setModalSource({ type, id });
    setModalOpen(true);
  };

  const styleTags = availableTags;
  const hasActiveFilters = selectedOccupation || selectedEnvironment || selectedStyle;
  const activeFilter = selectedOccupation || selectedEnvironment || selectedStyle;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="sources-container">
      {/* FILTER */}
      <div className="sources-filter-section">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="sources-filter-toggle"
          data-open={filterOpen ? "true" : "false"}
        >
          好みの動画・記事を絞り込む
        </button>
        {filterOpen && (
          <div className="sources-filter-box">
          <div className="sources-filter-columns">
            {/* 職業 */}
            <div>
              <div className="sources-filter-group-label">職業</div>
              <div className="sources-filter-tags">
                {occupationTags.map((occupation) => (
                  <button
                    key={occupation}
                    onClick={() => handleOccupationChange(occupation)}
                    className={`sources-filter-tag ${selectedOccupation === occupation ? 'active' : ''}`}
                  >
                    {occupation}
                  </button>
                ))}
              </div>
            </div>

            {/* スタイル */}
            <div>
              <div className="sources-filter-group-label">スタイル</div>
              <div className="sources-filter-tags">
                {styleTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleStyleChange(tag)}
                    className={`sources-filter-tag ${selectedStyle === tag ? 'active' : ''}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 環境 */}
            <div>
              <div className="sources-filter-group-label">環境</div>
              <div className="sources-filter-tags">
                {environmentTags.map((env) => (
                  <button
                    key={env}
                    onClick={() => handleEnvironmentChange(env)}
                    className={`sources-filter-tag ${selectedEnvironment === env ? 'active' : ''}`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="sources-filter-clear">
              <button onClick={handleClearFilters} className="sources-filter-clear-btn">
                フィルターをクリア
              </button>
            </div>
          )}
          </div>
        )}
      </div>

      {/* RESULTS BAR */}
      <div className="sources-results-bar">
        <div className="sources-results-count">
          表示件数：<strong>{total}</strong>件
        </div>
        <div className="sources-sort-select">
          <select value={sortOrder} onChange={handleSortChange}>
            <option value="newest">投稿日が新しい順</option>
            <option value="oldest">投稿日が古い順</option>
          </select>
        </div>
      </div>

      {/* ARTICLE GRID */}
      <div className="sources-article-grid">
        {items.map((item) => {
          const isVideo = item.type === "video";
          // tags + occupation_tags をマージ（重複排除）
          const baseTags = item.tags || [];
          const occTags = item.occupation_tags || [];
          let sortedTags = [...new Set([...occTags, ...baseTags])];
          if (activeFilter && sortedTags.includes(activeFilter)) {
            sortedTags = [activeFilter, ...sortedTags.filter(t => t !== activeFilter)];
          }

          let cleanSummary: string | undefined = item.summary;
          if (!isVideo && item.summary) {
            const articleContentMatch = item.summary.match(/この記事では[、,]?\s*(.+)/s);
            if (articleContentMatch) {
              cleanSummary = articleContentMatch[1].trim();
            } else if (item.summary.startsWith("この記事の著者")) {
              cleanSummary = undefined;
            }
          }

          const mediaName = isVideo ? item.channel_title : item.site_name;
          const occupationTag = item.occupation_tags && item.occupation_tags.length > 0 ? item.occupation_tags[0] : undefined;

          return (
            <button
              key={item.id}
              onClick={() => openModal(item.type, item.id)}
              className="sources-article-card"
            >
              <div className="sources-article-thumb">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} loading="lazy" />
                ) : (
                  <div className="sources-thumb-placeholder">DESK TOUR</div>
                )}
                <span className={`sources-type-badge ${isVideo ? 'video' : 'article'}`}>
                  {isVideo ? "動画" : "記事"}
                </span>
              </div>
              <div className="sources-article-body">
                <h2 className="sources-article-title">
                  {!isVideo && item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="sources-article-link"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h2>
                <div className="sources-article-meta">
                  {mediaName && <span className="author">{mediaName}</span>}
                  {occupationTag && (
                    <>
                      {mediaName && <span className="dot"></span>}
                      <span>{occupationTag}</span>
                    </>
                  )}
                  {item.published_at && (
                    <>
                      {(mediaName || occupationTag) && <span className="dot"></span>}
                      <span>
                        {new Date(item.published_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </div>
                {cleanSummary && (
                  <p className="sources-article-excerpt">{cleanSummary}</p>
                )}
                {item.product_count !== undefined && item.product_count > 0 && (
                  <div className="sources-article-products">
                    <i className="fa-solid fa-link"></i> 紹介商品: {item.product_count}件
                  </div>
                )}
                {sortedTags.length > 0 && (
                  <div className="sources-article-tags">
                    {sortedTags.slice(0, 3).map((tag) => (
                      <span key={tag} className={tag === activeFilter ? 'highlighted' : ''}>
                        {tag}
                      </span>
                    ))}
                    {sortedTags.length > 3 && (
                      <span className="more-tags">+{sortedTags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="sources-empty-state">
          <p className="sources-empty-text">該当するコンテンツがありません</p>
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="sources-empty-btn">
              フィルターをクリア
            </button>
          )}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="sources-pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            前へ
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={currentPage === pageNum ? 'active' : ''}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            次へ
          </button>
        </div>
      )}

      {/* RELATED CONTENT */}
      <div className="sources-related-section">
        <div className="sources-related-title">関連コンテンツ</div>
        <div className="sources-related-grid">
          <Link href="/desktour/category" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div className="sources-related-card-name">デスク周りのガジェット</div>
          </Link>
          <Link href="/desktour/occupation" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <div className="sources-related-card-name">職業別デスクセットアップ</div>
          </Link>
          <Link href="/desktour/style" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-palette"></i>
            </div>
            <div className="sources-related-card-name">スタイル別デスクセットアップ</div>
          </Link>
          <Link href="/desktour/brand" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-star"></i>
            </div>
            <div className="sources-related-card-name">デスク周り商品の人気ブランド</div>
          </Link>
        </div>
      </div>

      {modalOpen && modalSource && (
        <SourceModal
          isOpen={modalOpen}
          sourceType={modalSource.type}
          sourceId={modalSource.id}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
