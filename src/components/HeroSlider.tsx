"use client";

import { SiteStats } from "@/types";
import { resolveImageUrl } from "@/lib/imageUtils";

interface HeroSliderProps {
  stats: SiteStats;
  productImages?: string[]; // DBから取得した商品画像URL
}

export function HeroSlider({ stats, productImages = [] }: HeroSliderProps) {
  // プレースホルダーグラデーション（画像がない場合のフォールバック）
  const placeholderGradients = [
    "from-slate-700 to-slate-900",
    "from-zinc-700 to-zinc-900",
    "from-neutral-700 to-neutral-900",
    "from-stone-700 to-stone-900",
    "from-gray-700 to-gray-900",
    "from-slate-800 to-slate-950",
    "from-zinc-800 to-zinc-950",
    "from-neutral-800 to-neutral-950",
  ];

  // 3段用に画像を分割（各段8枚ずつ）
  const imagesPerRow = 8;
  const row1Images = productImages.slice(0, imagesPerRow);
  const row2Images = productImages.slice(imagesPerRow, imagesPerRow * 2);
  const row3Images = productImages.slice(imagesPerRow * 2, imagesPerRow * 3);

  // 画像が足りない場合はグラデーションで埋める
  const fillRow = (images: string[], count: number) => {
    const result = [...images];
    while (result.length < count) {
      result.push(""); // 空文字はグラデーション表示
    }
    return result;
  };

  const rows = [
    { images: fillRow(row1Images, imagesPerRow), direction: "left", duration: 25 },
    { images: fillRow(row2Images, imagesPerRow), direction: "right", duration: 30 },
    { images: fillRow(row3Images, imagesPerRow), direction: "left", duration: 28 },
  ];

  return (
    <section className="relative overflow-hidden bg-gray-900">
      {/* 3段スクロール画像背景 */}
      <div className="absolute inset-0 flex flex-col justify-center gap-3 opacity-40">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="relative h-28 overflow-hidden"
          >
            <div
              className={`flex gap-3 absolute ${
                row.direction === "left" ? "animate-scroll-left" : "animate-scroll-right"
              }`}
              style={{
                animationDuration: `${row.duration}s`,
              }}
            >
              {/* 2セット配置してシームレスにループ */}
              {[...row.images, ...row.images].map((imgUrl, imgIndex) => {
                const resolvedUrl = resolveImageUrl(imgUrl);
                return (
                  <div
                    key={`${rowIndex}-${imgIndex}`}
                    className={`flex-shrink-0 w-44 h-28 rounded-xl overflow-hidden ${
                      !resolvedUrl ? `bg-gradient-to-br ${placeholderGradients[imgIndex % placeholderGradients.length]}` : ""
                    }`}
                  >
                    {resolvedUrl ? (
                      <img
                        src={resolvedUrl}
                        alt="デスクツアーで紹介された商品"
                        className="w-full h-full object-contain bg-white"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
                        🖥️
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* オーバーレイグラデーション */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/40 to-gray-900/60" />

      {/* メインコンテンツ */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
        {/* バッジ */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-full px-4 py-2 text-sm">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-gray-300">ISSUE 2026.02 — NOW LIVE</span>
          </div>
        </div>

        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            デスク環境、
            <br />
            <span className="text-orange-500">2026</span>年の最適解。
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {stats.total_mentions.toLocaleString()}件以上のレビューから導き出した、本当に残るガジェットの条件。
            <br className="hidden md:block" />
            第一線で活躍するプロが選ぶ「一軍」を総力取材。
          </p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mt-12">
          <StatCard label="掲載商品" value={stats.total_products} />
          <StatCard label="言及データ" value={stats.total_mentions} />
          <StatCard label="デスクツアー" value={stats.total_videos + stats.total_articles} suffix="件" />
          <StatCard label="投稿者" value={stats.total_influencers} suffix="人" />
        </div>
      </div>

      {/* CSSアニメーション */}
      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes scroll-right {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .animate-scroll-left {
          animation: scroll-left var(--duration, 25s) linear infinite;
        }
        .animate-scroll-right {
          animation: scroll-right var(--duration, 30s) linear infinite;
        }
      `}</style>
    </section>
  );
}

function StatCard({
  label,
  value,
  suffix = "件",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center">
      <div className="text-xl md:text-2xl font-bold text-white">
        {value.toLocaleString()}
        <span className="text-xs font-normal text-gray-400 ml-1">{suffix}</span>
      </div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
