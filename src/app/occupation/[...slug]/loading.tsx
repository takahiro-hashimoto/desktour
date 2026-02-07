// 【最適化】職業別ページのローディング表示
export default function Loading() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 py-12">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-6" />

      {/* Hero Section Skeleton */}
      <div className="text-center mb-16">
        <div className="h-3 w-24 bg-blue-100 rounded animate-pulse mx-auto mb-2" />
        <div className="h-12 w-48 bg-gray-200 rounded animate-pulse mx-auto mb-6" />
        <div className="h-4 w-96 max-w-full bg-gray-200 rounded animate-pulse mx-auto" />
      </div>

      {/* Category Sections Skeleton */}
      <div className="space-y-16">
        {[...Array(4)].map((_, i) => (
          <section key={i}>
            {/* Category Header */}
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Top 3 Products */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Rank Badge */}
                  <div className="relative">
                    <div className="aspect-square bg-gray-100 animate-pulse" />
                    <div className="absolute top-3 left-3 h-8 w-8 bg-gray-300 rounded-full animate-pulse" />
                  </div>
                  {/* Product Info */}
                  <div className="p-4">
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse mb-3" />
                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
