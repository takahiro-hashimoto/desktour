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
  breadcrumbMiddle?: BreadcrumbItem | BreadcrumbItem[]; // 中間パンくずリスト用（オプション）
  icon?: string; // Font Awesome icon class (例: "fa-keyboard")
  domain?: "desktour" | "camera";
  showPrNote?: boolean;
}

const DOMAIN_BREADCRUMB = {
  desktour: { label: "PCデスク環境", href: "/desktour" },
  camera: { label: "撮影機材", href: "/camera" },
} as const;

export function PageHeaderSection({
  label,
  title,
  description,
  breadcrumbCurrent,
  breadcrumbMiddle,
  icon = "fa-cube",
  domain = "desktour",
  showPrNote = true,
}: PageHeaderSectionProps) {
  const domainBreadcrumb = DOMAIN_BREADCRUMB[domain];

  return (
    <div className="listing-page-header">
      <div className="listing-container">
        <div className="listing-breadcrumb">
          <Link href="/">トップ</Link>
          <span className="sep">
            <i className="fa-solid fa-chevron-right"></i>
          </span>
          <Link href={domainBreadcrumb.href}>{domainBreadcrumb.label}</Link>
          <span className="sep">
            <i className="fa-solid fa-chevron-right"></i>
          </span>
          {breadcrumbMiddle && (Array.isArray(breadcrumbMiddle) ? breadcrumbMiddle : [breadcrumbMiddle]).map((item, i) => (
            <span key={i}>
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
              <span className="sep">
                <i className="fa-solid fa-chevron-right"></i>
              </span>
            </span>
          ))}
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
              {showPrNote && <span className="listing-pr-note">（本ページにはPRを含みます）</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
