"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderSectionProps {
  label: string;
  title: string;
  description: string | ReactNode;
  breadcrumbCurrent: string;
  breadcrumbMiddle?: BreadcrumbItem; // 中間パンくずリスト用（オプション）
  icon?: string; // Font Awesome icon class (例: "fa-keyboard")
}

export function PageHeaderSection({
  label,
  title,
  description,
  breadcrumbCurrent,
  breadcrumbMiddle,
  icon = "fa-cube",
}: PageHeaderSectionProps) {
  return (
    <div className="listing-page-header">
      <div className="listing-container">
        <div className="listing-breadcrumb">
          <Link href="/">トップ</Link>
          <span className="sep">
            <i className="fa-solid fa-chevron-right"></i>
          </span>
          <Link href="/desktour">PCデスク環境</Link>
          <span className="sep">
            <i className="fa-solid fa-chevron-right"></i>
          </span>
          {breadcrumbMiddle && (
            <>
              {breadcrumbMiddle.href ? (
                <Link href={breadcrumbMiddle.href}>{breadcrumbMiddle.label}</Link>
              ) : (
                <span>{breadcrumbMiddle.label}</span>
              )}
              <span className="sep">
                <i className="fa-solid fa-chevron-right"></i>
              </span>
            </>
          )}
          <span className="current">{breadcrumbCurrent}</span>
        </div>

        <div className="listing-header-inner">
          <div className="listing-header-icon">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div className="listing-header-text">
            <div className="listing-page-label">{label}</div>
            <h1>{title}</h1>
            <div className="listing-page-desc">
              {typeof description === "string" ? <p>{description}</p> : description}
              <span className="listing-pr-note">（本ページにはPRを含みます）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
