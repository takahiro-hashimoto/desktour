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
  const maxCount = Math.max(...items.map(item => item.count), 1);

  return (
    <article className="home-explore__card">
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
    </article>
  );
}

interface CameraExploreSectionProps {
  occupations: ExploreItem[];
  brands: ExploreItem[];
  subjects: ExploreItem[];
}

export function CameraExploreSection({ occupations, brands, subjects }: CameraExploreSectionProps) {
  return (
    <section className="home-explore">
      <div className="home-explore__inner">
        <div className="home-explore__head">
          <div>
            <h2 className="home-explore__title">
              <i className="fas fa-search home-explore__title-icon"></i>
              切り口から探す
            </h2>
            <p className="home-explore__subtitle">職業・ブランド・被写体の切り口で人気の撮影機材を確認できます</p>
          </div>
        </div>

        <div className="home-explore__grid">
          <ExploreCard
            icon={<i className="fas fa-briefcase"></i>}
            title="職業別"
            description="同じ職業の人がどんな撮影機材を使っているか参考にできます"
            items={occupations}
            viewAllHref="/camera/occupation"
          />

          <ExploreCard
            icon={<i className="fas fa-tags"></i>}
            title="ブランド別"
            description="紹介された機材数が多い人気ブランドから探せます"
            items={brands}
            viewAllHref="/camera/brand"
          />

          <ExploreCard
            icon={<i className="fas fa-crosshairs"></i>}
            title="被写体別"
            description="撮影対象ごとに、どんな機材が使われているか探せます"
            items={subjects}
            viewAllHref="/camera/subject"
          />
        </div>
      </div>
    </section>
  );
}
