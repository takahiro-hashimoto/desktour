"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, ExternalLink, Play, FileText } from "lucide-react";
import type { SourceDetail } from "@/types";
import { resolveImageUrl } from "@/lib/imageUtils";
import { getProductLinks } from "@/lib/affiliateLinks";
import { productUrl } from "@/lib/constants";
import { cameraProductUrl } from "@/lib/camera/constants";
import { CATEGORY_PRIORITY, getCategoryEnglish } from "@/lib/category-utils";
import { CAMERA_CATEGORY_PRIORITY, getCameraCategoryEnglish } from "@/lib/camera/category-utils";

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: "video" | "article";
  sourceId: string;
  targetProductId?: string; // クリックされた商品のID
  domain?: "desktour" | "camera"; // ドメイン（デフォルト: desktour）
}

export function SourceModal({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  targetProductId,
  domain = "desktour",
}: SourceModalProps) {
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const productRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // モーダル表示中は背景スクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && sourceId) {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type: sourceType,
        id: sourceId,
      });
      const apiBase = domain === "camera" ? "/api/camera/source" : "/api/source";
      fetch(`${apiBase}?${params.toString()}`)
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

  // ターゲット商品までスクロール
  useEffect(() => {
    if (source && targetProductId && !loading) {
      // 少し遅延させてDOMが描画されるのを待つ
      setTimeout(() => {
        const targetEl = productRefs.current.get(targetProductId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          // ハイライト効果
          targetEl.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
          setTimeout(() => {
            targetEl.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
          }, 2000);
        }
      }, 100);
    }
  }, [source, targetProductId, loading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {sourceType === "video" ? (
              <Play className="w-5 h-5 text-red-500" />
            ) : (
              <FileText className="w-5 h-5 text-blue-500" />
            )}
            <span className="font-medium text-gray-700">
              {sourceType === "video" ? "動画" : "記事"}の詳細
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500">{error}</div>
          )}

          {source && (
            <div className="space-y-6">
              {/* Source Info */}
              <div className="flex items-center gap-6">
                {source.thumbnail_url && (
                  <img
                    src={source.thumbnail_url}
                    alt={source.title}
                    className="w-80 h-48 object-cover rounded flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {source.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {source.type === "video"
                      ? source.channel_title
                      : source.author}
                  </p>
                  {source.published_at && (
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(source.published_at).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                  {source.type === "video" && source.video_id && (
                    <a
                      href={`https://www.youtube.com/watch?v=${source.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline mt-3"
                    >
                      <ExternalLink className="w-4 h-4" />
                      YouTubeで見る
                    </a>
                  )}
                  {source.type === "article" && source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-3"
                    >
                      <ExternalLink className="w-4 h-4" />
                      記事を読む
                    </a>
                  )}
                </div>
              </div>

              {/* Summary */}
              {source.summary && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">内容サマリー</h4>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded space-y-2">
                    {source.summary.split(/(?<=。)\s+/).map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {((source.tags && source.tags.length > 0) || (source.occupation_tags && source.occupation_tags.length > 0)) && (
                <div className="flex flex-wrap gap-2">
                  {/* 職業タグ（青） */}
                  {source.occupation_tags?.map((tag) => (
                    <span
                      key={`occupation-${tag}`}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {/* デスクセットアップタグ（グレー） */}
                  {source.tags?.map((tag) => (
                    <span
                      key={`setup-${tag}`}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Products */}
              {source.products && source.products.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">
                    紹介されている商品（{source.products.length}件）
                  </h4>
                  {(() => {
                    // カテゴリ別にグループ化
                    const grouped: Record<string, typeof source.products> = {};
                    for (const product of source.products) {
                      const cat = product.category;
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(product);
                    }
                    // 優先順でソート
                    const priority = domain === "camera" ? CAMERA_CATEGORY_PRIORITY : CATEGORY_PRIORITY;
                    const sortedCategories = [
                      ...priority.filter((cat) => grouped[cat]),
                      ...Object.keys(grouped).filter(
                        (cat) => !(priority as readonly string[]).includes(cat)
                      ),
                    ];
                    const getEnglish = domain === "camera" ? getCameraCategoryEnglish : getCategoryEnglish;

                    return sortedCategories.map((category) => (
                      <div key={category} className="mb-6 last:mb-0">
                        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          {getEnglish(category)}
                          <span className="ml-2 text-gray-300 normal-case">— {category}（{grouped[category].length}）</span>
                        </h5>
                        <div className="space-y-4">
                          {grouped[category].map((product) => (
                            <div
                              key={product.id}
                              ref={(el) => {
                                if (el && product.id) {
                                  productRefs.current.set(product.id, el);
                                }
                              }}
                              className="flex items-center gap-5 p-4 bg-gray-50 rounded-lg transition-all"
                            >
                              {/* 商品画像 */}
                              {resolveImageUrl(product.amazon_image_url) ? (
                                <img
                                  src={resolveImageUrl(product.amazon_image_url)!}
                                  alt={product.name}
                                  className="w-24 h-24 object-contain bg-white rounded flex-shrink-0"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400 flex-shrink-0">
                                  📦
                                </div>
                              )}

                              {/* 商品情報 */}
                              <div className="flex-1 min-w-0">
                                {/* 商品名 + 登場ラベル */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-bold text-gray-900 text-base">
                                    {product.name}
                                  </h5>
                                  {product.mention_count && product.mention_count > 1 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">
                                      サイト内で{product.mention_count}件登場
                                    </span>
                                  )}
                                </div>

                                {/* ブランド */}
                                {product.brand && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {product.brand}
                                  </p>
                                )}

                                {/* コメント（省略なし） */}
                                {product.reason && (
                                  <p className="text-sm text-gray-700 mt-3 leading-relaxed">
                                    {product.reason}
                                  </p>
                                )}

                                {/* ボタン */}
                                {(() => {
                                  const { amazonUrl, rakutenUrl } = getProductLinks({
                                    amazon_url: product.amazon_url,
                                    amazon_model_number: product.amazon_model_number,
                                    name: product.name,
                                  });
                                  return (
                                    <div className="flex items-center gap-4 mt-3">
                                      <Link
                                        href={domain === "camera" ? cameraProductUrl(product) : productUrl(product)}
                                        className="text-sm text-blue-600 hover:underline"
                                        onClick={onClose}
                                      >
                                        詳細を見る
                                      </Link>
                                      <a
                                        href={amazonUrl}
                                        target="_blank"
                                        rel="noopener noreferrer sponsored"
                                        className="text-sm text-orange-600 hover:underline"
                                      >
                                        Amazon
                                      </a>
                                      <a
                                        href={rakutenUrl}
                                        target="_blank"
                                        rel="noopener noreferrer sponsored"
                                        className="text-sm text-red-600 hover:underline"
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
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
