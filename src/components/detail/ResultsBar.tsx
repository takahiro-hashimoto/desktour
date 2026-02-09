"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface ResultsBarProps {
  total: number;
  currentSort?: string;
}

export function ResultsBar({ total, currentSort = "mention" }: ResultsBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sortValue = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (sortValue === "mention") {
      params.delete("sort");
    } else {
      params.set("sort", sortValue);
    }

    // ページパラメータもリセット
    params.delete("page");

    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname, { scroll: false });
  };

  return (
    <div className="detail-results-bar">
      <div className="detail-results-count">
        表示件数：<strong>{total}</strong>件
      </div>
      <div className="detail-sort-select">
        <select value={currentSort} onChange={handleSortChange}>
          <option value="mention">言及数順</option>
          <option value="price_asc">価格が安い順</option>
          <option value="price_desc">価格が高い順</option>
          <option value="newest">新着順</option>
        </select>
      </div>
    </div>
  );
}
