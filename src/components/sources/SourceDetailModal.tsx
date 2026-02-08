"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, ExternalLink, Play, FileText } from "lucide-react";
import type { SourceDetail } from "@/types";
import { resolveImageUrl } from "@/lib/imageUtils";
import { getProductLinks } from "@/lib/affiliateLinks";

interface SourceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: "video" | "article";
  sourceId: string;
  targetProductId?: string;
}

export function SourceDetailModal({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  targetProductId,
}: SourceDetailModalProps) {
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const productRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (isOpen && sourceId) {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type: sourceType,
        id: sourceId,
      });
      fetch(`/api/source?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((data) => {
          setSource(data);
          setLoading(false);
        })
        .catch(() => {
          setError("データの取得に失敗しました");
          setLoading(false);
        });
    }
  }, [isOpen, sourceType, sourceId]);

  useEffect(() => {
    if (source && targetProductId && !loading) {
      setTimeout(() => {
        const targetEl = productRefs.current.get(targetProductId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          targetEl.classList.add("source-modal__product--highlight");
          setTimeout(() => {
            targetEl.classList.remove("source-modal__product--highlight");
          }, 2000);
        }
      }, 100);
    }
  }, [source, targetProductId, loading]);

  if (!isOpen) return null;

  return (
    <div className="source-modal">
      <div className="source-modal__backdrop" onClick={onClose} />

      <div className="source-modal__container">
        {/* Header */}
        <div className="source-modal__header">
          <div className="source-modal__header-title">
            {sourceType === "video" ? (
              <Play className="source-modal__icon source-modal__icon--video" />
            ) : (
              <FileText className="source-modal__icon source-modal__icon--article" />
            )}
            <span>{sourceType === "video" ? "動画" : "記事"}の詳細</span>
          </div>
          <button onClick={onClose} className="source-modal__close">
            <X className="source-modal__close-icon" />
          </button>
        </div>

        {/* Content */}
        <div className="source-modal__content">
          {loading && (
            <div className="source-modal__loading">
              <div className="source-modal__spinner" />
            </div>
          )}

          {error && (
            <div className="source-modal__error">{error}</div>
          )}

          {source && (
            <div className="source-modal__body">
              {/* Source Info */}
              <div className="source-modal__info">
                {source.thumbnail_url && (
                  <img
                    src={source.thumbnail_url}
                    alt={source.title}
                    className="source-modal__thumbnail"
                    loading="lazy"
                  />
                )}
                <div className="source-modal__details">
                  <h3 className="source-modal__title">{source.title}</h3>
                  <p className="source-modal__author">
                    {source.type === "video" ? source.channel_title : source.author}
                  </p>
                  {source.published_at && (
                    <p className="source-modal__date">
                      {new Date(source.published_at).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                  {source.type === "video" && source.video_id && (
                    <a
                      href={`https://www.youtube.com/watch?v=${source.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-modal__link source-modal__link--video"
                    >
                      <ExternalLink className="source-modal__link-icon" />
                      YouTubeで見る
                    </a>
                  )}
                  {source.type === "article" && source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-modal__link source-modal__link--article"
                    >
                      <ExternalLink className="source-modal__link-icon" />
                      記事を読む
                    </a>
                  )}
                </div>
              </div>

              {/* Summary */}
              {source.summary && (
                <div className="source-modal__section">
                  <h4 className="source-modal__section-title">内容サマリー</h4>
                  <p className="source-modal__summary">{source.summary}</p>
                </div>
              )}

              {/* Tags */}
              {((source.tags && source.tags.length > 0) || (source.occupation_tags && source.occupation_tags.length > 0)) && (
                <div className="source-modal__tags">
                  {source.occupation_tags?.map((tag) => (
                    <span key={`occupation-${tag}`} className="source-modal__tag source-modal__tag--occupation">
                      {tag}
                    </span>
                  ))}
                  {source.tags?.map((tag) => (
                    <span key={`setup-${tag}`} className="source-modal__tag source-modal__tag--setup">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Products */}
              {source.products && source.products.length > 0 && (
                <div className="source-modal__section">
                  <h4 className="source-modal__section-title">
                    紹介されている商品（{source.products.length}件）
                  </h4>
                  <div className="source-modal__products">
                    {source.products.map((product) => (
                      <div
                        key={product.id}
                        ref={(el) => {
                          if (el && product.id) {
                            productRefs.current.set(product.id, el);
                          }
                        }}
                        className="source-modal__product"
                      >
                        {resolveImageUrl(product.amazon_image_url) ? (
                          <img
                            src={resolveImageUrl(product.amazon_image_url)!}
                            alt={product.name}
                            className="source-modal__product-image"
                            loading="lazy"
                          />
                        ) : (
                          <div className="source-modal__product-placeholder">📦</div>
                        )}

                        <div className="source-modal__product-info">
                          <h5 className="source-modal__product-name">{product.name}</h5>
                          <p className="source-modal__product-meta">
                            {product.brand && `${product.brand} / `}
                            {product.category}
                          </p>

                          {product.reason && (
                            <p className="source-modal__product-reason">{product.reason}</p>
                          )}

                          {product.mention_count && product.mention_count > 1 && (
                            <p className="source-modal__product-mention">
                              サイト内で{product.mention_count}件紹介されています
                            </p>
                          )}

                          {(() => {
                            const { amazonUrl, rakutenUrl } = getProductLinks({
                              amazon_url: product.amazon_url,
                              amazon_model_number: product.amazon_model_number,
                              name: product.name,
                            });
                            return (
                              <div className="source-modal__product-actions">
                                <Link
                                  href={`/product/${product.slug || product.id}`}
                                  className="source-modal__product-link source-modal__product-link--detail"
                                  onClick={onClose}
                                >
                                  詳細を見る
                                </Link>
                                <a
                                  href={amazonUrl}
                                  target="_blank"
                                  rel="noopener noreferrer sponsored"
                                  className="source-modal__product-link source-modal__product-link--amazon"
                                >
                                  Amazon
                                </a>
                                <a
                                  href={rakutenUrl}
                                  target="_blank"
                                  rel="noopener noreferrer sponsored"
                                  className="source-modal__product-link source-modal__product-link--rakuten"
                                >
                                  楽天
                                </a>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
