"use client";

import Link from "next/link";
import { SiteStats } from "@/types";

interface HeroSectionProps {
  stats: SiteStats;
}

export function CameraHeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="home-hero">
      <div className="home-hero__content">
        <div className="home-hero__flex">
          <div className="home-hero__icon-block">
            <i className="fa-solid fa-camera"></i>
          </div>
          <h1 className="home-hero__title">
            本当に使われている撮影機材を<br />
            <span className="home-hero__title-blue">データから見つける。</span>
          </h1>
        </div>

        <p className="home-hero__subtitle">
          {stats.total_videos + stats.total_articles}件の撮影機材紹介を独自に収集・整理。<br />
          職業・ブランドから、本当に選ばれている撮影機材がわかります。
        </p>

        <div className="home-hero__actions">
          <Link href="/camera/sources" className="home-hero__btn home-hero__btn--primary">
            撮影機材データベース <i className="fa-solid fa-arrow-right"></i>
          </Link>
          <Link href="/camera/category" className="home-hero__btn home-hero__btn--outline">
            <i className="fa-regular fa-compass"></i> 機材カテゴリ
          </Link>
        </div>

        <dl className="home-hero__stats">
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_products.toLocaleString()}
              <span className="home-hero__stat-unit">+</span>
            </dd>
            <dt className="home-hero__stat-label">掲載機材</dt>
          </div>
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_mentions.toLocaleString()}
            </dd>
            <dt className="home-hero__stat-label">掲載データ</dt>
          </div>
          <div className="home-hero__stat">
            <dd className="home-hero__stat-num">
              {stats.total_videos + stats.total_articles}
            </dd>
            <dt className="home-hero__stat-label">機材紹介</dt>
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
