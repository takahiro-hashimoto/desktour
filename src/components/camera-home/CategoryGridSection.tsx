"use client";

import Link from "next/link";
import { cameraCategoryToSlug } from "@/lib/camera/constants";

interface Category {
  name: string;
  count: number;
  icon: string;
}

interface CategoryGridSectionProps {
  mainCategories: Category[];
}

export function CameraCategoryGridSection({ mainCategories }: CategoryGridSectionProps) {
  return (
    <section className="home-category">
      <div className="home-category__inner">
        <div className="home-category__head">
          <div>
            <h2 className="home-category__title">
              <i className="fas fa-camera home-category__title-icon"></i>
              機材カテゴリから探す
            </h2>
            <p className="home-category__subtitle">撮影機材紹介の動画・記事の中で登場した機材を登場回数が多い順に確認できます！</p>
          </div>
          <Link href="/camera/category" className="home-category__more">
            全て見る
            <i className="fas fa-arrow-right home-category__more-icon"></i>
          </Link>
        </div>

        <div className="home-category__grid">
          {mainCategories.map((category) => (
            <Link
              key={category.name}
              href={`/camera/category/${cameraCategoryToSlug(category.name)}`}
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
      </div>
    </section>
  );
}
