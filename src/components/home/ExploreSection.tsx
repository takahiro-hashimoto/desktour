"use client";

import Link from "next/link";

interface ExploreItem {
  name: string;
  count: number;
  href: string;
}

interface ExploreCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: ExploreItem[];
  viewAllHref: string;
}

function ExploreCard({ icon, title, description, items, viewAllHref }: ExploreCardProps) {
  const maxCount = Math.max(...items.map(item => item.count));

  return (
    <div className="home-explore__card">
      <div className="home-explore__card-head">
        <div className="home-explore__card-icon">{icon}</div>
        <h3 className="home-explore__card-title">{title}</h3>
      </div>
      <p className="home-explore__card-desc">{description}</p>

      <div className="home-explore__list">
        {items.slice(0, 5).map((item) => (
          <Link key={item.name} href={item.href} className="home-explore__item">
            <span className="home-explore__item-name">{item.name}</span>
            <span className="home-explore__item-right">
              <span className="home-explore__bar">
                <span
                  className="home-explore__bar-fill"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                ></span>
              </span>
              <span className="home-explore__num">{item.count}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="home-explore__footer">
        <Link href={viewAllHref} className="home-explore__footer-link">
          全ての{title}を見る
          <i className="fas fa-arrow-right home-explore__footer-icon"></i>
        </Link>
      </div>
    </div>
  );
}

interface ExploreSectionProps {
  occupations: ExploreItem[];
  styles: ExploreItem[];
  brands: ExploreItem[];
}

export function ExploreSection({ occupations, styles, brands }: ExploreSectionProps) {
  return (
    <div className="home-explore">
      <div className="home-explore__inner">
        <div className="home-explore__head">
          <div>
            <h2 className="home-explore__title">
              <i className="fas fa-search home-explore__title-icon"></i>
              切り口から探す
            </h2>
            <p className="home-explore__subtitle">職業・スタイル・ブランドの切り口で人気のデスク周りガジェットを確認できます</p>
          </div>
        </div>

        <div className="home-explore__grid">
          <ExploreCard
            icon={<i className="fas fa-briefcase"></i>}
            title="職業別"
            description="同じ職業の人がどんなデスク環境を構築しているか参考にできます"
            items={occupations}
            viewAllHref="/desktour/occupation"
          />

          <ExploreCard
            icon={<i className="fas fa-palette"></i>}
            title="スタイル別"
            description="ミニマリスト、ゲーミングなど、雰囲気やテイストから探せます"
            items={styles}
            viewAllHref="/desktour/style"
          />

          <ExploreCard
            icon={<i className="fas fa-tags"></i>}
            title="ブランド別"
            description="紹介された商品数が多い人気ブランドから探せます"
            items={brands}
            viewAllHref="/desktour/brand"
          />
        </div>
      </div>
    </div>
  );
}
