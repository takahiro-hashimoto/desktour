import Link from "next/link";
import {
  CAMERA_PRODUCT_CATEGORIES,
  CAMERA_OCCUPATION_TAGS,
  CAMERA_SUBJECT_TAGS,
  cameraCategoryToSlug,
  cameraOccupationToSlug,
  cameraSubjectToSlug,
} from "@/lib/camera/constants";
import { getCameraTopBrandsByProductCount } from "@/lib/supabase/queries-camera";

export async function CameraFooter() {
  const topBrands = await getCameraTopBrandsByProductCount(10);

  return (
    <footer className="bg-gray-800 text-gray-400 py-8 mt-12">
      <div className="max-w-[1080px] mx-auto px-4">
        {/* 1段目: 主要リンク */}
        <nav aria-label="主要ページ" className="flex flex-wrap gap-6 justify-center mb-8 pb-8 border-b border-gray-700">
          <Link href="/desktour" className="text-white font-bold hover:text-gray-300">
            デスク環境
          </Link>
          <Link href="/camera" className="text-white font-bold hover:text-gray-300">
            カメラ機材
          </Link>
          <Link href="/about" className="text-white font-bold hover:text-gray-300">
            運営者情報
          </Link>
          <Link href="/policy" className="text-white font-bold hover:text-gray-300">
            コンテンツ制作ポリシー
          </Link>
          <Link href="/privacy" className="text-white font-bold hover:text-gray-300">
            プライバシーポリシー
          </Link>
          <Link href="/contact" className="text-white font-bold hover:text-gray-300">
            お問い合わせ
          </Link>
        </nav>

        {/* 2段目: カテゴリ別リンク */}
        <nav aria-label="サイトマップ" className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* 製品カテゴリ */}
          <div>
            <p className="text-white font-bold mb-3">
              <Link href="/camera/category" className="hover:text-white">
                製品カテゴリ
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {CAMERA_PRODUCT_CATEGORIES.map((category) => (
                <li key={category}>
                  <Link
                    href={`/camera/${cameraCategoryToSlug(category)}`}
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
              <Link href="/camera/occupation" className="hover:text-white">
                職業別
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {CAMERA_OCCUPATION_TAGS.map((occupation) => (
                <li key={occupation}>
                  <Link
                    href={`/camera/occupation/${cameraOccupationToSlug(occupation)}`}
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
              <Link href="/camera/brand" className="hover:text-white">
                ブランド別
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {topBrands.map((brand) => (
                <li key={brand.slug}>
                  <Link
                    href={`/camera/brand/${brand.slug}`}
                    className="hover:text-white"
                  >
                    {brand.brand}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 被写体別 */}
          <div>
            <p className="text-white font-bold mb-3">
              <Link href="/camera/subject" className="hover:text-white">
                被写体別
              </Link>
            </p>
            <ul className="space-y-1 text-sm">
              {CAMERA_SUBJECT_TAGS.map((subject) => (
                <li key={subject}>
                  <Link
                    href={`/camera/subject/${cameraSubjectToSlug(subject)}`}
                    className="hover:text-white"
                  >
                    {subject}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="border-t border-gray-700 pt-6 text-center text-sm">
          <small>&copy; 2024 Creator Clip</small>
          <p className="mt-2 text-xs">
            本サイトはAmazonアソシエイトプログラムに参加しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
