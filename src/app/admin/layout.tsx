import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="bg-gray-800 text-white px-4 py-2">
        <div className="max-w-[1080px] mx-auto px-4 flex items-center gap-6 text-sm">
          <span className="font-semibold">管理画面</span>
          <Link href="/admin" className="hover:text-blue-300 transition-colors">
            デスクツアー
          </Link>
          <Link href="/admin/camera" className="hover:text-blue-300 transition-colors">
            撮影機材
          </Link>
        </div>
      </nav>
      {children}
    </>
  );
}
