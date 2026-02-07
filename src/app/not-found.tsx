import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-6">ページが見つかりませんでした</p>
        <Link
          href="/"
          className="text-blue-600 hover:underline"
        >
          トップページに戻る
        </Link>
      </div>
    </main>
  );
}
