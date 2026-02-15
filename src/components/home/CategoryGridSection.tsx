"use client";

import Link from "next/link";

interface Category {
  name: string;
  count: number;
  icon: string;
  href: string;
}

interface SubCategory {
  name: string;
  count: number;
  icon: string;
  href: string;
}

interface CategoryGridConfig {
  titleIcon: string;
  title: string;
  subtitle: string;
  viewAllHref: string;
}

interface CategoryGridSectionProps {
  mainCategories: Category[];
  subCategories?: SubCategory[];
  config: CategoryGridConfig;
}

export type { Category, SubCategory, CategoryGridConfig };

export function CategoryGridSection({ mainCategories, subCategories, config }: CategoryGridSectionProps) {
  return (
    <section className="home-category">
      <div className="home-category__inner">
        <div className="home-category__head">
          <div>
            <h2 className="home-category__title">
              <i className={`fas ${config.titleIcon} home-category__title-icon`}></i>
              {config.title}
            </h2>
            <p className="home-category__subtitle">{config.subtitle}</p>
          </div>
          <Link href={config.viewAllHref} className="home-category__more">
            全て見る
            <i className="fas fa-arrow-right home-category__more-icon"></i>
          </Link>
        </div>

        <div className="home-category__grid">
          {mainCategories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="home-category__card"
            >
              <div className="home-category__card-icon">
                <i className={category.icon}></i>
              </div>
              <div className="home-category__card-name">{category.name}</div>
              <div className="home-category__card-count">{category.count} items</div>
            </Link>
          ))}
        </div>

        {subCategories && subCategories.length > 0 && (
          <div className="home-category__tags">
            {subCategories.map((sub) => (
              <Link
                key={sub.name}
                href={sub.href}
                className="home-category__tag"
              >
                <span className="home-category__tag-icon">
                  <i className={sub.icon}></i>
                </span>
                {sub.name}
                <span className="home-category__tag-count">{sub.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
