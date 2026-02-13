"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

// ナビゲーション設定
const DESKTOUR_NAV = {
  logo: "Creator Clips - デスク環境",
  logoHref: "/desktour",
  desktop: [
    { href: "/desktour/sources", label: "デスクツアー" },
    { href: "/desktour/category", label: "デスク周りのガジェット" },
    { href: "/desktour/occupation", label: "職業別" },
    { href: "/desktour/style", label: "スタイル別" },
    { href: "/desktour/brand", label: "ブランド別" },
  ],
  mobile: [
    { href: "/desktour/sources", label: "デスクツアー", icon: "fa-solid fa-video" },
    { href: "/desktour/category", label: "デスク周りのガジェット", icon: "fa-solid fa-layer-group" },
    { href: "/desktour/occupation", label: "職業別", icon: "fa-solid fa-briefcase" },
    { href: "/desktour/style", label: "スタイル別", icon: "fa-solid fa-palette" },
    { href: "/desktour/brand", label: "ブランド別", icon: "fa-solid fa-star" },
  ],
};

const CAMERA_NAV = {
  logo: "Creator Clips - カメラ機材",
  logoHref: "/camera",
  desktop: [
    { href: "/camera/sources", label: "撮影機材紹介" },
    { href: "/camera/category", label: "機材カテゴリ" },
    { href: "/camera/occupation", label: "職業別" },
    { href: "/camera/brand", label: "ブランド別" },
  ],
  mobile: [
    { href: "/camera/sources", label: "撮影機材紹介", icon: "fa-solid fa-video" },
    { href: "/camera/category", label: "機材カテゴリ", icon: "fa-solid fa-camera" },
    { href: "/camera/occupation", label: "職業別", icon: "fa-solid fa-briefcase" },
    { href: "/camera/brand", label: "ブランド別", icon: "fa-solid fa-star" },
  ],
};

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // パスに応じてナビゲーションを切り替え（/admin/camera も含む）
  const isCamera = pathname.startsWith("/camera") || pathname.startsWith("/admin/camera");
  const nav = isCamera ? CAMERA_NAV : DESKTOUR_NAV;

  return (
    <header className="header-container">
      <div className="header-inner">
        <Link href={nav.logoHref} className="header-logo">
          {nav.logo}
        </Link>

        {/* Desktop Nav */}
        <nav className="header-nav-desktop">
          {nav.desktop.map((link) => (
            <Link key={link.href} href={link.href} className="header-nav-link">
              {link.label}
            </Link>
          ))}
          <Link href="/contact" className="header-nav-link">
            お問い合わせ
          </Link>
          <Link href={isCamera ? "/admin/camera" : "/admin"} className="header-nav-link header-nav-link-admin">
            管理
          </Link>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          className="header-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
        >
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <>
          <div className="header-overlay" onClick={() => setMenuOpen(false)}></div>
          <nav className="header-nav-mobile">
            {nav.mobile.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="header-nav-mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                <i className={link.icon}></i>
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-envelope"></i>
              お問い合わせ
            </Link>
            <Link
              href={isCamera ? "/admin/camera" : "/admin"}
              className="header-nav-mobile-link header-nav-mobile-link-admin"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-gear"></i>
              管理
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
