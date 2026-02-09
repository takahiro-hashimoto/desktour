// 【最適化】商品詳細ページのローディング表示
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1080px] mx-auto px-4 py-8">
        {/* Breadcrumb Skeleton */}
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mb-6" />

        {/* Hero Section Skeleton */}
        <div className="bg-white rounded-xl overflow-hidden mb-12">
          <div className="md:flex">
            {/* Image Section Skeleton */}
            <div className="md:w-2/5 bg-gray-100 p-8 flex items-center justify-center border-r border-gray-100">
              <div className="w-full max-w-xs aspect-square bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Info Section Skeleton */}
            <div className="md:w-3/5 p-8">
              <div className="h-6 w-32 bg-blue-100 rounded animate-pulse mb-4" />
              <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse mb-6" />

              <div className="border-t border-gray-200 pt-6">
                <div className="flex gap-8">
                  <div>
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="border-l border-gray-200 pl-8">
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections Skeleton */}
        <div className="space-y-12">
          {[...Array(3)].map((_, i) => (
            <section key={i}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-5 w-6 bg-blue-200 rounded animate-pulse" />
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="border-b border-gray-200 mb-6" />
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${80 - j * 10}%` }} />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
