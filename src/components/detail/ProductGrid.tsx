"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { generateAmazonSearchUrl, generateRakutenSearchUrl } from "@/lib/affiliateLinks";

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
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    if (gridRef.current) {
      obs.observe(gridRef.current);
    }

    return () => {
      if (gridRef.current) {
        obs.unobserve(gridRef.current);
      }
    };
  }, []);

  const getRankBadgeClass = (rank?: number) => {
    if (!rank) return "";
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  };

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return price.toLocaleString("ja-JP");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}時点`;
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
                    <div className="price-date">{formatDate(product.price_updated_at)}</div>
                  )}
                </div>
              )}
            </div>
            {product.user_comment && (
              <p className="detail-product-desc">{product.user_comment}</p>
            )}
            {product.slug && (
              <Link href={`/product/${product.slug}`} className="detail-product-cta">
                詳細を見る
              </Link>
            )}
            <div className="detail-product-links">
              <a
                href={product.amazon_url || generateAmazonSearchUrl(product.name)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="amazon"
              >
                Amazonで探す
              </a>
              <a
                href={product.rakuten_url || generateRakutenSearchUrl(product.name)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rakuten"
              >
                楽天で探す
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
