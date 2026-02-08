import Link from "next/link";
import { SortSelect } from "./SortSelect";
import { RankingProductCard } from "./RankingProductCard";
import type { ProductWithStats } from "@/types";

interface ProductListSectionProps {
  products: ProductWithStats[];
  total: number;
  sort: string;
  emptyMessage?: string;
  emptyLinkHref?: string;
  emptyLinkText?: string;
}

export function ProductListSection({
  products,
  total,
  sort,
  emptyMessage = "該当する商品がありません",
  emptyLinkHref = "/",
  emptyLinkText = "トップページへ戻る",
}: ProductListSectionProps) {
  return (
    <>
      {/* Sort */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">表示件数：{total}件</p>
        <SortSelect defaultValue={sort} />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map((product, index) => (
          <RankingProductCard
            key={product.id}
            product={product}
            rank={index + 1}
            adoptionText={`${product.mention_count}回紹介`}
          />
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 mb-4">{emptyMessage}</p>
          <Link href={emptyLinkHref} className="text-blue-600 hover:underline">
            {emptyLinkText}
          </Link>
        </div>
      )}
    </>
  );
}
