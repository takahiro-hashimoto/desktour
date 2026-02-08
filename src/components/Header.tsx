"use client";

import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header-container">
      <div className="header-inner">
        <Link href="/" className="header-logo">
          デスクツアーDB
        </Link>

        {/* Desktop Nav */}
        <nav className="header-nav-desktop">
          <Link href="/sources" className="header-nav-link">
            デスクツアー
          </Link>
          <Link href="/category" className="header-nav-link">
            デスク周りのガジェット
          </Link>
          <Link href="/occupation" className="header-nav-link">
            職業別
          </Link>
          <Link href="/style" className="header-nav-link">
            スタイル別
          </Link>
          <Link href="/brand" className="header-nav-link">
            ブランド別
          </Link>
          <Link href="/contact" className="header-nav-link">
            お問い合わせ
          </Link>
          <Link href="/admin" className="header-nav-link header-nav-link-admin">
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
            <Link
              href="/sources"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-video"></i>
              デスクツアー
            </Link>
            <Link
              href="/category"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-layer-group"></i>
              デスク周りのガジェット
            </Link>
            <Link
              href="/occupation"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-briefcase"></i>
              職業別
            </Link>
            <Link
              href="/style"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-palette"></i>
              スタイル別
            </Link>
            <Link
              href="/brand"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-star"></i>
              ブランド別
            </Link>
            <Link
              href="/contact"
              className="header-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <i className="fa-solid fa-envelope"></i>
              お問い合わせ
            </Link>
            <Link
              href="/admin"
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
