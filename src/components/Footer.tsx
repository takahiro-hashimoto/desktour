import Link from "next/link";
import {
  OCCUPATION_TAGS,
  occupationToSlug,
  PRODUCT_CATEGORIES,
  categoryToSlug,
  STYLE_TAGS,
  styleTagToSlug,
} from "@/lib/constants";
import { getTopBrandsByProductCount } from "@/lib/supabase";

export async function Footer() {
  // TOP10ブランドを取得
  const topBrands = await getTopBrandsByProductCount(10);

  return (
    <footer className="bg-gray-800 text-gray-400 py-8 mt-12">
      <div className="max-w-[1080px] mx-auto px-4">
        {/* 1段目: 主要リンク（横並び） */}
        <div className="flex flex-wrap gap-6 justify-center mb-8 pb-8 border-b border-gray-700">
          <Link href="/sources" className="text-white font-bold hover:text-gray-300">
            デスクツアー
          </Link>
          <Link href="/about" className="text-white font-bold hover:text-gray-300">
            運営者情報
          </Link>
          <Link href="/policy" className="text-white font-bold hover:text-gray-300">
            コンテンツ制作ポリシー
          </Link>
          <Link href="/contact" className="text-white font-bold hover:text-gray-300">
            お問い合わせ
          </Link>
        </div>

        {/* 2段目: カテゴリ別リンク */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 製品カテゴリ */}
          <div>
            <p className="text-white font-bold mb-3">
              <Link href="/category" className="hover:text-white">
                製品カテゴリ
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {PRODUCT_CATEGORIES.slice(0, 10).map((category) => (
                <li key={category}>
                  <Link
                    href={`/category/${categoryToSlug(category)}`}
                    className="hover:text-white"
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 職業別 */}
          <div>
            <p className="text-white font-bold mb-3">
              <Link href="/occupation" className="hover:text-white">
                職業別
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {OCCUPATION_TAGS.map((occupation) => (
                <li key={occupation}>
                  <Link
                    href={`/occupation/${occupationToSlug(occupation)}`}
                    className="hover:text-white"
                  >
                    {occupation}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ブランド別 */}
          <div>
            <p className="text-white font-bold mb-3">
              <Link href="/brand" className="hover:text-white">
                ブランド別
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {topBrands.map((brand) => (
                <li key={brand.slug}>
                  <Link
                    href={`/brand/${brand.slug}`}
                    className="hover:text-white"
                  >
                    {brand.brand}
                  </Link>
                </li>
              ))}
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
