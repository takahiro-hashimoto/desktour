import Link from "next/link";
import { RankingProductCard } from "./RankingProductCard";
import type { ProductWithStats } from "@/types";

interface CategorySectionProps {
  categoryName: string;
  categoryEnglish: string;
  products: ProductWithStats[];
  viewAllHref: string;
  totalCount: number;
  adoptionTextFn?: (product: ProductWithStats) => string;
}

export function CategorySection({
  categoryName,
  categoryEnglish,
  products,
  viewAllHref,
  totalCount,
  adoptionTextFn = (product) => `${product.mention_count}回紹介`,
}: CategorySectionProps) {
  return (
    <section>
      {/* Category Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            {categoryEnglish}
          </h2>
          <span className="text-sm text-gray-500">{categoryName}</span>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
        >
          View All
          <span className="text-gray-400">({totalCount}件)</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Top 3 Products */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.slice(0, 3).map((product, index) => (
          <RankingProductCard
            key={product.id}
            product={product}
            rank={index + 1}
            adoptionText={adoptionTextFn(product)}
          />
        ))}
      </div>
    </section>
  );
}
