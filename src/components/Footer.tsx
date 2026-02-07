import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 py-8 mt-12">
      <div className="max-w-[1080px] mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* デスクツアー */}
          <div>
            <h3 className="text-white font-bold mb-3">デスクツアー</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/sources" className="hover:text-white">
                  動画・記事一覧
                </Link>
              </li>
            </ul>
          </div>

          {/* 職業別 */}
          <div>
            <h3 className="text-white font-bold mb-3">職業別</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/occupation/engineer" className="hover:text-white">
                  エンジニア
                </Link>
              </li>
              <li>
                <Link href="/occupation/designer" className="hover:text-white">
                  デザイナー
                </Link>
              </li>
              <li>
                <Link href="/occupation/creator" className="hover:text-white">
                  クリエイター
                </Link>
              </li>
              <li>
                <Link href="/occupation/gamer" className="hover:text-white">
                  ゲーマー
                </Link>
              </li>
            </ul>
          </div>

          {/* カテゴリ */}
          <div>
            <h3 className="text-white font-bold mb-3">カテゴリ</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/category/keyboard" className="hover:text-white">
                  キーボード
                </Link>
              </li>
              <li>
                <Link href="/category/mouse" className="hover:text-white">
                  マウス
                </Link>
              </li>
              <li>
                <Link href="/category/monitor" className="hover:text-white">
                  モニター
                </Link>
              </li>
              <li>
                <Link href="/category/desk" className="hover:text-white">
                  デスク
                </Link>
              </li>
            </ul>
          </div>

          {/* スタイル別 */}
          <div>
            <h3 className="text-white font-bold mb-3">スタイル別</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/style/minimalist" className="hover:text-white">
                  ミニマリスト
                </Link>
              </li>
              <li>
                <Link href="/style/gaming" className="hover:text-white">
                  ゲーミング
                </Link>
              </li>
              <li>
                <Link href="/style/natural" className="hover:text-white">
                  ナチュラル
                </Link>
              </li>
            </ul>
          </div>

          {/* ブランド別 */}
          <div>
            <h3 className="text-white font-bold mb-3">ブランド別</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/brand/flexispot" className="hover:text-white">
                  FlexiSpot
                </Link>
              </li>
              <li>
                <Link href="/brand/logicool" className="hover:text-white">
                  Logicool
                </Link>
              </li>
              <li>
                <Link href="/brand/keychron" className="hover:text-white">
                  Keychron
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 text-center text-sm">
          <p>© 2024 デスクツアーDB</p>
          <p className="mt-2 text-xs">
            本サイトはAmazonアソシエイトプログラムに参加しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
