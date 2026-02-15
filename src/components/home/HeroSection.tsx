"use client";

import Link from "next/link";
import { SiteStats } from "@/types";

interface HeroConfig {
  icon: string;
  titleLine1: string;
  subtitle: string;
  primaryBtn: { label: string; href: string };
  outlineBtn: { label: string; href: string };
  statLabels: { products: string; sources: string };
}

interface HeroSectionProps {
  stats: SiteStats;
  config: HeroConfig;
}

export type { HeroConfig };

export function HeroSection({ stats, config }: HeroSectionProps) {
  const totalSources = stats.total_videos + stats.total_articles;

  return (
    <section className="home-hero">
      <div className="home-hero__content">
        <div className="home-hero__flex">
          <div className="home-hero__icon-block">
            <i className={config.icon}></i>
          </div>
          <h1 className="home-hero__title">
            {config.titleLine1}<br />
            <span className="home-hero__title-blue">データから見つける。</span>
          </h1>
        </div>

        <p className="home-hero__subtitle">
          {config.subtitle.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </p>

        <div className="home-hero__actions">
          <Link href={config.primaryBtn.href} className="home-hero__btn home-hero__btn--primary">
            {config.primaryBtn.label} <i className="fa-solid fa-arrow-right"></i>
          </Link>
          <Link href={config.outlineBtn.href} className="home-hero__btn home-hero__btn--outline">
            <i className="fa-regular fa-compass"></i> {config.outlineBtn.label}
          </Link>
        </div>

        <dl className="home-hero__stats">
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_products.toLocaleString()}
              <span className="home-hero__stat-unit">+</span>
            </dd>
            <dt className="home-hero__stat-label">{config.statLabels.products}</dt>
          </div>
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_mentions.toLocaleString()}
            </dd>
            <dt className="home-hero__stat-label">掲載データ</dt>
          </div>
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {totalSources}
            </dd>
            <dt className="home-hero__stat-label">{config.statLabels.sources}</dt>
          </div>
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_influencers}
            </dd>
            <dt className="home-hero__stat-label">投稿者</dt>
          </div>
        </dl>
      </div>
    </section>
  );
}
