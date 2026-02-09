"use client";

import Link from "next/link";
import { formatPrice, formatPriceDate } from "@/lib/format-utils";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";

interface Product {
  id: string;
  asin?: string;
  slug?: string;
  name: string;
  brand?: string;
  image_url?: string;
  amazon_url?: string;
  rakuten_url?: string;
  price?: number;
  price_updated_at?: string;
  mention_count: number;
  user_comment?: string;
  rank?: number;
}

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
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
        <div key={product.id} className="detail-product-card">
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
            {product.slug && (
              <Link href={`/desktour/product/${product.slug}`} className="detail-product-cta">
                詳細を見る <i className="fa-solid fa-arrow-right"></i>
              </Link>
            )}
            {(product.amazon_url || product.rakuten_url) && (
              <div className="detail-product-links">
                {product.amazon_url && (
                  <a
                    href={product.amazon_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="amazon"
                  >
                    Amazonで見る
                  </a>
                )}
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
        </div>
      ))}
    </div>
  );
}
