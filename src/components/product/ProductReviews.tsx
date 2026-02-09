"use client";

import { useState } from "react";
import { extractVideoId } from "@/lib/video-utils";
import { SourceModal } from "@/components/SourceModal";

interface Comment {
  comment: string;
  source_url?: string;
  source_title?: string;
  source_thumbnail_url?: string;
  source_video_id?: string;
  source_type?: string;
}

interface ProductReviewsProps {
  comments: Comment[];
  productName: string;
  productId: string;
  sectionNumber: number;
}

export function ProductReviews({ comments, productName, productId, sectionNumber }: ProductReviewsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState<{
    type: "video" | "article";
    id: string;
  } | null>(null);

  const handleReviewClick = (comment: Comment) => {
    // videoタイプの場合はモーダルを開く
    if (comment.source_type === "video" && comment.source_video_id) {
      setModalSource({ type: "video", id: comment.source_video_id });
      setModalOpen(true);
    } else if (comment.source_type === "video" && comment.source_url) {
      // フォールバック: URLから抽出（videoタイプの場合）
      const videoId = extractVideoId(comment.source_url);
      if (videoId) {
        setModalSource({ type: "video", id: videoId });
        setModalOpen(true);
      }
    } else if (comment.source_type === "article" && comment.source_url) {
      // 記事の場合もモーダルで開く
      setModalSource({ type: "article", id: comment.source_url });
      setModalOpen(true);
    }
  };

  return (
    <>
      <section className="content-section product-reveal">
        <div className="section-title">
          <span className="section-number">{String(sectionNumber).padStart(2, "0")}</span>
          <h2>{productName}の口コミ・実際の使用例</h2>
        </div>
        {comments.map((comment, index) => (
          <blockquote
            key={index}
            className="review-card"
            onClick={() => handleReviewClick(comment)}
          >
            <figure className="review-thumb">
              {comment.source_thumbnail_url ? (
                <img src={comment.source_thumbnail_url} alt={comment.source_title || ""} />
              ) : (
                <div className="review-thumb-placeholder">
                  <i className="fa-solid fa-image"></i>
                </div>
              )}
            </figure>
            <div className="review-body">
              <p className="review-text">{comment.comment}</p>
            </div>
          </blockquote>
        ))}
      </section>

      {modalOpen && modalSource && (
        <SourceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sourceType={modalSource.type}
          sourceId={modalSource.id}
          targetProductId={productId}
        />
      )}
    </>
  );
}
