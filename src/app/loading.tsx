// 【最適化】ホームページのローディング表示
// データ取得中にスケルトンUIを表示してUXを向上
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section Skeleton */}
      <div className="h-[400px] bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />

      <div className="max-w-[1080px] mx-auto px-4 py-12 space-y-12">
        {/* カテゴリセクション Skeleton */}
        <section>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mb-6" />

          {/* 主要カテゴリ Skeleton */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded bg-gray-200 animate-pulse" />
            ))}
          </div>

          {/* サブカテゴリ Skeleton */}
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-gray-200 animate-pulse" />
            ))}
          </div>
        </section>

        {/* 3カラムカード Skeleton */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="h-3 w-full bg-gray-200 rounded animate-pulse mb-5" />
                <div className="space-y-2">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="h-8 bg-gray-100 rounded-md animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
