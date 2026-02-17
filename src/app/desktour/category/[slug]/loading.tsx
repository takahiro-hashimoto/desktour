// カテゴリページ or 商品詳細のローディング表示
export default function Loading() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 py-8">
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="mb-8">
        <div className="h-3 w-24 bg-blue-100 rounded animate-pulse mb-2" />
        <div className="h-10 w-3/4 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100 animate-pulse" />
            <div className="p-4">
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="flex justify-between items-center">
                <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-blue-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
