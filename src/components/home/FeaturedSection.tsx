"use client";

import Link from "next/link";

interface FeaturedItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  badge?: string;
  href: string;
  thumbnail_url?: string;
  product_count?: number;
}

interface FeaturedConfig {
  title: string;
  subtitle: string;
  viewAllHref: string;
  placeholder: string;
  productLabel: string;
}

interface FeaturedSectionProps {
  items: FeaturedItem[];
  config: FeaturedConfig;
}

export type { FeaturedConfig, FeaturedItem };

export function FeaturedSection({ items, config }: FeaturedSectionProps) {
  return (
    <section className="home-featured">
      <div className="home-featured__inner">
        <div className="home-featured__head">
          <div>
            <h2 className="home-featured__title">
              <i className="fas fa-fire home-featured__title-icon"></i>
              {config.title}
            </h2>
            <p className="home-featured__subtitle">{config.subtitle}</p>
          </div>
          <Link href={config.viewAllHref} className="home-featured__more">
            全て見る
            <i className="fas fa-arrow-right home-featured__more-icon"></i>
          </Link>
        </div>

        <div className="home-featured__grid">
          {items.slice(0, 3).map((item) => (
            <article key={item.id}>
            <Link href={item.href} className="home-featured__card">
              <figure className="home-featured__thumb">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="home-featured__thumb-img"
                  />
                ) : (
                  <div className="home-featured__thumb-placeholder">{config.placeholder}</div>
                )}
                {item.badge && (
                  <span className="home-featured__badge">{item.badge}</span>
                )}
              </figure>
              <div className="home-featured__body">
                <h3 className="home-featured__card-title">{item.title}</h3>
                <p className="home-featured__card-desc">
                  {item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description}
                </p>
                {item.product_count !== undefined && item.product_count > 0 && (
                  <div className="home-featured__products">
                    <i className="fa-solid fa-link"></i> {config.productLabel}: {item.product_count}件
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div className="home-featured__tags">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="home-featured__tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
