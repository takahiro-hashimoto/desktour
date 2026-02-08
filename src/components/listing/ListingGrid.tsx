"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface ListingItem {
  href: string;
  icon: string;
  title: string;
  count: number;
  description: string;
}

interface ListingGridProps {
  items: ListingItem[];
}

export function ListingGrid({ items }: ListingGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.08 }
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

  return (
    <div className="listing-container">
      <div className="listing-section">
        <div className="listing-grid" ref={gridRef}>
          {items.map((item) => (
            <Link key={item.title} href={item.href} className="listing-card">
              <div className="listing-card-head">
                <div className="listing-card-icon">
                  <i className={item.icon}></i>
                </div>
                <span className="listing-card-name">{item.title}</span>
                <span className="listing-card-count">{item.count}件</span>
              </div>
              <p className="listing-card-desc">{item.description}</p>
              <span className="listing-card-link">
                詳細を見る <i className="fa-solid fa-arrow-right"></i>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
