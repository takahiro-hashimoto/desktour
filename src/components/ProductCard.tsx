"use client";

import { memo, useState } from "react";
import Link from "next/link";
import type { ProductWithStats } from "@/types";
import { getPriceRangeLabel } from "@/types";
import { SourceModal } from "./SourceModal";
import { resolveImageUrl } from "@/lib/imageUtils";
import { productUrl } from "@/lib/constants";

interface ProductCardProps {
  product: ProductWithStats;
  showComments?: boolean;
  maxComments?: number; // 表示するコメント数の上限（undefinedで全件表示）
}

export const ProductCard = memo(function ProductCard({
  product,
  showComments = true,
  maxComments,
}: ProductCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{
    type: "video" | "article";
    id: string;
  } | null>(null);

  // アフィリエイトリンク（amazon_urlがあればそれを使用）
  const affiliateUrl = product.amazon_url || "#";

  // 表示するコメント
  const displayComments = product.comments && showComments
    ? (maxComments ? product.comments.slice(0, maxComments) : product.comments)
    : [];

  const hasMoreComments = product.comments && maxComments && product.comments.length > maxComments;

  const handleCommentClick = (sourceType: "video" | "article", sourceId?: string) => {
    if (sourceId) {
      setSelectedSource({ type: sourceType, id: sourceId });
      setModalOpen(true);
    }
  };

  return (
    <>
      <article className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
        {/* 商品画像 - アフィリエイトリンク付き */}
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-square bg-white flex items-center justify-center p-4"
        >
          {resolveImageUrl(product.amazon_image_url) ? (
            <img
              src={resolveImageUrl(product.amazon_image_url)!}
              alt={product.name}
              width={300}
              height={300}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-gray-300 text-4xl">📦</div>
          )}
        </a>

        {/* 商品情報 */}
        <div className="p-4 flex-1 flex flex-col">
          {/* 商品基本情報 */}
          <div className="flex-1">
            {/* ブランド + 種類タグ */}
            <div className="flex items-center gap-2 mb-1">
              {product.brand && (
                <p className="text-xs text-gray-500">{product.brand}</p>
              )}
              {product.tags?.[0] && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                  {product.tags[0]}
                </span>
              )}
            </div>

            {/* 商品名 */}
            <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
              <Link
                href={productUrl(product)}
                className="hover:text-blue-600"
              >
                {product.name}
              </Link>
            </h3>

            {/* 価格・使用者数 */}
            <div className="flex items-center gap-2 mb-3">
              {product.amazon_price ? (
                <span className="text-sm font-medium text-orange-600">
                  ¥{product.amazon_price.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-gray-400">
                  {getPriceRangeLabel(product.price_range)}
                </span>
              )}
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">
                {product.mention_count}人が使用
              </span>
            </div>

            {/* コメント */}
            {displayComments.length > 0 && (
              <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                {displayComments.map((comment, index) => (
                  <button
                    key={index}
                    onClick={() => handleCommentClick(comment.source_type, comment.source_id)}
                    className={`block w-full text-left text-xs text-gray-600 ${
                      comment.source_id
                        ? "hover:text-blue-600 hover:bg-blue-50 cursor-pointer rounded px-1 py-0.5 -mx-1"
                        : ""
                    }`}
                    disabled={!comment.source_id}
                  >
                    「{comment.comment}」
                    {comment.source_id && (
                      <span className="text-blue-500 ml-1">→</span>
                    )}
                  </button>
                ))}
                {hasMoreComments && (
                  <p className="text-xs text-gray-400">
                    他{product.comments!.length - maxComments!}件のコメント
                  </p>
                )}
              </div>
            )}
          </div>

          {/* リンク - 常に最下部 */}
          <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
            <Link
              href={productUrl(product)}
              className="text-xs text-blue-600 hover:underline"
            >
              詳細を見る
            </Link>
            {product.amazon_url && (
              <>
                <span className="text-gray-300">|</span>
                <a
                  href={product.amazon_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-xs text-orange-600 hover:underline"
                >
                  Amazonで見る
                </a>
              </>
            )}
          </div>
        </div>
      </article>

      {/* モーダル */}
      {selectedSource && (
        <SourceModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedSource(null);
          }}
          sourceType={selectedSource.type}
          sourceId={selectedSource.id}
        />
      )}
    </>
  );
});
