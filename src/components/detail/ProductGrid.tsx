"use client";

import Link from "next/link";
import { formatPrice, formatPriceDate } from "@/lib/format-utils";
import type { DisplayProduct } from "@/lib/format-utils";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { productUrl } from "@/lib/constants";
import { cameraProductUrl } from "@/lib/camera/constants";

interface ProductGridProps {
  products: DisplayProduct[];
  domain?: "desktour" | "camera";
}

const isAmazonUrl = (url: string) =>
  url.includes("amazon.co.jp") || url.includes("amazon.com");
const isRakutenUrl = (url: string) =>
  url.includes("rakuten.co.jp") || url.includes("rakuten.com");

function getLinkInfo(url: string): { label: string; className: string; rel: string } {
  if (isAmazonUrl(url)) return { label: "Amazonで見る", className: "amazon", rel: "noopener noreferrer sponsored" };
  if (isRakutenUrl(url)) return { label: "楽天で見る", className: "rakuten", rel: "noopener noreferrer sponsored" };
  return { label: "公式サイトで見る", className: "official", rel: "noopener noreferrer" };
}

export function ProductGrid({ products, domain = "desktour" }: ProductGridProps) {
  const gridRef = useRevealOnScroll<HTMLDivElement>();

  const getRankBadgeClass = (rank?: number) => {
    if (!rank) return "";
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  };

  return (
    <div className="detail-product-grid" ref={gridRef}>
      {products.map((product) => (
        <article key={product.id} className="detail-product-card">
          <a
            href={product.amazon_url || product.rakuten_url || "#"}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="detail-product-img"
          >
            {product.rank && product.rank <= 3 && (
              <span className={`detail-rank-badge ${getRankBadgeClass(product.rank)}`}>
                No.{product.rank}
              </span>
            )}
            <div className="detail-product-img-inner">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <i className="fa-solid fa-cube img-placeholder"></i>
              )}
            </div>
          </a>
          <div className="detail-product-body">
            <div className="detail-product-brand">
              {product.brand || "ブランド不明"}
            </div>
            <div className="detail-product-name">{product.name}</div>
            <div className="detail-product-meta">
              <span className="detail-mention-badge">
                <i className="fa-solid fa-circle-check"></i> {product.mention_count}回登場
              </span>
              {product.price && (
                <div className="detail-product-price">
                  <div className="price">¥{formatPrice(product.price)}</div>
                  {product.price_updated_at && (
                    <div className="price-date">{formatPriceDate(product.price_updated_at)}</div>
                  )}
                </div>
              )}
            </div>
            {product.user_comment && (
              <div className="detail-product-comment">
                <span className="detail-product-comment-label">
                  <i className="fa-solid fa-comment"></i> 使用者の声
                </span>
                <p className="detail-product-desc">{product.user_comment}</p>
              </div>
            )}
            {product.slug && product.category && (
              <Link href={domain === "camera" ? cameraProductUrl(product as { slug?: string; id: string; category: string }) : productUrl(product as { slug?: string; id: string; category: string })} className="detail-product-cta">
                詳細を見る <i className="fa-solid fa-arrow-right"></i>
              </Link>
            )}
            {(product.amazon_url || product.rakuten_url) && (
              <div className="detail-product-links">
                {product.amazon_url && (() => {
                  const info = getLinkInfo(product.amazon_url);
                  return (
                    <a
                      href={product.amazon_url}
                      target="_blank"
                      rel={info.rel}
                      className={info.className}
                    >
                      {info.label}
                    </a>
                  );
                })()}
                {product.rakuten_url && (
                  <a
                    href={product.rakuten_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="rakuten"
                  >
                    楽天で見る
                  </a>
                )}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
