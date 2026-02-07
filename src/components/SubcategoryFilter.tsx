"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface SubcategoryFilterProps {
  subcategories: string[];
  currentSubcategory?: string;
}

export function SubcategoryFilter({
  subcategories,
  currentSubcategory,
}: SubcategoryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (subcategory: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (subcategory === "") {
      params.delete("subcategory");
    } else {
      params.set("subcategory", subcategory);
    }
    // ページをリセット
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  if (subcategories.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-3">種類別に絞り込み</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleChange("")}
          className={`px-4 py-2 text-sm rounded-full transition-colors ${
            !currentSubcategory
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          すべて
        </button>
        {subcategories.map((subcat) => (
          <button
            key={subcat}
            onClick={() => handleChange(subcat)}
            className={`px-4 py-2 text-sm rounded-full transition-colors ${
              currentSubcategory === subcat
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {subcat}
          </button>
        ))}
      </div>
    </div>
  );
}
