import Link from "next/link";

export function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-[1080px] mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-gray-900">
          デスクツアーDB
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/sources"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            デスクツアー
          </Link>
          <Link
            href="/occupation"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            職業別
          </Link>
          <Link
            href="/category"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            カテゴリー別
          </Link>
          <Link
            href="/style"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            スタイル別
          </Link>
          <Link
            href="/brand"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ブランド別
          </Link>
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            管理
          </Link>
        </nav>
      </div>
    </header>
  );
}
