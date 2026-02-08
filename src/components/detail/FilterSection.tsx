"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface FilterSectionProps {
  label: string;
  filterKey: string; // クエリパラメータのキー名（例: "subcategory"）
  tags: string[];
  currentFilter?: string;
}

export function FilterSection({
  label,
  filterKey,
  tags,
  currentFilter,
}: FilterSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      obs.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        obs.unobserve(sectionRef.current);
      }
    };
  }, []);

  const handleFilterChange = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (tag === "すべて" || tag === currentFilter) {
      params.delete(filterKey);
    } else {
      params.set(filterKey, tag);
    }

    // ページパラメータもリセット
    params.delete("page");

    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname);
  };

  return (
    <div className="detail-filter-section detail-reveal" ref={sectionRef}>
      <div className="detail-filter-box">
        <div className="detail-filter-label">
          <i className="fa-solid fa-filter"></i>
          {label}
        </div>
        <div className="detail-filter-tags">
          <button
            className={`detail-filter-tag ${!currentFilter ? "active" : ""}`}
            onClick={() => handleFilterChange("すべて")}
          >
            すべて
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`detail-filter-tag ${currentFilter === tag ? "active" : ""}`}
              onClick={() => handleFilterChange(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
