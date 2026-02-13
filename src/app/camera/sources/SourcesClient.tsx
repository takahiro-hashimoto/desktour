"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SourceModal } from "@/components/SourceModal";
import { CAMERA_SOURCE_BRAND_FILTERS } from "@/lib/camera/constants";
import type { SourceItem } from "./page";
import "./sources-styles.css";

interface SourcesClientProps {
  items: SourceItem[];
  total: number;
  tagCounts: Record<string, number>;
  occupationTags: string[];
  selectedOccupation?: string;
  allBrands: string[];
  selectedBrand?: string;
  subjectTags: string[];
  purposeTags: string[];
  selectedTag?: string;
  sortOrder: "newest" | "oldest";
  currentPage: number;
  limit: number;
}

export function SourcesClient({
  items,
  total,
  occupationTags,
  selectedOccupation,
  allBrands,
  selectedBrand,
  subjectTags,
  purposeTags,
  selectedTag,
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

  const updateUrl = (params: { occupation?: string | null; brand?: string | null; tag?: string | null; sort?: "newest" | "oldest"; page?: number }, shouldScroll = false) => {
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

    // occupation: 明示的にnullなら削除、undefinedなら現在値維持
    if (params.occupation !== undefined) {
      if (params.occupation !== null) {
        newParams.set("occupation", params.occupation);
      }
    } else if (selectedOccupation) {
      newParams.set("occupation", selectedOccupation);
    }

    // brand: 明示的にnullなら削除、undefinedなら現在値維持
    if (params.brand !== undefined) {
      if (params.brand !== null) {
        newParams.set("brand", params.brand);
      }
    } else if (selectedBrand) {
      newParams.set("brand", selectedBrand);
    }

    // tag: 明示的にnullなら削除、undefinedなら現在値維持
    if (params.tag !== undefined) {
      if (params.tag !== null) {
        newParams.set("tag", params.tag);
      }
    } else if (selectedTag) {
      newParams.set("tag", selectedTag);
    }

    const queryString = newParams.toString();
    router.push(queryString ? `/camera/sources?${queryString}` : "/camera/sources", { scroll: false });

    if (shouldScroll) {
      scrollToTop();
    }
  };

  const handleOccupationChange = (occupation: string) => {
    if (selectedOccupation === occupation) {
      updateUrl({ occupation: null, page: 1 });
    } else {
      updateUrl({ occupation, page: 1 });
    }
  };

  const handleBrandChange = (brand: string) => {
    if (selectedBrand === brand) {
      updateUrl({ brand: null, page: 1 });
    } else {
      updateUrl({ brand, page: 1 });
    }
  };

  const handleTagChange = (tag: string) => {
    if (selectedTag === tag) {
      updateUrl({ tag: null, page: 1 });
    } else {
      updateUrl({ tag, page: 1 });
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
    router.push(queryString ? `/camera/sources?${queryString}` : "/camera/sources", { scroll: false });
    scrollToTop();
  };

  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    const currentSort = searchParams.get("sort");
    if (currentSort === "oldest") {
      newParams.set("sort", "oldest");
    }
    const queryString = newParams.toString();
    router.push(queryString ? `/camera/sources?${queryString}` : "/camera/sources", { scroll: false });
    scrollToTop();
  };

  const handlePageChange = (page: number) => {
    updateUrl({ page }, true);
  };

  const openModal = (type: "video" | "article", id: string) => {
    setModalSource({ type, id });
    setModalOpen(true);
  };

  const hasActiveFilters = !!selectedOccupation || !!selectedBrand || !!selectedTag;
  const activeFilter = selectedOccupation;
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
          <div className="sources-filter-columns" style={{ gridTemplateColumns: "1fr" }}>
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
            {/* ブランド */}
            {allBrands.length > 0 && (
              <div>
                <div className="sources-filter-group-label">カメラブランド</div>
                <div className="sources-filter-tags">
                  {allBrands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => handleBrandChange(brand)}
                      className={`sources-filter-tag ${selectedBrand === brand ? 'active' : ''}`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 被写体 */}
            {subjectTags.length > 0 && (
              <div>
                <div className="sources-filter-group-label">被写体</div>
                <div className="sources-filter-tags">
                  {subjectTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagChange(tag)}
                      className={`sources-filter-tag ${selectedTag === tag ? 'active' : ''}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 撮影目的 */}
            {purposeTags.length > 0 && (
              <div>
                <div className="sources-filter-group-label">撮影目的</div>
                <div className="sources-filter-tags">
                  {purposeTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagChange(tag)}
                      className={`sources-filter-tag ${selectedTag === tag ? 'active' : ''}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
          let sortedTags = item.tags || [];
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
                  <div className="sources-thumb-placeholder">CAMERA GEAR</div>
                )}
                <span className={`sources-type-badge ${isVideo ? 'video' : 'article'}`}>
                  {isVideo ? "動画" : "記事"}
                </span>
              </div>
              <div className="sources-article-body">
                <h3 className="sources-article-title">
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
                </h3>
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
                {(() => {
                  const brandFilterSet = new Set<string>(CAMERA_SOURCE_BRAND_FILTERS as unknown as string[]);
                  let displayBrands = (item.brands || []).filter(b => brandFilterSet.has(b));
                  if (selectedBrand && displayBrands.includes(selectedBrand)) {
                    displayBrands = [selectedBrand, ...displayBrands.filter(b => b !== selectedBrand)];
                  }
                  return displayBrands.length > 0 ? (
                    <div className="sources-article-brands">
                      {displayBrands.map((brand) => (
                        <span key={brand} className={brand === selectedBrand ? 'highlighted' : ''}>
                          {brand}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
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
        <div className="sources-related-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Link href="/camera/category" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div className="sources-related-card-name">撮影機材カテゴリ</div>
          </Link>
          <Link href="/camera/occupation" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <div className="sources-related-card-name">職業別撮影機材セットアップ</div>
          </Link>
          <Link href="/camera/brand" className="sources-related-card">
            <div className="sources-related-card-icon">
              <i className="fa-solid fa-star"></i>
            </div>
            <div className="sources-related-card-name">撮影機材の人気ブランド</div>
          </Link>
        </div>
      </div>

      {modalOpen && modalSource && (
        <SourceModal
          isOpen={modalOpen}
          sourceType={modalSource.type}
          sourceId={modalSource.id}
          onClose={() => setModalOpen(false)}
          domain="camera"
        />
      )}
    </div>
  );
}
