// 【最適化】ソース一覧ページのローディング表示
export default function Loading() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 py-8">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-6" />

      {/* Title Section Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-full max-w-xl bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Filters Skeleton */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-2 mb-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="flex gap-4">
          <div className="h-10 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-10 w-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Sort & Count Skeleton */}
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Video/Article Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-100 animate-pulse" />
            {/* Content */}
            <div className="p-4">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex justify-center gap-2 mt-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
