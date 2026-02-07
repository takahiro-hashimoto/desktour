"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SourceCard } from "@/components/SourceCard";
import { SourceModal } from "@/components/SourceModal";
import type { SourceItem } from "./page";

interface SourcesClientProps {
  items: SourceItem[];
  total: number;
  availableTags: string[];       // スタイルタグ
  tagCounts: Record<string, number>;
  selectedTags: string[];
  occupationTags: string[];
  selectedOccupation?: string;
  environmentTags: string[];     // 環境タグ
  selectedEnvironment?: string;  // 選択中の環境タグ
  selectedStyle?: string;        // 選択中のスタイルタグ（単一選択）
  sortOrder: "newest" | "oldest";
  currentPage: number;
  limit: number;
}

export function SourcesClient({
  items,
  total,
  availableTags,
  selectedTags,
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

  // ページトップへスクロール
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // URL更新（フィルターは1つだけ: occupation, environment, style のいずれか）
  const updateUrl = (params: { style?: string | null; occupation?: string | null; environment?: string | null; sort?: "newest" | "oldest"; page?: number }, shouldScroll = false) => {
    const newParams = new URLSearchParams();

    // ソート順を維持
    const currentSort = searchParams.get("sort");
    if (params.sort !== undefined) {
      if (params.sort === "oldest") {
        newParams.set("sort", "oldest");
      }
    } else if (currentSort === "oldest") {
      newParams.set("sort", "oldest");
    }

    // ページを設定
    if (params.page !== undefined && params.page > 1) {
      newParams.set("page", params.page.toString());
    }

    // フィルターは1つだけ（新しく選択されたものを優先）
    if (params.style !== undefined && params.style !== null) {
      newParams.set("style", params.style);
    } else if (params.occupation !== undefined && params.occupation !== null) {
      newParams.set("occupation", params.occupation);
    } else if (params.environment !== undefined && params.environment !== null) {
      newParams.set("environment", params.environment);
    }

    const queryString = newParams.toString();
    router.push(queryString ? `/sources?${queryString}` : "/sources");

    if (shouldScroll) {
      scrollToTop();
    }
  };

  // 職業選択（他のフィルターをクリアして切り替え）
  const handleOccupationChange = (occupation: string | null) => {
    if (occupation === null || selectedOccupation === occupation) {
      // 解除
      updateUrl({ occupation: null, style: null, environment: null, page: 1 });
    } else {
      // 新しい選択（他のフィルターは自動クリア）
      updateUrl({ occupation, page: 1 });
    }
  };

  // 環境選択（他のフィルターをクリアして切り替え）
  const handleEnvironmentChange = (environment: string | null) => {
    if (environment === null || selectedEnvironment === environment) {
      updateUrl({ environment: null, style: null, occupation: null, page: 1 });
    } else {
      updateUrl({ environment, page: 1 });
    }
  };

  // スタイル選択（他のフィルターをクリアして切り替え）
  const handleStyleChange = (style: string | null) => {
    if (style === null || selectedStyle === style) {
      updateUrl({ style: null, occupation: null, environment: null, page: 1 });
    } else {
      updateUrl({ style, page: 1 });
    }
  };

  // ソート順変更
  const handleSortChange = (sort: "newest" | "oldest") => {
    // 現在のフィルターを維持
    const newParams = new URLSearchParams(searchParams.toString());
    if (sort === "oldest") {
      newParams.set("sort", "oldest");
    } else {
      newParams.delete("sort");
    }
    newParams.delete("page");
    router.push(`/sources?${newParams.toString()}`);
    scrollToTop();
  };

  // フィルタークリア
  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    const currentSort = searchParams.get("sort");
    if (currentSort === "oldest") {
      newParams.set("sort", "oldest");
    }
    const queryString = newParams.toString();
    router.push(queryString ? `/sources?${queryString}` : "/sources");
    scrollToTop();
  };

  // ページ変更
  const handlePageChange = (page: number) => {
    updateUrl({ page }, true);
  };

  // モーダル表示
  const openModal = (type: "video" | "article", id: string) => {
    setModalSource({ type, id });
    setModalOpen(true);
  };

  // スタイルタグ（全件表示）
  const styleTags = availableTags;

  // フィルターが何か選択されているか（単一選択のみ）
  const hasActiveFilters = selectedOccupation || selectedEnvironment || selectedStyle;

  // 現在選択中のフィルター（カード表示用）
  const activeFilter = selectedOccupation || selectedEnvironment || selectedStyle;

  return (
    <div>
      {/* フィルターカード */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        {/* 3カラムレイアウト: 職業・スタイル・環境 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 職業（10個すべて表示） */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-3">職業</p>
            <div className="flex flex-wrap gap-2">
              {occupationTags.map((occupation) => (
                <button
                  key={occupation}
                  onClick={() => handleOccupationChange(selectedOccupation === occupation ? null : occupation)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    selectedOccupation === occupation
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {occupation}
                </button>
              ))}
            </div>
          </div>

          {/* スタイル */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-3">スタイル</p>
            <div className="flex flex-wrap gap-2">
              {styleTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleStyleChange(selectedStyle === tag ? null : tag)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    selectedStyle === tag
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 環境 */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-3">環境</p>
            <div className="flex flex-wrap gap-2">
              {environmentTags.map((env) => (
                <button
                  key={env}
                  onClick={() => handleEnvironmentChange(selectedEnvironment === env ? null : env)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    selectedEnvironment === env
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* クリアボタン */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleClearFilters}
              className="text-sm text-blue-600 hover:underline"
            >
              フィルターをクリア
            </button>
          </div>
        )}
      </div>

      {/* 表示件数とソートセレクター */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          表示件数：{total}件{hasActiveFilters && "（絞り込み中）"}
        </p>
        <select
          value={sortOrder}
          onChange={(e) => handleSortChange(e.target.value as "newest" | "oldest")}
          className="px-3 py-1.5 rounded border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">投稿日が新しい順</option>
          <option value="oldest">投稿日が古い順</option>
        </select>
      </div>

      {/* カードグリッド（動画・記事混在） */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((item) => {
          // 選択されたフィルターを先頭に並べ替え
          let sortedTags = item.tags || [];
          if (activeFilter && sortedTags.includes(activeFilter)) {
            sortedTags = [activeFilter, ...sortedTags.filter(t => t !== activeFilter)];
          }

          return (
            <SourceCard
              key={item.id}
              source={{
                title: item.title,
                thumbnail_url: item.thumbnail_url,
                summary: item.summary,
                tags: sortedTags,
                published_at: item.published_at,
                occupation_tags: item.occupation_tags,
                // video用
                video_id: item.video_id,
                channel_title: item.channel_title,
                subscriber_count: item.subscriber_count,
                // article用
                url: item.url,
                author: item.author,
                site_name: item.site_name,
                // 商品数
                product_count: item.product_count,
              }}
              type={item.type}
              onClick={() => openModal(item.type, item.id)}
              highlightedTag={activeFilter}
            />
          );
        })}
      </div>

      {/* 空状態 */}
      {items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 mb-4">
            該当するコンテンツがありません
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-blue-600 hover:underline"
            >
              フィルターをクリア
            </button>
          )}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === pageNum
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            次へ
          </button>
        </div>
      )}

      {/* 関連コンテンツ（内部リンク） */}
      <section className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">関連コンテンツ</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/category/keyboard"
            className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl mb-2 block">⌨️</span>
            <span className="text-sm font-medium text-gray-900">キーボード人気ランキング</span>
          </Link>
          <Link
            href="/category/mouse"
            className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl mb-2 block">🖱️</span>
            <span className="text-sm font-medium text-gray-900">マウス人気ランキング</span>
          </Link>
          <Link
            href="/occupation/engineer"
            className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl mb-2 block">💻</span>
            <span className="text-sm font-medium text-gray-900">エンジニアのデスク</span>
          </Link>
          <Link
            href="/occupation/designer"
            className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl mb-2 block">🎨</span>
            <span className="text-sm font-medium text-gray-900">デザイナーのデスク</span>
          </Link>
        </div>

        {/* 人気のデスクスタイル */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">人気のデスクスタイル</h3>
          <div className="flex flex-wrap gap-2">
            {["ミニマリスト", "ゲーミング", "おしゃれ", "ホワイト", "ブラック"].map((tag) => (
              <button
                key={tag}
                onClick={() => handleStyleChange(selectedStyle === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedStyle === tag
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* モーダル */}
      {modalSource && (
        <SourceModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setModalSource(null);
          }}
          sourceType={modalSource.type}
          sourceId={modalSource.id}
        />
      )}
    </div>
  );
}
