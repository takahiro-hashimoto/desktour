import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://desktour-db.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "デスクツアーDB - デスクツアー商品データベース",
    template: "%s | デスクツアーDB",
  },
  description: "YouTubeデスクツアー動画・ブログ記事から収集した商品データベース。職業・スタイル・ブランド別に人気のデスク周りガジェットを探せます。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "デスクツアーDB",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      {/* 【最適化】Font Awesome CDNを削除 → lucide-reactに統一 */}
      <body className={`${zenKaku.className} bg-gray-50 min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
