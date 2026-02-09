"use client";

import { useState } from "react";
import { Quote, Play, FileText } from "lucide-react";
// Play, FileText は引き続きサムネイル内のアイコンで使用
import { SourceModal } from "./SourceModal";
import type { ProductComment } from "@/types";

interface ProductCommentWithModalProps {
  comments: ProductComment[];
  productId: string; // クリック元の商品ID
}

export function ProductCommentWithModal({ comments, productId }: ProductCommentWithModalProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{
    type: "video" | "article";
    id: string;
  } | null>(null);

  const handleCommentClick = (comment: ProductComment) => {
    if (comment.source_id) {
      setSelectedSource({
        type: comment.source_type,
        id: comment.source_id,
      });
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className="grid md:grid-cols-2 gap-5">
        {comments.map((comment, index) => (
          <div
            key={index}
            onClick={() => handleCommentClick(comment)}
            className={`relative bg-white border border-gray-200 rounded-xl overflow-hidden transition-all shadow-sm flex ${
              comment.source_id
                ? "hover:border-blue-400 hover:shadow-md cursor-pointer"
                : ""
            }`}
          >
            {/* サムネイル（横並び） */}
            {comment.source_thumbnail_url && (
              <div className="w-36 flex-shrink-0 bg-gray-50 relative">
                <img
                  src={comment.source_thumbnail_url}
                  alt={`${comment.source_type === "video" ? "動画" : "記事"}「${comment.source_title || "不明"}」のサムネイル${comment.channel_title ? ` - ${comment.channel_title}` : ""}${comment.author ? ` - ${comment.author}` : ""}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* 動画/記事アイコン */}
                <div className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
                  {comment.source_type === "video" ? (
                    <Play className="w-3 h-3 text-white fill-white" />
                  ) : (
                    <FileText className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            )}

            <div className="p-5 flex-1 min-w-0 flex flex-col">
              {/* Quote Icon（サムネイルがない場合のみ表示） */}
              {!comment.source_thumbnail_url && (
                <Quote className="w-5 h-5 text-blue-200 mb-2" />
              )}

              {/* Comment Text */}
              <p className="text-gray-700 text-sm leading-relaxed flex-1">
                {comment.comment}
              </p>

              {/* クリック可能であることを示す */}
              {comment.source_id && (
                <p className="text-xs text-blue-500 mt-3 font-medium">
                  詳細を見る →
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedSource && (
        <SourceModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedSource(null);
          }}
          sourceType={selectedSource.type}
          sourceId={selectedSource.id}
          targetProductId={productId}
        />
      )}
    </>
  );
}
