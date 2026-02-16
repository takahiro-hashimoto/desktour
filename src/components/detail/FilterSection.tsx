"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";

interface FilterSectionProps {
  label: string;
  filterKey: string; // クエリパラメータのキー名（例: "type"）
  tags: string[];
  currentFilter?: string;
  /** パスベースURL用: ベースパス（例: "/desktour/brand/apple/keyboard"） */
  basePath?: string;
  /** パスベースURL用: タグ名→スラッグのマップ（例: { "メカニカルキーボード": "mechanical" }） */
  tagSlugMap?: Record<string, string>;
}

export function FilterSection({
  label,
  filterKey,
  tags,
  currentFilter,
  basePath,
  tagSlugMap,
}: FilterSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRevealOnScroll<HTMLDivElement>();

  // パスベースモード: basePath と tagSlugMap が渡されている場合
  const isPathMode = !!(basePath && tagSlugMap);

  const handleFilterChange = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (tag === "すべて" || tag === currentFilter) {
      params.delete(filterKey);
    } else {
      params.set(filterKey, tag);
    }

    params.delete("page");

    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname, { scroll: false });
  };

  const getTagHref = (tag: string): string => {
    if (!basePath || !tagSlugMap) return "#";
    const slug = tagSlugMap[tag];
    return slug ? `${basePath}/${slug}` : basePath;
  };

  return (
    <div className="detail-filter-section detail-reveal" ref={sectionRef}>
      <div className="detail-filter-box">
        <div className="detail-filter-label">
          <i className="fa-solid fa-filter"></i>
          {label}
        </div>
        <div className="detail-filter-tags">
          {isPathMode ? (
            <>
              <Link
                href={basePath!}
                className={`detail-filter-tag ${!currentFilter ? "active" : ""}`}
              >
                すべて
              </Link>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={getTagHref(tag)}
                  className={`detail-filter-tag ${currentFilter === tag ? "active" : ""}`}
                >
                  {tag}
                </Link>
              ))}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
