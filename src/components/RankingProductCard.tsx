"use client";

import { memo } from "react";
import Link from "next/link";
import type { ProductWithStats } from "@/types";
import { resolveImageUrl } from "@/lib/imageUtils";
import { generateAmazonSearchUrl, generateRakutenSearchUrl } from "@/lib/affiliateLinks";
import { formatPriceWithSymbol, formatPriceDate } from "@/lib/format-utils";

interface RankingProductCardProps {
  product: ProductWithStats;
  rank: number;
  adoptionText: string; // 完成形のテキスト（例: 「12名のエンジニアが採用」「ミニマルデスクで8件採用」）
}

export const RankingProductCard = memo(function RankingProductCard({
  product,
  rank,
  adoptionText,
}: RankingProductCardProps) {
  // コメントを1件だけ取得
  const comment = product.comments?.[0]?.comment;

  // 画像URL
  const imageUrl = resolveImageUrl(product.amazon_image_url || product.rakuten_image_url);

  // 画像リンク先（Amazon or 楽天）
  const imageLink = product.amazon_url || product.rakuten_url;

  // 公式サイトかどうか
  const isOfficialSite = product.product_source === "official";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
      {/* 商品画像エリア */}
      <div className="relative bg-white flex items-center justify-center p-4" style={{ height: '200px' }}>
        {/* ランキングバッジ */}
        <div className="absolute top-2 left-2 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
          No.{rank}
        </div>

        {imageUrl ? (
          imageLink ? (
            <a
              href={imageLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="h-full w-full flex items-center justify-center"
            >
              <img
                src={imageUrl}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </a>
          ) : (
            <img
              src={imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          )
        ) : (
          <div className="text-gray-300 text-4xl">📦</div>
        )}
      </div>

      {/* 商品情報 */}
      <div className="p-4 flex-1 flex flex-col">
        {/* ブランド */}
        <div className="text-xs text-gray-500 mb-1">
          <span>{product.brand || "ブランド不明"}</span>
        </div>

        {/* 商品名 */}
        <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-2">
          {product.name}
        </h3>

        {/* デスクツアー登場回数 | 価格 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-blue-600 text-xs">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{product.mention_count}回登場</span>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900 text-base">
              {formatPriceWithSymbol(product.amazon_price)}
            </p>
            {product.updated_at && (
              <p className="text-gray-400 text-[10px] mt-0.5">
                {formatPriceDate(product.updated_at) || ""}
              </p>
            )}
          </div>
        </div>

        {/* コメント */}
        {comment && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2 flex-1">
            {comment}
          </p>
        )}

        {/* CTAボタン */}
        <Link
          href={`/desktour/product/${product.slug || product.id}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-lg text-sm font-medium transition-colors mb-2"
        >
          詳細を見る
        </Link>

        {/* 外部リンク */}
        {!isOfficialSite && (
          <div className="flex items-center justify-center gap-3 text-xs">
            {product.amazon_url ? (
              <>
                <a
                  href={product.amazon_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-blue-600 hover:underline"
                >
                  Amazonで探す
                </a>
                <a
                  href={generateRakutenSearchUrl(product.name)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-red-600 hover:underline"
                >
                  楽天で探す
                </a>
              </>
            ) : product.rakuten_url ? (
              <>
                <a
                  href={generateAmazonSearchUrl(product.name)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-blue-600 hover:underline"
                >
                  Amazonで探す
                </a>
                <a
                  href={product.rakuten_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-red-600 hover:underline"
                >
                  楽天で探す
                </a>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});
