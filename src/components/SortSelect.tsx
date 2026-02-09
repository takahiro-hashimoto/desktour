"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SortSelectProps {
  defaultValue: string;
}

export function SortSelect({ defaultValue }: SortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <select
      defaultValue={defaultValue}
      onChange={handleChange}
      className="border rounded px-3 py-1 text-sm"
    >
      <option value="mention_count">言及数順</option>
      <option value="price_asc">価格が安い順</option>
      <option value="price_desc">価格が高い順</option>
    </select>
  );
}
