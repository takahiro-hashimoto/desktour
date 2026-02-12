"use client";

import Link from "next/link";
import { categoryToSlug } from "@/lib/constants";

interface Category {
  name: string;
  count: number;
  icon: string;
}

interface SubCategory {
  name: string;
  count: number;
  icon: string;
  slug: string;
}

interface CategoryGridSectionProps {
  mainCategories: Category[];
  subCategories: SubCategory[];
}

export function CategoryGridSection({ mainCategories, subCategories }: CategoryGridSectionProps) {
  return (
    <section className="home-category">
      <div className="home-category__inner">
        <div className="home-category__head">
          <div>
            <h2 className="home-category__title">
              <i className="fas fa-home home-category__title-icon"></i>
              商品カテゴリから探す
            </h2>
            <p className="home-category__subtitle">デスクツアー動画の中で登場したデスク周りガジェットを登場回数が多い順に確認できます！</p>
          </div>
          <Link href="/desktour/category" className="home-category__more">
            全て見る
            <i className="fas fa-arrow-right home-category__more-icon"></i>
          </Link>
        </div>

        <div className="home-category__grid">
          {mainCategories.slice(0, 5).map((category) => (
            <Link
              key={category.name}
              href={`/desktour/${categoryToSlug(category.name)}`}
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

        <div className="home-category__tags">
          {subCategories.map((sub) => (
            <Link
              key={sub.name}
              href={`/desktour/${sub.slug}`}
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
      </div>
    </section>
  );
}
