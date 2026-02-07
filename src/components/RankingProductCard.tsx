"use client";

import Link from "next/link";
import type { ProductWithStats } from "@/types";
import { resolveImageUrl } from "@/lib/imageUtils";

interface RankingProductCardProps {
  product: ProductWithStats;
  rank: number;
  adoptionText: string; // 完成形のテキスト（例: 「12名のエンジニアが採用」「ミニマリストデスクで8件採用」）
}

export function RankingProductCard({
  product,
  rank,
  adoptionText,
}: RankingProductCardProps) {
  // コメントを1件だけ取得
  const comment = product.comments?.[0]?.reason;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
      {/* 商品画像エリア */}
      <div className="relative aspect-square bg-white flex items-center justify-center p-6">
        {/* ランキングバッジ */}
        <div className="absolute top-3 left-3 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
          No.{rank}
        </div>

        {resolveImageUrl(product.amazon_image_url) ? (
          <img
            src={resolveImageUrl(product.amazon_image_url)!}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="text-gray-300 text-6xl">📦</div>
        )}
      </div>

      {/* 商品情報 */}
      <div className="p-5 flex-1 flex flex-col">
        {/* ブランド・年 */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{product.brand || "ブランド不明"}</span>
          {/* 年情報があれば表示（将来的にDBから取得） */}
        </div>

        {/* 商品名 */}
        <h3 className="font-bold text-gray-900 text-base mb-3 line-clamp-2">
          {product.name}
        </h3>

        {/* 採用数 */}
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
          <svg
            className="w-4 h-4"
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
          <span>{adoptionText}</span>
        </div>

        {/* コメント */}
        {comment && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-1">
            {comment}
          </p>
        )}

        {/* CTAボタン */}
        <Link
          href={`/product/${product.id}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-medium transition-colors mb-3"
        >
          詳細データの分析を見る →
        </Link>

        {/* 外部リンク */}
        <div className="flex items-center justify-center gap-4 text-xs">
          {product.amazon_url && (
            <a
              href={product.amazon_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="text-blue-600 hover:underline"
            >
              Amazonで価格を見る
            </a>
          )}
          {/* 楽天リンク（将来的にDBから取得） */}
          <span className="text-gray-400">楽天で価格を見る</span>
        </div>
      </div>
    </div>
  );
}
